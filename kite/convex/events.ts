import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const storeWebhookEvent = mutation({
  args: {
    eventType: v.string(),
    payload: v.any(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events_webhook", {
      eventType: args.eventType,
      payload: args.payload,
      processed: false,
      createdAt: Date.now(),
    });
  },
});
