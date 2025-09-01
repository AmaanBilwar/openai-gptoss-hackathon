import { v } from "convex/values";
import { mutation, query, action } from "./_generated/server";
import { internal } from "./_generated/api";

/**
 * Queue a commit for processing
 */
export const queueCommitProcessing = mutation({
  args: {
    repoId: v.number(),
    sha: v.string(),
    priority: v.number(),
    metadata: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    // Check if already queued or processing
    const existing = await ctx.db
      .query("processing_queue")
      .withIndex("by_repo_target", (q) => 
        q.eq("repoId", args.repoId)
         .eq("targetType", "commit")
         .eq("targetId", args.sha)
      )
      .first();

    if (existing) {
      console.log(`⏭️ Commit ${args.sha} already in queue`);
      return existing._id;
    }

    // Add to processing queue
    const queueId = await ctx.db.insert("processing_queue", {
      repoId: args.repoId,
      targetType: "commit",
      targetId: args.sha,
      priority: args.priority,
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      metadata: args.metadata || {},
      createdAt: Date.now(),
    });

    // Create processing status record
    await ctx.db.insert("commit_processing", {
      repoId: args.repoId,
      sha: args.sha,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`📋 Queued commit ${args.sha} for processing`);
    return queueId;
  },
});

/**
 * Queue a PR for processing
 */
export const queuePRProcessing = mutation({
  args: {
    repoId: v.number(),
    prNumber: v.number(),
    priority: v.number(),
    metadata: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    // Check if already queued or processing
    const existing = await ctx.db
      .query("processing_queue")
      .withIndex("by_repo_target", (q) => 
        q.eq("repoId", args.repoId)
         .eq("targetType", "pull_request")
         .eq("targetId", args.prNumber.toString())
      )
      .first();

    if (existing) {
      console.log(`⏭️ PR #${args.prNumber} already in queue`);
      return existing._id;
    }

    // Add to processing queue
    const queueId = await ctx.db.insert("processing_queue", {
      repoId: args.repoId,
      targetType: "pull_request",
      targetId: args.prNumber.toString(),
      priority: args.priority,
      status: "queued",
      attempts: 0,
      maxAttempts: 3,
      metadata: args.metadata || {},
      createdAt: Date.now(),
    });

    // Create processing status record
    await ctx.db.insert("pr_processing", {
      repoId: args.repoId,
      number: args.prNumber,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    console.log(`📋 Queued PR #${args.prNumber} for processing`);
    return queueId;
  },
});

/**
 * Get next items from processing queue
 */
export const getNextQueueItems = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    
    return await ctx.db
      .query("processing_queue")
      .withIndex("by_status_priority", (q) => 
        q.eq("status", "queued")
      )
      .order("asc")
      .take(limit);
  },
});

/**
 * Mark queue item as processing
 */
export const markQueueItemProcessing = mutation({
  args: {
    queueId: v.id("processing_queue"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "processing",
      startedAt: Date.now(),
    });

    console.log(`🔄 Marked queue item as processing`);
  },
});

/**
 * Mark queue item as completed
 */
export const markQueueItemCompleted = mutation({
  args: {
    queueId: v.id("processing_queue"),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.queueId, {
      status: "completed",
      completedAt: Date.now(),
    });

    console.log(`✅ Marked queue item as completed`);
  },
});

/**
 * Mark queue item as failed
 */
export const markQueueItemFailed = mutation({
  args: {
    queueId: v.id("processing_queue"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const item = await ctx.db.get(args.queueId);
    if (!item) return;

    const attempts = item.attempts + 1;
    const shouldRetry = attempts < item.maxAttempts;

    await ctx.db.patch(args.queueId, {
      status: shouldRetry ? "retry" : "failed",
      attempts,
      error: args.error,
      nextRetryAt: shouldRetry ? Date.now() + (attempts * 60000) : undefined, // exponential backoff
    });

    console.log(`❌ Marked queue item as ${shouldRetry ? 'retry' : 'failed'}`);
  },
});

/**
 * Get processing statistics
 */
export const getProcessingStats = query({
  args: {},
  handler: async (ctx) => {
    const queueItems = await ctx.db.query("processing_queue").collect();
    const commitProcessing = await ctx.db.query("commit_processing").collect();
    const prProcessing = await ctx.db.query("pr_processing").collect();

    const stats = {
      queue: {
        total: queueItems.length,
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retry: 0,
      },
      commits: {
        total: commitProcessing.length,
        pending: 0,
        fetching: 0,
        parsing: 0,
        embedding: 0,
        completed: 0,
        failed: 0,
      },
      prs: {
        total: prProcessing.length,
        pending: 0,
        fetching: 0,
        parsing: 0,
        embedding: 0,
        completed: 0,
        failed: 0,
      },
    };

    // Queue stats
    for (const item of queueItems) {
      stats.queue[item.status]++;
    }

    // Commit processing stats
    for (const commit of commitProcessing) {
      stats.commits[commit.status]++;
    }

    // PR processing stats
    for (const pr of prProcessing) {
      stats.prs[pr.status]++;
    }

    return stats;
  },
});

/**
 * Clean up completed and failed queue items
 */
export const cleanUpQueueItems = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🧹 Cleaning up old queue items...");

    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);

    // Delete completed items older than 24 hours
    const oldCompletedItems = await ctx.db
      .query("processing_queue")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "completed"),
          q.lt(q.field("completedAt"), oneDayAgo)
        )
      )
      .collect();

    let deletedCompleted = 0;
    for (const item of oldCompletedItems) {
      try {
        await ctx.db.delete(item._id);
        deletedCompleted++;
      } catch (error) {
        console.error(`❌ Failed to delete completed item ${item._id}:`, error);
      }
    }

    // Delete failed items older than 7 days
    const oldFailedItems = await ctx.db
      .query("processing_queue")
      .filter((q) => 
        q.and(
          q.eq(q.field("status"), "failed"),
          q.lt(q.field("createdAt"), sevenDaysAgo)
        )
      )
      .collect();

    let deletedFailed = 0;
    for (const item of oldFailedItems) {
      try {
        await ctx.db.delete(item._id);
        deletedFailed++;
      } catch (error) {
        console.error(`❌ Failed to delete failed item ${item._id}:`, error);
      }
    }

    console.log(`✅ Cleaned up ${deletedCompleted} completed items and ${deletedFailed} failed items`);
    return { deletedCompleted, deletedFailed };
  },
});

/**
 * Get queue health and status
 */
export const getQueueHealth = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    // Get queue statistics
    const queueItems = await ctx.db.query("processing_queue").collect();
    
    // Get recent processing activity
    const recentItems = queueItems.filter(item => 
      item.startedAt && item.startedAt > fiveMinutesAgo
    );

    // Check for stuck items (processing for more than 10 minutes)
    const stuckItems = queueItems.filter(item => 
      item.status === "processing" && 
      item.startedAt && 
      (now - item.startedAt) > (10 * 60 * 1000)
    );

    // Check for failed items
    const failedItems = queueItems.filter(item => item.status === "failed");

    const health = {
      totalItems: queueItems.length,
      queued: queueItems.filter(item => item.status === "queued").length,
      processing: queueItems.filter(item => item.status === "processing").length,
      completed: queueItems.filter(item => item.status === "completed").length,
      failed: failedItems.length,
      retry: queueItems.filter(item => item.status === "retry").length,
      recentActivity: recentItems.length,
      stuckItems: stuckItems.length,
      averageProcessingTime: 0,
      isHealthy: true,
      issues: [] as string[],
    };

    // Calculate average processing time for completed items
    const completedItems = queueItems.filter(item => 
      item.status === "completed" && item.completedAt && item.startedAt
    );
    
    if (completedItems.length > 0) {
      const totalTime = completedItems.reduce((sum, item) => 
        sum + (item.completedAt! - item.startedAt!), 0
      );
      health.averageProcessingTime = totalTime / completedItems.length;
    }

    // Check for health issues
    if (stuckItems.length > 0) {
      health.isHealthy = false;
      health.issues.push(`${stuckItems.length} items stuck in processing`);
    }

    if (failedItems.length > 10) {
      health.isHealthy = false;
      health.issues.push(`${failedItems.length} items failed (high failure rate)`);
    }

    if (health.queued > 50) {
      health.isHealthy = false;
      health.issues.push(`Queue backlog: ${health.queued} items queued`);
    }

    return health;
  },
});

/**
 * Manually trigger queue processing (for testing/debugging)
 */
export const triggerQueueProcessing = mutation({
  args: {},
  handler: async (ctx) => {
    console.log("🚀 Manually triggering queue processing...");

    // Get next items from queue
    const queueItems = await ctx.db
      .query("processing_queue")
      .withIndex("by_status_priority", (q) => 
        q.eq("status", "queued")
      )
      .order("asc")
      .take(5);

    if (queueItems.length === 0) {
      console.log("📭 No items in queue to process");
      return { processed: 0 };
    }

    console.log(`📋 Found ${queueItems.length} items to process`);
    return { queued: queueItems.length };
  },
});
