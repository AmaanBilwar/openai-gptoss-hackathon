import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createHunkEmbedding = mutation({
  args: {
    repoId: v.id("repos"),
    commitId: v.id("commits"),
    filePath: v.string(),
    hunkId: v.id("hunks"),
    embedding: v.array(v.float64()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("embeddings_hunk", {
      repoId: args.repoId,
      commitId: args.commitId,
      filePath: args.filePath,
      hunkId: args.hunkId,
      embedding: args.embedding,
    });
  },
});

export const searchByEmbedding = query({
  args: {
    embedding: v.array(v.float64()),
    repoId: v.id("repos"),
    commitId: v.optional(v.id("commits")),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 10;
    
    // Use vector search to find similar embeddings
    const results = await ctx.db
      .query("embeddings_hunk")
      .withIndex("by_embedding", (q) => 
        q.similar("embedding", args.embedding, limit * 2)
      )
      .filter((q) => q.eq(q.field("repoId"), args.repoId))
      .collect();
    
    // If commitId is provided, filter by it
    const filteredResults = args.commitId 
      ? results.filter(r => r.commitId === args.commitId)
      : results;
    
    return filteredResults.slice(0, limit);
  },
});
