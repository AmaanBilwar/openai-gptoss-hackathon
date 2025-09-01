import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { CerebrasLLM } from './cerebrasLLM';
import { FileChange, CommitGroup, DiffHunk } from './types';
import parse from "parse-diff";
import { pipeline, env } from '@xenova/transformers';

const execAsync = promisify(exec);

// Initialize local embedding model
let embeddingModel: any = null;
const initializeEmbeddingModel = async () => {
  if (!embeddingModel) {
    console.log('🔄 Initializing local embedding model...');
    embeddingModel = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    console.log('✅ Local embedding model ready');
  }
  return embeddingModel;
};

const generateCodeEmbeddings = async (
  codeSnippets: string[]
): Promise<Array<{ embedding: number[]; content: string }>> => {
  try {
    const model = await initializeEmbeddingModel();
    
    const embeddings = await Promise.all(
      codeSnippets.map(async (snippet) => {
        const result = await model(snippet, { pooling: 'mean', normalize: true });
        return Array.from(result.data);
      })
    );

    return embeddings.map((embedding, index) => ({
      content: codeSnippets[index]!,
      embedding: embedding as number[],
    }));
  } catch (error) {
    console.warn('⚠️  Local embedding model failed, falling back to simple text clustering');
    console.error('Embedding error:', error);
    throw error;
  }
};


/**
 * Main class for intelligent commit splitting
 */
export class IntelligentCommitSplitter {
  private cerebras: CerebrasLLM;
  constructor(cerebrasApiKey: string) {
    this.cerebras = new CerebrasLLM(cerebrasApiKey);
  }

  /**
   * Get list of files that have been changed in git, including new files
   */
  private async getGitDiffFiles(): Promise<string[]> {
    const changedFiles: string[] = [];

    try {
      // Get modified/deleted files
      const { stdout: diffOutput } = await execAsync('git diff --name-only');
      if (diffOutput.trim()) {
        changedFiles.push(...diffOutput.split('\n').filter(line => line.trim()));
      }

      // Get newly added files (staged but not committed)
      const { stdout: stagedOutput } = await execAsync('git diff --cached --name-only');
      if (stagedOutput.trim()) {
        changedFiles.push(...stagedOutput.split('\n').filter(line => line.trim()));
      }

      // Get untracked files (not staged yet)
      const { stdout: untrackedOutput } = await execAsync('git ls-files --others --exclude-standard');
      if (untrackedOutput.trim()) {
        changedFiles.push(...untrackedOutput.split('\n').filter(line => line.trim()));
      }

      // Remove duplicates while preserving order
      const seen = new Set<string>();
      const uniqueFiles: string[] = [];
      for (const file of changedFiles) {
        if (!seen.has(file)) {
          seen.add(file);
          uniqueFiles.push(file);
        }
      }

      return uniqueFiles;

    } catch (error) {
      console.error('Error getting git diff files:', error);
      return [];
    }
  }

  /**
   * Get git diff hunks from the files, and group diff by hunks
   */
  async getGitDiffHunks(filePath: string): Promise<DiffHunk[]> {
    try {
      const changeType = await this.determineChangeType(filePath);
      let stdoutStaged = '';
      let stdoutUnstaged = '';
      
      // Handle deleted files
      if (changeType === 'deleted') {
        try {
          const { stdout } = await execAsync(`git diff --cached HEAD -- "${filePath}"`);
          stdoutStaged = stdout;
        } catch {
          // File might not be staged for deletion yet
        }
        try {
          const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`);
          stdoutUnstaged = stdout;
        } catch {
          // File might already be staged
        }
      } else {
        try {
          const { stdout } = await execAsync(`git diff --cached --unified=3 -- "${filePath}"`);
          stdoutStaged = stdout;
        } catch {
          // No staged changes
        }
        try {
          const { stdout } = await execAsync(`git diff --unified=3 -- "${filePath}"`);
          stdoutUnstaged = stdout;
        } catch {
          // No unstaged changes
        }
      }
      
      const diffStaged = parse(stdoutStaged);
      const diffUnstaged = parse(stdoutUnstaged);
      const hunks: DiffHunk[] = [];

             for (const file of diffStaged) {
         // Skip files with /dev/null paths (deleted files)
         const actualFilePath = file.to !== '/dev/null' ? file.to : file.from;
         if (!actualFilePath || actualFilePath === '/dev/null') {
           continue;
         }
         
         for (const hunk of file.chunks) {
           hunks.push({
             filePath: actualFilePath,
             oldStart: hunk.oldStart,
             oldLines: hunk.oldLines,
             newStart: hunk.newStart,
             newLines: hunk.newLines,
             changeType: 'staged',
             header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
             content: hunk.changes.map(change => change.content),
             context: hunk.changes.map(change => change.content).join('\n')
           });
         }
       }

       for (const file of diffUnstaged) {
         // Skip files with /dev/null paths (deleted files)
         const actualFilePath = file.to !== '/dev/null' ? file.to : file.from;
         if (!actualFilePath || actualFilePath === '/dev/null') {
           continue;
         }
         
         for (const hunk of file.chunks) {
           hunks.push({
             filePath: actualFilePath,
             oldStart: hunk.oldStart,
             oldLines: hunk.oldLines,
             newStart: hunk.newStart,
             newLines: hunk.newLines,
             changeType: 'unstaged',
             header: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
             content: hunk.changes.map(change => change.content),
             context: hunk.changes.map(change => change.content).join('\n')
           });
         }
       }

      return hunks;
    } catch (error) {
      console.error(`Error getting hunks for ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Get the git repository root directory
   */
  private async getGitRoot(): Promise<string> {
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel');
      return stdout.trim();
    } catch {
      return process.cwd();
    }
  }

  /**
   * Get file content at a specific commit
   */
  private async getFileContent(filePath: string, commitRef: string = 'HEAD'): Promise<string | null> {
    try {
      const { stdout } = await execAsync(`git show ${commitRef}:${filePath}`);
      return stdout;
    } catch {
      // File doesn't exist at this commit (new file)
      return null;
    }
  }

  /**
   * Get the diff content for a specific file
   */
  private async getFileDiff(filePath: string): Promise<string> {
    try {
      // For deleted files, get diff from HEAD
      const changeType = await this.determineChangeType(filePath);
      if (changeType === 'deleted') {
        const { stdout } = await execAsync(`git diff HEAD -- "${filePath}"`);
        return stdout || '';
      }
      
      const { stdout } = await execAsync(`git diff --unified=3 -- "${filePath}"`);
      return stdout || '';
    } catch (error) {
      console.error(`Error getting diff for ${filePath}:`, error);
      return '';
    }
  }

  /**
   * Determine if file was added, modified, or deleted
   */
  private async determineChangeType(filePath: string): Promise<'added' | 'modified' | 'deleted'> {
    try {
      // Check if file exists in working directory
      const fileExistsInWorkdir = require('fs').existsSync(filePath);

      // Check if file exists in HEAD
      const headContent = await this.getFileContent(filePath, 'HEAD');
      const fileExistsInHead = headContent !== null;

      if (!fileExistsInWorkdir && fileExistsInHead) {
        return 'deleted';
      } else if (fileExistsInWorkdir && !fileExistsInHead) {
        return 'added';
      } else {
        return 'modified';
      }
    } catch {
      return 'modified';
    }
  }

  /**
   * Extract all file changes with before/after content
   */
  private async extractChanges(): Promise<FileChange[]> {
    const changedFiles = await this.getGitDiffFiles();
    const changes: FileChange[] = [];

    for (const filePath of changedFiles) {
      // Skip invalid paths
      if (filePath === '/dev/null' || filePath.includes('/dev/null')) {
        continue;
      }
      
      const changeType = await this.determineChangeType(filePath);
      const diffContent = await this.getFileDiff(filePath);
      const hunks = await this.getGitDiffHunks(filePath);

      // Get before and after content
      let beforeContent: string | null = null;
      let afterContent: string | null = null;

      if (changeType !== 'added') {
        beforeContent = await this.getFileContent(filePath, 'HEAD');
      }

      if (changeType !== 'deleted') {
        try {
          // Try to read the file using git show for the current working tree
          const { stdout } = await execAsync(`git show :${filePath}`);
          afterContent = stdout;
        } catch {
          // Fallback to direct file reading if git show fails
          try {
            afterContent = fs.readFileSync(filePath, 'utf-8');
          } catch {
            // File might not exist or be unreadable
          }
        }
      }

      // Count lines added/removed from diff
      const linesAdded = (diffContent.match(/^\+/gm) || []).length;
      const linesRemoved = (diffContent.match(/^-/gm) || []).length;

      if (changeType === 'added') {
        console.log(`   📁 Found new file: ${filePath} (${linesAdded} lines, ${hunks.length} hunks)`);
      }

      changes.push({
        file_path: filePath,
        change_type: changeType,
        before_content: beforeContent || undefined,
        after_content: afterContent || undefined,
        diff_content: diffContent,
        total_lines_added: linesAdded,
        total_lines_removed: linesRemoved,
        hunks: hunks
      });
    }

    return changes;
  }

  /**
   * Vectorize hunks using lightweight embeddings
   */
  private async vectorizeHunks(changes: FileChange[]): Promise<Array<{hunk: DiffHunk, embedding: number[], changeIndex: number}>> {
    console.log('🔢 Vectorizing hunks using lightweight embeddings...');

    const hunkData: Array<{hunk: DiffHunk, embedding: number[], changeIndex: number}> = [];
    const textContents: string[] = [];

    // Extract text content from all hunks
    for (let changeIdx = 0; changeIdx < changes.length; changeIdx++) {
      const change = changes[changeIdx];
      if (change.hunks) {
        for (const hunk of change.hunks) {
          textContents.push(hunk.context);
        }
      }
    }

    // Get embeddings for all texts at once
    const embeddings = await generateCodeEmbeddings(textContents);
    let embeddingIndex = 0;

    // Map embeddings back to hunks
    for (let changeIdx = 0; changeIdx < changes.length; changeIdx++) {
      const change = changes[changeIdx];
      if (change.hunks) {
        for (const hunk of change.hunks) {
          hunkData.push({
            hunk,
            embedding: embeddings[embeddingIndex++].embedding,
            changeIndex: changeIdx
          });
        }
      }
    }

    return hunkData;
  }

  /**
   * Analyze hunks using embeddings and clustering
   */
  private async analyzeSemanticRelationships(changes: FileChange[]): Promise<[CommitGroup[], string]> {
    console.log('🔍 Analyzing semantic relationships using embeddings...');

    // Step 1: Vectorize all hunks
    console.log('📊 Computing hunk embeddings...');
    const hunkData = await this.vectorizeHunks(changes);
    
    // Step 2: Cluster based on similarity
    console.log('🔗 Clustering based on similarity...');
    const clusters = await this.clusterBySimilarity(hunkData);
    
    // Step 3: Generate commit groups from clusters
    // Generating descriptive commits...
    const commitGroups = await this.generateCommitGroups(changes, clusters);
    
    // Step 4: Generate semantic summary
    const semanticSummary = this.createClusterSummary(clusters);
    
    console.log(`📊 Created ${commitGroups.length} semantic groups from ${clusters.length} clusters`);
    return [commitGroups, semanticSummary];
  }


  /**
   * Group changes using heuristic rules as fallback
   */
  private async groupChangesHeuristic(changes: FileChange[], semanticSummary: string = ''): Promise<CommitGroup[]> {
    const groups: Record<string, FileChange[]> = {};

    for (const change of changes) {
      const groupKey = this.determineGroupKey(change.file_path);

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }

      groups[groupKey].push(change);
    }

    const commitGroups: CommitGroup[] = [];
    for (const [groupKey, fileChanges] of Object.entries(groups)) {
      const { title, message } = await this.cerebras.generateCommitMessage(fileChanges, groupKey, semanticSummary);

      commitGroups.push({
        feature_name: groupKey,
        description: `Changes related to ${groupKey}`,
        files: fileChanges,
        hunks: fileChanges.flatMap(file => file.hunks || []),
        commit_title: title,
        commit_message: message
      });
    }

    return commitGroups;
  }

  /**
   * Determine the logical group for a file based on path
   */
  private determineGroupKey(filePath: string): string {
    const pathParts = filePath.split(path.sep);

    // Group by top-level directory
    if (pathParts.length > 1) {
      const topDir = pathParts[0].toLowerCase();
      if (['frontend', 'client', 'ui', 'src', 'components'].includes(topDir)) {
        return 'frontend';
      } else if (['backend', 'server', 'api', 'services'].includes(topDir)) {
        return 'backend';
      } else if (['docs', 'documentation', 'readme'].includes(topDir)) {
        return 'documentation';
      } else if (['tests', 'test', 'spec'].includes(topDir)) {
        return 'testing';
      } else if (['config', 'conf', 'settings'].includes(topDir)) {
        return 'configuration';
      } else if (['scripts', 'tools', 'utils'].includes(topDir)) {
        return 'utilities';
      }
    }

    // Group by file extension
    const fileExt = path.extname(filePath).toLowerCase();
    if (['.py', '.js', '.ts', '.jsx', '.tsx', '.java', '.cpp', '.c'].includes(fileExt)) {
      return 'code';
    } else if (['.md', '.txt', '.rst'].includes(fileExt)) {
      return 'documentation';
    } else if (['.json', '.yaml', '.yml', '.toml', '.ini'].includes(fileExt)) {
      return 'configuration';
    }

    return 'other';
  }

  /**
   * Apply hunks to create a patch and stage it using git add --patch
   */
  private async applyHunks(hunks: DiffHunk[]): Promise<void> {
    // Group hunks by file, filtering out invalid paths like /dev/null
    const hunksByFile = new Map<string, DiffHunk[]>();
    for (const hunk of hunks) {
      // Skip invalid paths like /dev/null (used for deleted files)
      if (hunk.filePath === '/dev/null' || hunk.filePath.includes('/dev/null')) {
        continue;
      }
      
      if (!hunksByFile.has(hunk.filePath)) {
        hunksByFile.set(hunk.filePath, []);
      }
      hunksByFile.get(hunk.filePath)!.push(hunk);
    }

    // Apply hunks for each file using git add --patch
    for (const [filePath, fileHunks] of hunksByFile) {
      try {
        // Check if this is a deleted file
        const changeType = await this.determineChangeType(filePath);
        
        if (changeType === 'deleted') {
          // For deleted files, use git rm
          await execAsync(`git rm "${filePath}"`);
          continue;
        }
        
        // For new files (no hunks), stage the entire file
        if (changeType === 'added' || fileHunks.length === 0) {
          console.log(`   📁 Staging new file: ${filePath}`);
          await execAsync(`git add "${filePath}"`);
          continue;
        }
        
        // Check if file has unstaged changes
        const { stdout: diffOutput } = await execAsync(`git diff --unified=3 -- "${filePath}"`);
        
        if (!diffOutput.trim()) {
          // No unstaged changes, stage entire file
          await execAsync(`git add "${filePath}"`);
          continue;
        }

        // Use git add --patch with automated responses
        await this.stageHunksInteractively(filePath, fileHunks);
        
      } catch (error) {
        console.error(`   ❌ Error staging ${filePath}:`, error);
        // Fallback: stage the entire file if selective staging fails
        try {
          await execAsync(`git add "${filePath}"`);
        } catch (fallbackError) {
          console.error(`   ❌ Fallback failed for ${filePath}:`, fallbackError);
        }
      }
    }
  }

  /**
   * Stage specific hunks using git add --patch with automated input
   */
  private async stageHunksInteractively(filePath: string, targetHunks: DiffHunk[]): Promise<void> {
    // Get all unstaged hunks in the file to determine which ones to accept/reject
    const { stdout: diffOutput } = await execAsync(`git diff --unified=3 "${filePath}"`);
    const parsedDiff = parse(diffOutput);
    
    if (parsedDiff.length === 0) {
      throw new Error(`No unstaged changes found in ${filePath}`);
    }
    
    const file = parsedDiff[0];
    const allUnstagedHunks = file.chunks;
    
    // Create input string for git add --patch
    // 'y' = yes (stage this hunk), 'n' = no (skip this hunk), 'q' = quit
    let patchInput = '';
    
    for (const hunk of allUnstagedHunks) {
      // Check if this hunk should be staged by comparing with our target hunks
      const shouldStage = targetHunks.some(targetHunk => 
        targetHunk.oldStart === hunk.oldStart && 
        targetHunk.newStart === hunk.newStart &&
        targetHunk.oldLines === hunk.oldLines &&
        targetHunk.newLines === hunk.newLines
      );
      
      patchInput += shouldStage ? 'y\n' : 'n\n';
    }
    
    // Add 'q' to quit at the end
    patchInput += 'q\n';
    
    console.log(`   🔧 Staging ${targetHunks.length} hunks for ${filePath} (${patchInput.replace(/\n/g, ' ').trim()})`);
    
    // Execute git add --patch with automated input using spawn for better control
    try {
      const { spawn } = require('child_process');
      
      await new Promise<void>((resolve, reject) => {
        const gitProcess = spawn('git', ['add', '--patch', filePath], {
          stdio: ['pipe', 'pipe', 'pipe'],
          env: { ...process.env, GIT_EDITOR: 'true' }
        });
        
        // Send automated responses
        gitProcess.stdin.write(patchInput);
        gitProcess.stdin.end();
        
        let stdout = '';
        let stderr = '';
        
        gitProcess.stdout.on('data', (data: any) => {
          stdout += data.toString();
        });
        
        gitProcess.stderr.on('data', (data: any) => {
          stderr += data.toString();
        });
        
        gitProcess.on('close', (code: number | null) => {
          if (code === 0) {
            console.log(`   ✅ Successfully staged hunks for ${filePath}`);
            resolve();
          } else {
            console.error(`   ❌ git add --patch failed for ${filePath}: ${stderr}`);
            reject(new Error(`git add --patch failed with code ${code}. stderr: ${stderr}`));
          }
        });
        
        gitProcess.on('error', (error: Error) => {
          reject(error);
        });
      });
      
    } catch (error) {
      // If interactive patch fails, fall back to staging entire file
      console.log(`   ⚠️  Interactive patch failed for ${filePath}, falling back to full file staging`);
      await execAsync(`git add "${filePath}"`);
    }
  }

  /**
   * Execute the commit splitting process using hunk-based commits
   */
  private async executeCommitSplitting(commitGroups: CommitGroup[], autoPush: boolean = false): Promise<boolean> {
    console.log('🎯 Executing hunk-based commit splitting...');
    console.log(`📊 Total commit groups to process: ${commitGroups.length}`);

    // Store current branch name
    let currentBranch: string;
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
      currentBranch = stdout.trim();
      // Current branch: ${currentBranch}
    } catch (error) {
      console.error(`❌ Error getting current branch: ${error}`);
      return false;
    }

    // Create a backup branch before making changes
    const backupBranch = `backup-before-split-${Date.now()}`;
    try {
      await execAsync(`git checkout -b ${backupBranch}`);
      await execAsync(`git checkout ${currentBranch}`);
      // Created backup branch: ${backupBranch}
    } catch (error) {
      console.error(`❌ Error creating backup branch: ${error}`);
      return false;
    }

    let successfulCommits = 0;

    for (let i = 0; i < commitGroups.length; i++) {
      const group = commitGroups[i];
      console.log(`\n--- Processing Group ${i + 1}/${commitGroups.length} ---`);
      console.log(`Feature: ${group.feature_name}`);
      console.log(`Title: ${group.commit_title}`);
      console.log(`Hunks: ${group.hunks.length} hunks across ${[...new Set(group.hunks.map(h => h.filePath))].length} files`);

      try {
        // Reset staging area
        await execAsync('git reset');

        // Apply only the hunks for this group
        if (group.hunks.length > 0) {
          await this.applyHunks(group.hunks);
        } else {
          console.log(`   ⚠️  No hunks to apply for group ${group.feature_name}, falling back to full files`);
          // Fallback to staging full files if no hunks
        for (const fileChange of group.files) {
          const filePath = fileChange.file_path;
          if (fileChange.change_type === 'deleted') {
              await execAsync(`git rm "${filePath}"`);
          } else {
              await execAsync(`git add "${filePath}"`);
            }
          }
        }

        // Check if there are any staged changes
        const { stdout: stagedFiles } = await execAsync('git diff --cached --name-only');

        if (!stagedFiles.trim()) {
          console.log(`   ⚠️  No changes to commit for group ${group.feature_name}`);
          console.log(`   🔍 Debug: Group has ${group.hunks.length} hunks, but no staged changes`);
          console.log(`   🔍 Debug: Group files: ${group.files.map(f => f.file_path).join(', ')}`);
          
          // Try to stage the entire files as a fallback
          console.log(`   🔄 Attempting fallback: staging entire files...`);
          for (const fileChange of group.files) {
            const filePath = fileChange.file_path;
            try {
              if (fileChange.change_type === 'deleted') {
                await execAsync(`git rm "${filePath}"`);
              } else {
                await execAsync(`git add "${filePath}"`);
              }
              console.log(`   ✅ Fallback staged: ${filePath}`);
            } catch (error) {
              console.error(`   ❌ Fallback failed for ${filePath}:`, error);
            }
          }
          
          // Check again if we have staged changes
          const { stdout: stagedFilesAfterFallback } = await execAsync('git diff --cached --name-only');
          if (!stagedFilesAfterFallback.trim()) {
            console.log(`   ❌ Still no changes to commit after fallback for group ${group.feature_name}`);
            continue;
          }
        }

        // Create commit with title and message
        const commitMessage = `${group.commit_title}\n\n${group.commit_message}`;
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        // Created commit: ${group.commit_title}
        successfulCommits++;

      } catch (error) {
        console.error(`   ❌ Error creating commit for group ${group.feature_name}:`, error);
        continue;
      }
    }

    console.log(`\n📊 Hunk-based commit splitting completed!`);
    console.log(`✅ Successfully created ${successfulCommits} commits out of ${commitGroups.length} groups`);

    // Push commits if requested
    if (autoPush && successfulCommits > 0) {
      console.log(`\n🚀 Pushing commits to remote...`);
      try {
        await execAsync(`git push origin ${currentBranch}`);
        console.log(`✅ Successfully pushed ${successfulCommits} commits to ${currentBranch}`);
      } catch (error) {
        console.error(`❌ Error pushing commits: ${error}`);
        console.log(`💡 You can manually push using: git push origin ${currentBranch}`);
        return false;
      }
    }

    console.log(`\n💾 Backup branch created: ${backupBranch}`);
    console.log(`💡 To revert all changes: git reset --hard ${backupBranch}`);

    return successfulCommits > 0;
  }

  /**
   * Main method to run the intelligent commit splitting process
   */
  async runIntelligentSplitting(autoPush: boolean = false): Promise<CommitGroup[]> {
    console.log('🚀 Starting Intelligent Commit Splitting Analysis...');

    // Change to git root directory to ensure all git operations work correctly
    const gitRoot = await this.getGitRoot();
    if (gitRoot !== process.cwd()) {
      console.log(`📍 Changing to git root directory: ${gitRoot}`);
      process.chdir(gitRoot);
    }

    // Step 1: Extract all file changes
    console.log('📊 Step 1: Extracting file changes...');
    const changes = await this.extractChanges();
    console.log(`Found ${changes.length} files with changes`);

    if (!changes.length) {
      console.log('No changes detected in git diff');
      return [];
    }

    // Step 2: Vectorize hunks using embeddings 
    console.log('📊 Step 2: Vectorizing hunks using embeddings...');

    try {
      // Step 3: Analyze semantic relationships
      console.log('🔍 Step 3: Analyzing semantic relationships...');
      const [commitGroups, semanticSummary] = await this.analyzeSemanticRelationships(changes);
      console.log(`Identified ${commitGroups.length} logical commit groups`);

      if (semanticSummary) {
        // Semantic analysis summary generated
      }

      // Step 4: Display results
      console.log('\n📋 Commit Groups Identified:');
      for (let i = 0; i < commitGroups.length; i++) {
        const group = commitGroups[i];
        console.log(`\n${i + 1}. ${group.feature_name}`);
        console.log(`   Title: ${group.commit_title}`);
        console.log(`   Description: ${group.commit_message}`);
        console.log(`   Files: ${group.files.map(f => f.file_path)}`);
        console.log(`   Hunks: ${group.hunks.length} hunks across ${[...new Set(group.hunks.map(h => h.filePath))].length} files`);
      }

        await this.executeCommitSplitting(commitGroups, autoPush);

      return commitGroups;

    } catch (error) {
      console.error(`❌ Error during analysis: ${error}`);
      // Analysis failed
      throw error;
    }
  }

  /**
   * Cluster hunks by similarity using embeddings
   */
  private async clusterBySimilarity(hunkData: Array<{hunk: DiffHunk, embedding: number[], changeIndex: number}>): Promise<Array<{hunks: Array<{hunk: DiffHunk, changeIndex: number}>, avgSimilarity: number}>> {
    console.log(`🔗 Clustering ${hunkData.length} hunks using cosine similarity...`);
    
    const clusters: Array<{hunks: Array<{hunk: DiffHunk, changeIndex: number}>, avgSimilarity: number}> = [];
    const processed = new Set<number>();
    // Change similarity threshold to be much less sensitive
    const similarityThreshold = 0.3; // 30% similarity is enough to group
    
    for (let i = 0; i < hunkData.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster: Array<{hunk: DiffHunk, changeIndex: number}> = [
        { hunk: hunkData[i].hunk, changeIndex: hunkData[i].changeIndex }
      ];
      const similarities: number[] = [];
      
      // Find similar hunks using cosine similarity
      for (let j = i + 1; j < hunkData.length; j++) {
        if (processed.has(j)) continue;
        
        const similarity = this.cosineSimilarity(hunkData[i].embedding, hunkData[j].embedding);
        
        if (similarity > similarityThreshold) {
          cluster.push({ hunk: hunkData[j].hunk, changeIndex: hunkData[j].changeIndex });
          similarities.push(similarity);
          processed.add(j);
        }
      }
      
      processed.add(i);
      
      // Create clusters for both single and multiple hunks
      const avgSimilarity = similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 1.0;
      clusters.push({ hunks: cluster, avgSimilarity });
    }
    
    // Found ${clusters.length} similarity clusters
    return clusters;
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) return 0;
    
    return dotProduct / (magnitudeA * magnitudeB);
  }

  /**
   * Generate commit groups from clustered hunks
   */
  private async generateCommitGroups(
    changes: FileChange[],
    clusters: Array<{hunks: Array<{hunk: DiffHunk, changeIndex: number}>, avgSimilarity: number}>
  ): Promise<CommitGroup[]> {
    // Generating commit groups from ${clusters.length} clusters...
    
    const commitGroups: CommitGroup[] = [];
    const processedHunks = new Set<string>();
    
    // Process each cluster
    for (let i = 0; i < clusters.length; i++) {
      const cluster = clusters[i];
      
      // Extract hunks and associated files
      const clusterHunks = cluster.hunks.map(h => h.hunk);
      const changeIndices = new Set<number>(cluster.hunks.map(h => h.changeIndex));
      const groupFiles = Array.from(changeIndices).map(idx => changes[idx]);
      
      // Generate commit message using LLM
      const clusterContext = `Cluster ${i + 1}: ${cluster.hunks.length} related hunks with ${(cluster.avgSimilarity * 100).toFixed(1)}% similarity`;
      
      try {
        console.log(`🤖 Generating commit message for cluster ${i + 1}...`);
        const response = await this.cerebras.generateCommitMessage(groupFiles, `cluster_${i + 1}`, clusterContext);
        console.log(`📊 Full response structure:`, JSON.stringify(response, null, 2));
        let content = '';
        if (response?.title && response?.message) {
          content = `${response.title}\n\n${response.message}`.trim();
        } else {
          console.error('❌ Invalid response structure:', response);
          throw new Error('LLM returned invalid response structure');
        }
        // Generated: "${content}"
        
        // Increase rate limit delay for Cerebras API
        if (i < clusters.length - 1) {
          // Waiting to respect rate limits...
          await new Promise(resolve => setTimeout(resolve, 3000));
        }
        
        commitGroups.push({
          feature_name: `semantic_cluster_${i + 1}`,
          description: clusterContext,
          files: groupFiles,
          hunks: clusterHunks,
          commit_title: content.split('\n')[0].replace(/^feat:/, '').trim(),
          commit_message: content.replace(/^feat:/, '').trim()
        });
      } catch (error) {
        console.error(`❌ Failed to generate commit message for cluster ${i + 1}:`, error);
        commitGroups.push({
          feature_name: `semantic_cluster_${i + 1}`,
          description: clusterContext,
          files: groupFiles,
          hunks: clusterHunks,
          commit_title: `feat: cluster_${i + 1}`,
          commit_message: `Changes related to cluster_${i + 1}`
        });
      }
      
      // Mark hunks as processed
      clusterHunks.forEach(hunk => {
        const hunkId = `${hunk.filePath}:${hunk.oldStart}-${hunk.newStart}`;
        processedHunks.add(hunkId);
      });
    }
    
    // Handle remaining unprocessed hunks and files without hunks (like new files)
    const allHunks = changes.flatMap(change => change.hunks || []);
    const remainingHunks = allHunks.filter(hunk => {
      const hunkId = `${hunk.filePath}:${hunk.oldStart}-${hunk.newStart}`;
      return !processedHunks.has(hunkId);
    });
    
    // Find files that have no hunks (like new files) or have unprocessed hunks
    const processedFileIndices = new Set<number>();
    clusters.forEach(cluster => {
      cluster.hunks.forEach(h => processedFileIndices.add(h.changeIndex));
    });
    
    const unprocessedFiles = changes.filter((change, index) => 
      !processedFileIndices.has(index) || 
      change.hunks?.some(hunk => {
        const hunkId = `${hunk.filePath}:${hunk.oldStart}-${hunk.newStart}`;
        return !processedHunks.has(hunkId);
      })
    );
    
    if (unprocessedFiles.length > 0) {
      console.log(`🔧 Processing ${unprocessedFiles.length} unprocessed files heuristically (including new files without hunks)...`);
      const heuristicGroups = await this.groupChangesHeuristic(unprocessedFiles);
      // Add remaining hunks to heuristic groups
      heuristicGroups.forEach(group => {
        group.hunks = group.files.flatMap(file => file.hunks || []);
      });
      commitGroups.push(...heuristicGroups);
    }
    
    return commitGroups;
  }

  /**
   * Create summary of clustering results
   */
  private createClusterSummary(
    clusters: Array<{hunks: Array<{hunk: DiffHunk, changeIndex: number}>, avgSimilarity: number}>
  ): string {
    const summary = ['Semantic Analysis Summary (Embedding-based):\n'];
    
    summary.push(`Found ${clusters.length} similarity clusters:`);
    clusters.forEach((cluster, i) => {
      summary.push(`  Cluster ${i + 1}: ${cluster.hunks.length} hunks (${(cluster.avgSimilarity * 100).toFixed(1)}% avg similarity)`);
      const files = [...new Set(cluster.hunks.map(h => path.basename(h.hunk.filePath)))];
      summary.push(`    Files: ${files.join(', ')}`);
    });
    
    return summary.join('\n');
  }

}