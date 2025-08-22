import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getCommentsByPR = query({
  args: { 
    prId: v.id("prs")
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pr_comments")
      .withIndex("by_pr_time", (q) => q.eq("prId", args.prId))
      .collect();
  },
});

export const createPRComment = mutation({
  args: {
    prId: v.id("prs"),
    author: v.string(),
    body: v.string(),
    createdAt: v.number(),
    filePath: v.optional(v.string()),
    line: v.optional(v.number()),
    type: v.union(v.literal("review"), v.literal("inline"), v.literal("issue")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pr_comments", {
      prId: args.prId,
      author: args.author,
      body: args.body,
      createdAt: args.createdAt,
      filePath: args.filePath,
      line: args.line,
      type: args.type,
    });
  },
});
