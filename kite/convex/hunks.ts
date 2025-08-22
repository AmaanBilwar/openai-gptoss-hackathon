import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getHunksByCommit = query({
  args: { 
    commitId: v.id("commits")
  },
  handler: async (ctx, args) => {
    // Get all files for this commit
    const files = await ctx.db
      .query("files")
      .withIndex("by_commit_path", (q) => q.eq("commitId", args.commitId))
      .collect();

    // Get all hunks for these files
    const hunks = [];
    for (const file of files) {
      const fileHunks = await ctx.db
        .query("hunks")
        .withIndex("by_file_hunk", (q) => q.eq("fileId", file._id))
        .collect();
      
      // Add file path to each hunk for context
      for (const hunk of fileHunks) {
        hunks.push({
          ...hunk,
          filePath: file.path,
        });
      }
    }

    return hunks;
  },
});

export const getHunkById = query({
  args: { 
    hunkId: v.id("hunks")
  },
  handler: async (ctx, args) => {
    const hunk = await ctx.db.get(args.hunkId);
    if (!hunk) return null;
    
    // Get file path for context
    const file = await ctx.db.get(hunk.fileId);
    return {
      ...hunk,
      filePath: file?.path || "unknown",
    };
  },
});

export const createHunk = mutation({
  args: {
    fileId: v.id("files"),
    hunkNo: v.number(),
    rangeOld: v.object({
      start: v.number(),
      len: v.number(),
    }),
    rangeNew: v.object({
      start: v.number(),
      len: v.number(),
    }),
    patchHeader: v.string(),
    beforeSnippet: v.string(),
    afterSnippet: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("hunks", {
      fileId: args.fileId,
      hunkNo: args.hunkNo,
      rangeOld: args.rangeOld,
      rangeNew: args.rangeNew,
      patchHeader: args.patchHeader,
      beforeSnippet: args.beforeSnippet,
      afterSnippet: args.afterSnippet,
    });
  },
});
