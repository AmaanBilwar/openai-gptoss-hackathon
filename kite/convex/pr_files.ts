import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getFilesByPR = query({
  args: { 
    prId: v.id("prs")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pr_files")
      .withIndex("by_pr_path", (q) => q.eq("prId", args.prId))
      .collect();
  },
});

export const createPRFile = mutation({
  args: {
    prId: v.id("prs"),
    path: v.string(),
    status: v.string(),
    patchHeader: v.optional(v.string()),
    stats: v.optional(v.object({
      additions: v.number(),
      deletions: v.number(),
      changes: v.number(),
    })),
    hunksRef: v.optional(v.array(v.id("hunks"))),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pr_files", {
      prId: args.prId,
      path: args.path,
      status: args.status,
      patchHeader: args.patchHeader,
      stats: args.stats,
      hunksRef: args.hunksRef,
    });
  },
});
