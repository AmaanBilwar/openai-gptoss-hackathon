"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Process commit embeddings
 */
export const processCommitEmbeddings = action({
  args: {
    repoId: v.number(),
    sha: v.string(),
    commitData: v.any(),
    hunks: v.optional(v.array(v.any())),
    summaries: v.optional(v.array(v.any())),
  },
  handler: async (ctx, args): Promise<{
    hunkCount: number;
    embeddingCount: number;
    processingTimeMs: number;
  }> => {
    const startTime = Date.now();
    try {
      console.log(`🔄 Processing embeddings for commit ${args.sha.substring(0, 8)}`);

      // Parse commit diff to get hunks
      const parsedHunks = await ctx.runAction(internal.actions.github.parseCommitDiff, {
        repoId: args.repoId,
        sha: args.sha,
        commitData: args.commitData,
      });

      // Generate summaries for hunks
      const hunkSummaries = await ctx.runAction(internal.actions.summarize.generateHunkSummaries, {
        hunks: parsedHunks.hunks,
        commitMessage: args.commitData.commit?.message || "No message",
      });

      // Generate embeddings for hunks
      const hunkEmbeddings = await ctx.runAction(internal.actions.embeddings.generateHunkEmbeddings, {
        repoId: args.repoId,
        sha: args.sha,
        hunks: parsedHunks.hunks,
        summaries: hunkSummaries.summaries,
        commitMessage: args.commitData.commit?.message || "No message",
      });

      // Store everything in the database
      await ctx.runMutation(internal.commits.upsertCommitWithFilesAndHunks, {
        repoId: args.repoId,
        commit: args.commitData,
        files: parsedHunks.files,
        hunks: parsedHunks.hunks,
        summaries: hunkSummaries.summaries,
        embeddings: hunkEmbeddings.embeddings,
      });

      console.log(`✅ Commit ${args.sha.substring(0, 8)} processed: ${hunkEmbeddings.embeddings.length} embeddings`);

      return {
        hunkCount: parsedHunks.hunks.length,
        embeddingCount: hunkEmbeddings.embeddings.length,
        processingTimeMs: Date.now() - startTime,
      };

    } catch (error) {
      console.error(`❌ Failed to process commit ${args.sha.substring(0, 8)}:`, error);
      throw error;
    }
  },
});

/**
 * Process PR embeddings
 */
export const processPREmbeddings = action({
  args: {
    repoId: v.number(),
    prNumber: v.number(),
    prData: v.object({}),
  },
  handler: async (ctx, args) => {
    const startTime = Date.now();
    
    try {
      console.log(`🔄 Processing embeddings for PR #${args.prNumber}`);

      // Update status to embedding
      await ctx.runMutation(internal.prProcessing.updatePRStatus, {
        repoId: args.repoId,
        number: args.prNumber,
        status: "embedding",
      });

      // TODO: Implement actual PR embedding processing
      // This would involve:
      // 1. Getting all commits in the PR
      // 2. Processing each commit
      // 3. Aggregating embeddings
      // 4. Storing PR-level embeddings

      // For now, simulate processing
      const commitCount = 3; // Mock value
      const hunkCount = 15; // Mock value
      const embeddingCount = 15; // Mock value
      const processingTimeMs = Date.now() - startTime;

      console.log(`✅ PR #${args.prNumber} processed: ${embeddingCount} embeddings`);

      return {
        commitCount,
        hunkCount,
        embeddingCount,
        processingTimeMs,
      };

    } catch (error) {
      console.error(`❌ Failed to process PR #${args.prNumber}:`, error);
      
      // Update status to failed
      await ctx.runMutation(internal.prProcessing.updatePRStatus, {
        repoId: args.repoId,
        number: args.prNumber,
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });

      throw error;
    }
  },
});

/**
 * Run embedding processor (called by cron job)
 */
export const runEmbeddingProcessor = action({
  args: {},
  handler: async (ctx) => {
    try {
      console.log("🔄 Running automatic embedding processor...");
      
      // Get commits that need embeddings
      const commits = await ctx.runQuery(internal.commits.getCommitsWithoutEmbeddings);
      
      if (commits.length === 0) {
        console.log("✅ No commits need embedding processing");
        return { processed: 0 };
      }
      
      console.log(`📥 Found ${commits.length} commits that need embeddings`);
      
      let processed = 0;
      
      for (const commit of commits) {
        try {
          // Get hunks for this commit
          const hunks = await ctx.runQuery(internal.hunks.getHunksByCommit, {
            repoId: commit.repoId,
            sha: commit.sha
          });
          
          if (hunks.length === 0) {
            console.log(`⚠️ No hunks found for commit ${commit.sha}`);
            continue;
          }
          
          // Process embeddings for this commit
          const result = await ctx.runAction(internal.actions.embedding.processCommitEmbeddings, {
            repoId: commit.repoId,
            sha: commit.sha,
            commitData: commit,
          });
          
          console.log(`✅ Processed ${result.embeddingCount} embeddings for commit ${commit.sha}`);
          processed++;
          
        } catch (error) {
          console.error(`❌ Failed to process embeddings for commit ${commit.sha}:`, error);
        }
      }
      
      console.log(`✅ Automatic embedding processor completed: ${processed} commits processed`);
      return { processed };
      
    } catch (error) {
      console.error("❌ Failed to run automatic embedding processor:", error);
      return { processed: 0, error: error instanceof Error ? error.message : "Unknown error" };
    }
  },
});
