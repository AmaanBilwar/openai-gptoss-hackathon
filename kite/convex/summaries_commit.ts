import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createCommitSummary = mutation({
  args: {
    commitId: v.id("commits"),
    bullets: v.array(v.string()),
    modelId: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("summaries_commit", {
      commitId: args.commitId,
      bullets: args.bullets,
      modelId: args.modelId,
      createdAt: args.createdAt,
    });
  },
});
