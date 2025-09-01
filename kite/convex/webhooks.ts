import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Store a webhook event
 */
export const storeWebhookEvent = mutation({
  args: {
    repoId: v.number(),
    eventType: v.union(
      v.literal("push"),
      v.literal("pull_request"),
      v.literal("pull_request_review"),
      v.literal("issue_comment")
    ),
    eventId: v.string(),
    deliveryId: v.string(),
    payload: v.object({}),
  },
  handler: async (ctx, args) => {
    const webhookEventId = await ctx.db.insert("webhook_events", {
      repoId: args.repoId,
      eventType: args.eventType,
      eventId: args.eventId,
      deliveryId: args.deliveryId,
      payload: args.payload,
      processed: false,
      processingStatus: "pending",
      createdAt: Date.now(),
    });

    console.log(`📥 Stored webhook event: ${args.eventType} for repo ${args.repoId}`);
    return webhookEventId;
  },
});

/**
 * Mark webhook event as processed
 */
export const markWebhookProcessed = mutation({
  args: {
    webhookEventId: v.id("webhook_events"),
    status: v.union(
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.webhookEventId, {
      processed: true,
      processingStatus: args.status,
      error: args.error,
      processedAt: Date.now(),
    });

    console.log(`✅ Marked webhook event as ${args.status}`);
  },
});

/**
 * Get unprocessed webhook events
 */
export const getUnprocessedWebhooks = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    return await ctx.db
      .query("webhook_events")
      .withIndex("by_processed", (q) => q.eq("processed", false))
      .order("asc")
      .take(limit);
  },
});

/**
 * Get webhook events by repository
 */
export const getWebhookEventsByRepo = query({
  args: {
    repoId: v.number(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    
    return await ctx.db
      .query("webhook_events")
      .withIndex("by_repo_event", (q) => q.eq("repoId", args.repoId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get webhook processing statistics
 */
export const getWebhookStats = query({
  args: {},
  handler: async (ctx) => {
    const allEvents = await ctx.db.query("webhook_events").collect();
    
    const stats = {
      total: allEvents.length,
      processed: 0,
      pending: 0,
      processing: 0,
      failed: 0,
      byEventType: {
        push: 0,
        pull_request: 0,
        pull_request_review: 0,
        issue_comment: 0,
      },
    };

    for (const event of allEvents) {
      if (event.processed) {
        stats.processed++;
      } else {
        switch (event.processingStatus) {
          case "pending":
            stats.pending++;
            break;
          case "processing":
            stats.processing++;
            break;
          case "failed":
            stats.failed++;
            break;
        }
      }

      stats.byEventType[event.eventType]++;
    }

    return stats;
  },
});
