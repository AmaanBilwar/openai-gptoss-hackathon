import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const createFile = mutation({
  args: {
    commitId: v.id("commits"),
    path: v.string(),
    status: v.union(v.literal("modified"), v.literal("added"), v.literal("deleted"), v.literal("renamed")),
    language: v.optional(v.string()),
    stats: v.optional(v.object({
      additions: v.number(),
      deletions: v.number(),
      changes: v.number(),
    })),
    oldPath: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("files", {
      commitId: args.commitId,
      path: args.path,
      status: args.status,
      language: args.language,
      stats: args.stats,
      oldPath: args.oldPath,
    });
  },
});
