import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { SupermemoryClient } from './supermemoryClient';
import { CerebrasLLM } from './cerebrasLLM';
import { FileChange, CommitGroup } from './types';

const execAsync = promisify(exec);

/**
 * Main class for intelligent commit splitting
 */
export class IntelligentCommitSplitter {
  private supermemory: SupermemoryClient;
  private cerebras: CerebrasLLM;
  private sessionId: string;

  constructor(supermemoryApiKey: string, cerebrasApiKey: string) {
    this.supermemory = new SupermemoryClient(supermemoryApiKey);
    this.cerebras = new CerebrasLLM(cerebrasApiKey);
    this.sessionId = `commit_split_${process.pid}`;
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
      const { stdout } = await execAsync(`git diff --unified=3 ${filePath}`);
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
      // Check if file exists in working directory using git ls-files
      const { stdout } = await execAsync(`git ls-files ${filePath}`);
      const fileExistsInGit = stdout.trim() !== '';

      // Check if file exists in HEAD
      const headContent = await this.getFileContent(filePath, 'HEAD');

      if (!fileExistsInGit && headContent === null) {
        return 'added';
      } else if (fileExistsInGit && headContent === null) {
        return 'deleted';
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
      const changeType = await this.determineChangeType(filePath);
      const diffContent = await this.getFileDiff(filePath);

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

      changes.push({
        file_path: filePath,
        change_type: changeType,
        before_content: beforeContent || undefined,
        after_content: afterContent || undefined,
        diff_content: diffContent,
        total_lines_added: linesAdded,
        total_lines_removed: linesRemoved
      });
    }

    return changes;
  }

  /**
   * Upload before/after file contents to Supermemory for semantic analysis
   */
  private async uploadToSupermemory(changes: FileChange[]): Promise<string[]> {
    console.log('📤 Uploading file contents to Supermemory for semantic analysis...');

    const memoryIds: string[] = [];

    for (const change of changes) {
      // Upload before content if it exists
      if (change.before_content) {
        console.log(`   📤 Uploading before content for ${change.file_path}`);
        try {
          const response = await this.supermemory.addMemory(
            change.before_content,
            {
              file_path: change.file_path,
              type: 'before',
              change_type: change.change_type,
              session_id: this.sessionId
            },
            [this.sessionId, 'before']
          );
          memoryIds.push(response.id);
          console.log(`   ✅ Uploaded before content, ID: ${response.id}`);
        } catch (error) {
          console.log(`   ❌ Failed to upload before content: ${error}`);
        }
      }

      // Upload after content if it exists
      if (change.after_content) {
        console.log(`   📤 Uploading after content for ${change.file_path}`);
        try {
          const response = await this.supermemory.addMemory(
            change.after_content,
            {
              file_path: change.file_path,
              type: 'after',
              change_type: change.change_type,
              session_id: this.sessionId
            },
            [this.sessionId, 'after']
          );
          memoryIds.push(response.id);
          console.log(`   ✅ Uploaded after content, ID: ${response.id}`);
        } catch (error) {
          console.log(`   ❌ Failed to upload after content: ${error}`);
        }
      }

      // Upload diff content
      if (change.diff_content) {
        console.log(`   📤 Uploading diff content for ${change.file_path}`);
        try {
          const response = await this.supermemory.addMemory(
            change.diff_content,
            {
              file_path: change.file_path,
              type: 'diff',
              change_type: change.change_type,
              session_id: this.sessionId,
              lines_added: change.total_lines_added,
              lines_removed: change.total_lines_removed
            },
            [this.sessionId, 'diff']
          );
          memoryIds.push(response.id);
          console.log(`   ✅ Uploaded diff content, ID: ${response.id}`);
        } catch (error) {
          console.log(`   ❌ Failed to upload diff content: ${error}`);
        }
      }
    }

    return memoryIds;
  }

  /**
   * Use Supermemory to analyze semantic relationships and group changes
   */
  private async analyzeSemanticRelationships(changes: FileChange[]): Promise<[CommitGroup[], string]> {
    console.log('🔍 Analyzing semantic relationships between changes...');

    // Query Supermemory to understand feature relationships with summaries
    const queries = [
      'What changes implement the same feature?',
      'What is the logical separation between these changes?',
      'Group these file changes by functionality and purpose',
      'Which changes are related to the same user-facing feature?'
    ];

    const allResults: any[] = [];
    let semanticSummary = '';

    for (const query of queries) {
      try {
        const results = await this.supermemory.searchMemories(
          query,
          20,
          {
            AND: [
              {
                key: 'session_id',
                value: this.sessionId
              }
            ]
          },
          true
        );
        allResults.push(results);

        // Extract summary if available
        if (results.summary) {
          semanticSummary += `Query: ${query}\nSummary: ${results.summary}\n\n`;
        }
      } catch (error) {
        console.error('Error querying Supermemory:', error);
        // Continue with heuristic grouping if search fails
        console.log('⚠️ Search failed, continuing with heuristic grouping...');
      }
    }

    // Analyze results to group files
    // For now, use a simple heuristic-based grouping
    // In a full implementation, you'd parse the semantic analysis results
    const commitGroups = this.groupChangesHeuristic(changes, semanticSummary);

    return [commitGroups, semanticSummary];
  }

  /**
   * Group changes using heuristic rules as fallback
   */
  private async groupChangesHeuristic(changes: FileChange[], semanticSummary: string = ''): Promise<CommitGroup[]> {
    const groups: Record<string, FileChange[]> = {};

    for (const change of changes) {
      // Determine group based on file path and type
      const groupKey = this.determineGroupKey(change.file_path);

      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }

      groups[groupKey].push(change);
    }

    // Convert to CommitGroup objects
    const commitGroups: CommitGroup[] = [];
    for (const [groupKey, fileChanges] of Object.entries(groups)) {
      // Generate commit message using LLM with semantic context
      const { title, message } = await this.cerebras.generateCommitMessage(fileChanges, groupKey, semanticSummary);

      commitGroups.push({
        feature_name: groupKey,
        description: `Changes related to ${groupKey}`,
        files: fileChanges,
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
   * Execute the commit splitting process by creating separate git commits
   */
  private async executeCommitSplitting(commitGroups: CommitGroup[], autoPush: boolean = false): Promise<boolean> {
    console.log('🎯 Executing commit splitting...');
    console.log(`📊 Total commit groups to process: ${commitGroups.length}`);

    // Store current branch name
    let currentBranch: string;
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD');
      currentBranch = stdout.trim();
      console.log(`📍 Current branch: ${currentBranch}`);
    } catch (error) {
      console.error(`❌ Error getting current branch: ${error}`);
      return false;
    }

    // Create a backup branch before making changes
    const backupBranch = `backup-before-split-${process.pid}`;
    try {
      await execAsync(`git checkout -b ${backupBranch}`);
      await execAsync(`git checkout ${currentBranch}`);
      console.log(`💾 Created backup branch: ${backupBranch}`);
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
      console.log(`Files: ${group.files.map(f => f.file_path)}`);

      try {
        // Reset staging area
        await execAsync('git reset');

        // Stage only the files for this group
        for (const fileChange of group.files) {
          const filePath = fileChange.file_path;

          if (fileChange.change_type === 'deleted') {
            // Remove file from git tracking
            await execAsync(`git rm ${filePath}`);
            console.log(`   🗑️  Staged deletion: ${filePath}`);
          } else {
            // Add file to staging
            await execAsync(`git add ${filePath}`);
            console.log(`   ➕ Staged: ${filePath}`);
          }
        }

        // Check if there are any staged changes
        const { stdout: stagedFiles } = await execAsync('git diff --cached --name-only');

        if (!stagedFiles.trim()) {
          console.log(`   ⚠️  No changes to commit for group ${group.feature_name}`);
          continue;
        }

        // Create commit with title and message
        const commitMessage = `${group.commit_title}\n\n${group.commit_message}`;

        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`);

        console.log(`   ✅ Created commit: ${group.commit_title}`);
        successfulCommits++;

      } catch (error) {
        console.error(`   ❌ Error creating commit for group ${group.feature_name}:`, error);
        continue;
      }
    }

    console.log(`\n📊 Commit splitting completed!`);
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

    // Step 2: Upload to Supermemory for semantic analysis
    console.log('📤 Step 2: Uploading to Supermemory for semantic analysis...');
    const memoryIds = await this.uploadToSupermemory(changes);

    try {
      // Step 3: Analyze semantic relationships
      console.log('🔍 Step 3: Analyzing semantic relationships...');
      const [commitGroups, semanticSummary] = await this.analyzeSemanticRelationships(changes);
      console.log(`Identified ${commitGroups.length} logical commit groups`);

      if (semanticSummary) {
        console.log(`📝 Semantic analysis summary generated (${semanticSummary.length} chars)`);
      }

      // Step 4: Display results
      console.log('\n📋 Commit Groups Identified:');
      for (let i = 0; i < commitGroups.length; i++) {
        const group = commitGroups[i];
        console.log(`\n${i + 1}. ${group.feature_name}`);
        console.log(`   Title: ${group.commit_title}`);
        console.log(`   Description: ${group.commit_message}`);
        console.log(`   Files: ${group.files.map(f => f.file_path)}`);
      }

      // Step 5: Clean up memories after analysis and LLM generation
      if (memoryIds.length) {
        await this.supermemory.deleteMemoriesBatch(memoryIds);
      }

      // Step 6: Execute if requested
      if (autoPush) {
        await this.executeCommitSplitting(commitGroups, autoPush);
      }

      return commitGroups;

    } catch (error) {
      console.error(`❌ Error during analysis: ${error}`);
      // Clean up memories even if analysis fails
      if (memoryIds.length) {
        await this.supermemory.deleteMemoriesBatch(memoryIds);
      }
      throw error;
    }
  }
}
