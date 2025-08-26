import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import * as fs from 'fs';
import { SupermemoryClient } from './supermemoryClient';
import { CerebrasLLM } from './cerebrasLLM';
import { FileChange, CommitGroup, DiffHunk, SemanticRelationship, CodeContext } from './types';
import  parse  from "parse-diff";

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
   * Get git diff hunks from the files, and group diff by hunks
   */
  async getGitDiffHunks(filePath: string): Promise<DiffHunk[]> {
    const { stdout: stdoutStaged } = await execAsync(`git diff --cached --unified=3 ${filePath}`);
    const { stdout: stdoutUnstaged } = await execAsync(`git diff --unified=3 ${filePath}`);
    const diffStaged = parse(stdoutStaged);
    const diffUnstaged = parse(stdoutUnstaged);
    const hunks: DiffHunk[] = [];

    for (const file of diffStaged) {
      for (const hunk of file.chunks) {
        hunks.push({
          filePath: file.to || file.from || '',
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
      for (const hunk of file.chunks) {
        hunks.push({
          filePath: file.to || file.from || '',
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
   * Upload before/after file contents to Supermemory for semantic analysis
   */
  private async uploadToSupermemory(changes: FileChange[]): Promise<string[]> {
    console.log('📤 Uploading file contents to Supermemory for semantic analysis...');

    const memoryIds: string[] = [];

    for (const change of changes) {
      // Upload before content if it exists
      if (change.hunks) {
        for (const hunk of change.hunks) {
          const memory = await this.supermemory.addMemory(hunk.context, {
            file_path: hunk.filePath,
            change_type: change.change_type,
            old_start: hunk.oldStart,
            old_lines: hunk.oldLines,
            new_start: hunk.newStart,
            new_lines: hunk.newLines,
            header: hunk.header,
            content: JSON.stringify(hunk.content),
            context: hunk.context
          });
          memoryIds.push(memory.id);
        }
      }
    }

    return memoryIds;
  }

  /**
   * Use hybrid approach with embeddings and LLM-generated queries
   */
  private async analyzeSemanticRelationships(changes: FileChange[]): Promise<[CommitGroup[], string]> {
    console.log('🔍 Analyzing semantic relationships using hybrid approach...');

    // Step 1: Generate embedding-based similarity clusters
    console.log('📊 Computing hunk embeddings and similarity clusters...');
    const embeddingClusters = await this.clusterByEmbeddings(changes);
    
    // Step 2: Use LLM to generate smart queries for Supermemory
    console.log('🤖 Generating targeted queries using LLM...');
    const smartQueries = await this.generateLLMQueries(changes);
    
    // Step 3: Find explicit relationships via Supermemory
    console.log('🔍 Searching for explicit relationships...');
    const explicitRelationships = await this.searchExplicitRelationships(smartQueries);
    
    // Step 4: Combine embedding clusters with explicit relationships
    console.log('🔗 Merging similarity and explicit relationships...');
    const finalGroups = await this.mergeClustersAndRelationships(changes, embeddingClusters, explicitRelationships);
    
    // Step 5: Generate semantic summary
    const semanticSummary = this.createSemanticSummary(embeddingClusters, explicitRelationships);
    
    console.log(`📊 Created ${finalGroups.length} semantic groups from ${embeddingClusters.length} clusters and ${explicitRelationships.length} relationships`);
    return [finalGroups, semanticSummary];
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

  /**
   * Cluster hunks by embeddings using cosine similarity
   */
  private async clusterByEmbeddings(changes: FileChange[]): Promise<Array<{files: string[]; similarity: number; evidence: string}>> {
    // For now, use a simple text-based similarity as placeholder for embeddings
    // In a real implementation, you'd use a code embedding model like CodeBERT
    const clusters: Array<{files: string[]; similarity: number; evidence: string}> = [];
    const processed = new Set<string>();
    
    for (let i = 0; i < changes.length; i++) {
      if (processed.has(changes[i].file_path)) continue;
      const cluster = [changes[i].file_path];
      const baseContent = changes[i].hunks?.map(h => h.content.join('\n')).join('\n') || '';
      
      // Find similar hunks (this is a simplified version - real implementation would use embeddings)
      for (let j = i + 1; j < changes.length; j++) {
        if (processed.has(changes[j].file_path)) continue;
        
        const compareContent = changes[j].hunks?.map(h => h.content.join('\n')).join('\n');
        const similarity = this.calculateTextSimilarity(baseContent, compareContent || '');
        
        if (similarity > 0.4) {
          cluster.push(changes[j].file_path);
          processed.add(changes[j].file_path);
        }
      }
      
      processed.add(changes[i].file_path);
      
      if (cluster.length > 1) {
        clusters.push({
          files: cluster,
          similarity: 0.6, // Would be actual cosine similarity from embeddings
          evidence: `${cluster.length} files with similar code patterns`
        });
      }
    }
    
    return clusters;
  }

  /**
   * Use LLM to generate smart, targeted queries
   */
  private async generateLLMQueries(changes: FileChange[]): Promise<Array<{query: string; relevantFiles: string[]}>> {
    // Batch hunks to optimize token usage
    const hunkSummaries: string[] = [];
    const fileMapping: string[] = [];
    
    for (const change of changes) {
      const summary = `File: ${change.file_path}\n` + 
        change.hunks?.map((h, i) => 
          `Hunk ${i + 1}: ${h.content.join('\n').substring(0, 200)}...`
        ).join('\n');
      hunkSummaries.push(summary);
      fileMapping.push(change.file_path);
    }
    
    // Use LLM to generate queries in batches
    const queries: Array<{query: string; relevantFiles: string[]}> = [];
    const batchSize = 5; // Process 5 files at a time to manage tokens
    
    for (let i = 0; i < hunkSummaries.length; i += batchSize) {
      const batch = hunkSummaries.slice(i, i + batchSize);
      const batchFiles = fileMapping.slice(i, i + batchSize);
      
      const prompt = `Analyze these code changes and generate 2-3 specific search queries to find related code:

${batch.join('\n---\n')}

Generate queries that would help find:
1. Functions/methods that these changes might be calling or modifying
2. Code that imports or uses similar dependencies
3. Tests or configuration that might be related

Return queries as JSON array: [{"query": "search text", "files": ["file1.ts"]}]`;

      try {
        const response = await this.cerebras.generateText(prompt);
        const parsedQueries = this.parseQueryResponse(response, batchFiles);
        queries.push(...parsedQueries);
      } catch (error) {
        console.error('Error generating LLM queries:', error);
        // Fallback to simple queries
        queries.push({
          query: `Find code related to ${batchFiles.map(f => path.basename(f)).join(', ')}`,
          relevantFiles: batchFiles
        });
      }
    }
    
    return queries;
  }

  /**
   * Search for explicit relationships using generated queries
   */
  private async searchExplicitRelationships(
    queries: Array<{query: string; relevantFiles: string[]}>
  ): Promise<SemanticRelationship[]> {
    const relationships: SemanticRelationship[] = [];
    
    for (const queryGroup of queries) {
      try {
        const results = await this.supermemory.searchMemories(
          queryGroup.query,
          10,
          { AND: [{ key: 'session_id', value: this.sessionId }] },
          true
        );
        
        if (results && results.memories && results.memories.length >= 2) {
          // Extract file relationships from search results
          const mentionedFiles = new Set<string>();
          for (const memory of results.memories) {
            for (const file of queryGroup.relevantFiles) {
              if (memory.content?.includes(path.basename(file)) || memory.content?.includes(file)) {
                mentionedFiles.add(file);
              }
            }
          }
          
          // Create relationships between files found in results
          const fileArray = Array.from(mentionedFiles);
          for (let i = 0; i < fileArray.length; i++) {
            for (let j = i + 1; j < fileArray.length; j++) {
              relationships.push({
                type: 'calls', // Inferred from query-based relationship
                strength: Math.min(0.8, 0.4 + (results.memories.length * 0.05)),
                evidence: [
                  `Query: "${queryGroup.query}"`,
                  `Found in ${results.memories.length} related memories`,
                  results.summary ? `Context: ${results.summary.substring(0, 100)}...` : ''
                ].filter(Boolean),
                files: [fileArray[i], fileArray[j]]
              });
            }
          }
        }
      } catch (error) {
        console.error('Error searching explicit relationships:', error);
      }
    }
    
    return relationships;
  }

  /**
   * Merge embedding clusters with explicit relationships
   */
  private async mergeClustersAndRelationships(
    changes: FileChange[],
    embeddingClusters: Array<{files: string[]; similarity: number; evidence: string}>,
    explicitRelationships: SemanticRelationship[]
  ): Promise<CommitGroup[]> {
    const groups: CommitGroup[] = [];
    const processedFiles = new Set<string>();
    
    // Start with embedding clusters as base groups
    for (const cluster of embeddingClusters) {
      const groupFiles = changes.filter(c => cluster.files.includes(c.file_path));
      
      // Check if any explicit relationships strengthen this cluster
      const supportingRelationships = explicitRelationships.filter(rel =>
        cluster.files.includes(rel.files[0]) && cluster.files.includes(rel.files[1])
      );
      
      const groupName = this.generateClusterName(groupFiles, supportingRelationships);
      const evidence = [cluster.evidence];
      if (supportingRelationships.length > 0) {
        evidence.push(`${supportingRelationships.length} explicit relationships`);
      }
      
      const { title, message } = await this.cerebras.generateCommitMessage(
        groupFiles, 
        groupName,
        evidence.join('; ')
      );
      
      groups.push({
        feature_name: groupName,
        description: `Semantic cluster: ${evidence.join(', ')}`,
        files: groupFiles,
        commit_title: title,
        commit_message: message
      });
      
      cluster.files.forEach(f => processedFiles.add(f));
    }
    
    // Handle remaining files using explicit relationships
    const remainingChanges = changes.filter(c => !processedFiles.has(c.file_path));
    if (remainingChanges.length > 0) {
      console.log(`📝 Grouping ${remainingChanges.length} remaining files heuristically`);
      const heuristicGroups = await this.groupChangesHeuristic(remainingChanges);
      groups.push(...heuristicGroups);
    }
    
    return groups;
  }

  /**
   * Calculate simple text similarity (placeholder for embeddings)
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    // Simple word overlap - in real implementation, use cosine similarity of embeddings
    const words1 = new Set(text1.toLowerCase().match(/\w+/g) || []);
    const words2 = new Set(text2.toLowerCase().match(/\w+/g) || []);
    
    const intersection = new Set([...words1].filter(w => words2.has(w)));
    const union = new Set([...words1, ...words2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Parse LLM query response 
   */
  private parseQueryResponse(response: string, fallbackFiles: string[]): Array<{query: string; relevantFiles: string[]}> {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.map((q: any) => ({
          query: q.query || q.text || '',
          relevantFiles: q.files || fallbackFiles
        }));
      }
    } catch (error) {
      console.error('Error parsing LLM query response:', error);
    }
    
    // Fallback: extract queries from text
    const lines = response.split('\n').filter(line => 
      line.includes('query') || line.includes('search') || line.includes('find')
    );
    
    return lines.slice(0, 3).map(line => ({
      query: line.replace(/^\d+\.?\s*/, '').trim(),
      relevantFiles: fallbackFiles
    }));
  }

  /**
   * Generate cluster name based on files and relationships
   */
  private generateClusterName(files: FileChange[], relationships: SemanticRelationship[]): string {
    const paths = files.map(f => f.file_path);
    
    // Check relationship types
    const relationshipTypes = relationships.map(r => r.type);
    if (relationshipTypes.includes('calls')) return 'function_updates';
    if (relationshipTypes.includes('imports')) return 'dependency_changes';
    if (relationshipTypes.includes('tests')) return 'test_updates';
    
    // Check file patterns
    if (paths.some(p => p.includes('test'))) return 'testing';
    if (paths.some(p => p.includes('config'))) return 'configuration';
    if (paths.some(p => p.includes('component') || p.includes('.tsx'))) return 'ui_components';
    if (paths.some(p => p.includes('api'))) return 'api_changes';
    
    // Fallback to directory
    return this.findCommonDirectory(paths) || 'related_changes';
  }

  /**
   * Create semantic summary for LLM context
   */
  private createSemanticSummary(
    clusters: Array<{files: string[]; similarity: number; evidence: string}>,
    relationships: SemanticRelationship[]
  ): string {
    const summary = ['Semantic Analysis Summary:\n'];
    
    summary.push(`Found ${clusters.length} similarity clusters:`);
    clusters.forEach((cluster, i) => {
      summary.push(`  Cluster ${i + 1}: ${cluster.files.length} files (${(cluster.similarity * 100).toFixed(0)}% similar)`);
      summary.push(`    Files: ${cluster.files.map(f => path.basename(f)).join(', ')}`);
    });
    
    if (relationships.length > 0) {
      summary.push(`\nFound ${relationships.length} explicit relationships:`);
      const typeGroups = new Map<string, number>();
      relationships.forEach(r => typeGroups.set(r.type, (typeGroups.get(r.type) || 0) + 1));
      
      for (const [type, count] of typeGroups) {
        summary.push(`  ${type}: ${count} relationships`);
      }
    }
    
    return summary.join('\n');
  }

  /**
   * Find common directory among file paths
   */
  private findCommonDirectory(paths: string[]): string {
    if (paths.length === 0) return 'misc';
    if (paths.length === 1) return path.dirname(paths[0]).split('/').pop() || 'misc';
    
    const dirs = paths.map(p => path.dirname(p).split('/'));
    const minLength = Math.min(...dirs.map(d => d.length));
    
    for (let i = 0; i < minLength; i++) {
      const commonDir = dirs[0][i];
      if (!dirs.every(d => d[i] === commonDir)) {
        return dirs[0][i - 1] || 'misc';
      }
    }
    
    return dirs[0][minLength - 1] || 'misc';
  }
}