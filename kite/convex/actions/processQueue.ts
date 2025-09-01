"use node";

import { action } from "../_generated/server";
import { internal } from "../_generated/api";

/**
 * Process the next items in the queue
 * This action runs the actual embedding processing
 */
export const processQueue = action({
  args: {},
  handler: async (ctx) => {
    console.log("🔄 Starting queue processing...");

    try {
      // Get next items from queue
      const queueItems = await ctx.runQuery(internal.processing.getNextQueueItems, { limit: 3 });

      if (queueItems.length === 0) {
        console.log("📭 No items in queue to process");
        return { processed: 0 };
      }

      let processedCount = 0;

      for (const item of queueItems) {
        try {
          // Mark as processing
          await ctx.runMutation(internal.processing.markQueueItemProcessing, {
            queueId: item._id,
          });

          console.log(`🔄 Processing ${item.targetType}: ${item.targetId}`);

          if (item.targetType === "commit") {
            await processCommit(ctx, item);
          } else if (item.targetType === "pull_request") {
            await processPullRequest(ctx, item);
          }

          // Mark as completed
          await ctx.runMutation(internal.processing.markQueueItemCompleted, {
            queueId: item._id,
          });

          processedCount++;
          console.log(`✅ Completed processing ${item.targetType}: ${item.targetId}`);

        } catch (error) {
          console.error(`❌ Failed to process ${item.targetType}: ${item.targetId}`, error);
          
          // Mark as failed
          await ctx.runMutation(internal.processing.markQueueItemFailed, {
            queueId: item._id,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      console.log(`🎉 Processed ${processedCount} items from queue`);
      return { processed: processedCount };

    } catch (error) {
      console.error("❌ Queue processing failed:", error);
      throw error;
    }
  },
});

/**
 * Process a commit
 */
async function processCommit(ctx: any, item: any) {
  const { repoId, targetId: sha } = item;

  console.log(`📥 Processing commit ${sha.substring(0, 8)}`);

  // Update processing status
  await ctx.runMutation(internal.commitProcessing.updateCommitStatus, {
    repoId,
    sha,
    status: "fetching",
  });

  // Fetch commit data from GitHub
  const commitData = await ctx.runAction(internal.github.fetchCommit, {
    repoId,
    sha,
  });

  if (!commitData) {
    throw new Error(`Failed to fetch commit ${sha}`);
  }

  // Update status to parsing
  await ctx.runMutation(internal.commitProcessing.updateCommitStatus, {
    repoId,
    sha,
    status: "parsing",
  });

  // Parse commit and generate embeddings
  const result = await ctx.runAction(internal.embedding.processCommitEmbeddings, {
    repoId,
    sha,
    commitData,
  });

  // Update final status
  await ctx.runMutation(internal.commitProcessing.updateCommitStatus, {
    repoId,
    sha,
    status: "completed",
    hunkCount: result.hunkCount,
    embeddingCount: result.embeddingCount,
    processingTimeMs: result.processingTimeMs,
  });

  console.log(`✅ Commit ${sha.substring(0, 8)} processed: ${result.embeddingCount} embeddings`);
}

/**
 * Process a pull request
 */
async function processPullRequest(ctx: any, item: any) {
  const { repoId, targetId: prNumber } = item;

  console.log(`📥 Processing PR #${prNumber}`);

  // Update processing status
  await ctx.runMutation(internal.prProcessing.updatePRStatus, {
    repoId,
    number: parseInt(prNumber),
    status: "fetching",
  });

  // Fetch PR data from GitHub
  const prData = await ctx.runAction(internal.github.fetchPullRequest, {
    repoId,
    number: parseInt(prNumber),
  });

  if (!prData) {
    throw new Error(`Failed to fetch PR #${prNumber}`);
  }

  // Update status to parsing
  await ctx.runMutation(internal.prProcessing.updatePRStatus, {
    repoId,
    number: parseInt(prNumber),
    status: "parsing",
  });

  // Process PR and generate embeddings
  const result = await ctx.runAction(internal.embedding.processPREmbeddings, {
    repoId,
    prNumber: parseInt(prNumber),
    prData,
  });

  // Update final status
  await ctx.runMutation(internal.prProcessing.updatePRStatus, {
    repoId,
    number: parseInt(prNumber),
    status: "completed",
    commitCount: result.commitCount,
    hunkCount: result.hunkCount,
    embeddingCount: result.embeddingCount,
    processingTimeMs: result.processingTimeMs,
  });

  console.log(`✅ PR #${prNumber} processed: ${result.embeddingCount} embeddings`);
}
