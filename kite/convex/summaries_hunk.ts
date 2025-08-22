import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getSummariesByHunks = query({
  args: { 
    hunkIds: v.array(v.id("hunks"))
  },
  handler: async (ctx, args) => {
    const summaries = [];
    for (const hunkId of args.hunkIds) {
      const summary = await ctx.db
        .query("summaries_hunk")
        .withIndex("by_hunk", (q) => q.eq("hunkId", hunkId))
        .unique();
      if (summary) {
        summaries.push(summary);
      }
    }
    return summaries;
  },
});

export const getSummaryByHunk = query({
  args: { 
    hunkId: v.id("hunks")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("summaries_hunk")
      .withIndex("by_hunk", (q) => q.eq("hunkId", args.hunkId))
      .unique();
  },
});

export const createHunkSummary = mutation({
  args: {
    hunkId: v.id("hunks"),
    whySummary: v.string(),
    riskTags: v.array(v.string()),
    modelId: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("summaries_hunk", {
      hunkId: args.hunkId,
      whySummary: args.whySummary,
      riskTags: args.riskTags,
      modelId: args.modelId,
      createdAt: args.createdAt,
    });
  },
});
