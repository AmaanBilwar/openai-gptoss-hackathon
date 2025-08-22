import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getCommitBySha = query({
  args: { 
    repoId: v.id("repos"),
    sha: v.string() 
  },
  handler: async (ctx, args) => {
    const commit = await ctx.db
      .query("commits")
      .withIndex("by_repo_sha", (q) => 
        q.eq("repoId", args.repoId).eq("sha", args.sha)
      )
      .unique();
    return commit;
  },
});

export const getCommitById = query({
  args: { 
    commitId: v.id("commits")
  },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.commitId);
  },
});

export const createCommit = mutation({
  args: {
    repoId: v.id("repos"),
    sha: v.string(),
    author: v.string(),
    committer: v.string(),
    message: v.string(),
    timestamp: v.number(),
    filesChanged: v.number(),
    linesAdded: v.number(),
    linesDeleted: v.number(),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("commits", {
      repoId: args.repoId,
      sha: args.sha,
      author: args.author,
      committer: args.committer,
      message: args.message,
      timestamp: args.timestamp,
      filesChanged: args.filesChanged,
      linesAdded: args.linesAdded,
      linesDeleted: args.linesDeleted,
      status: args.status,
    });
  },
});

export const updateCommitStatus = mutation({
  args: {
    commitId: v.id("commits"),
    status: v.union(v.literal("pending"), v.literal("ready"), v.literal("failed")),
    ingestedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const updateData: any = { status: args.status };
    if (args.ingestedAt !== undefined) {
      updateData.ingestedAt = args.ingestedAt;
    }
    
    await ctx.db.patch(args.commitId, updateData);
  },
});
