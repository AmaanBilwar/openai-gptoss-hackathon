import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Upsert hunk embeddings in batch
 */
export const upsertHunkEmbeddingsBatch = mutation({
  args: {
    embeddings: v.array(v.object({
      repoId: v.number(),
      scope: v.literal("commit_hunk"),
      sha: v.string(),
      path: v.string(),
      hunkId: v.id("hunks"),
      embedding: v.array(v.number()),
      dim: v.number(),
      text: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const results = [];
    
    for (const embeddingData of args.embeddings) {
      try {
        // Check if embedding already exists for this hunk
        const existingEmbedding = await ctx.db
          .query("embeddings")
          .withIndex("by_repo_scope", (q) => 
            q.eq("repoId", embeddingData.repoId).eq("scope", embeddingData.scope)
          )
          .filter((q) => q.eq(q.field("hunkId"), embeddingData.hunkId))
          .first();

        if (existingEmbedding) {
          // Update existing embedding
          await ctx.db.patch(existingEmbedding._id, {
            embedding: embeddingData.embedding,
            dim: embeddingData.dim,
            text: embeddingData.text,
          });
          results.push({ 
            hunkId: embeddingData.hunkId, 
            success: true, 
            action: 'updated' 
          });
        } else {
          // Insert new embedding
          await ctx.db.insert("embeddings", {
            repoId: embeddingData.repoId,
            scope: embeddingData.scope,
            sha: embeddingData.sha,
            path: embeddingData.path,
            hunkId: embeddingData.hunkId,
            embedding: embeddingData.embedding,
            dim: embeddingData.dim,
            text: embeddingData.text,
            createdAt: Date.now(),
          });
          results.push({ 
            hunkId: embeddingData.hunkId, 
            success: true, 
            action: 'inserted' 
          });
        }
      } catch (error) {
        results.push({ 
          hunkId: embeddingData.hunkId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return { results };
  },
});

/**
 * Upsert a single hunk embedding
 */
export const upsertHunkEmbedding = mutation({
  args: {
    repoId: v.number(),
    sha: v.string(),
    path: v.string(),
    hunkId: v.id("hunks"),
    embedding: v.array(v.number()),
    dim: v.number(),
    text: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check if embedding already exists for this hunk
    const existingEmbedding = await ctx.db
      .query("embeddings")
      .withIndex("by_repo_scope", (q) => 
        q.eq("repoId", args.repoId).eq("scope", "commit_hunk" as const)
      )
      .filter((q) => q.eq(q.field("hunkId"), args.hunkId))
      .first();

    if (existingEmbedding) {
      // Update existing embedding
      await ctx.db.patch(existingEmbedding._id, {
        embedding: args.embedding,
        dim: args.dim,
        text: args.text,
      });
      return { 
        success: true, 
        action: 'updated',
        embeddingId: existingEmbedding._id
      };
    } else {
      // Insert new embedding
      const embeddingId = await ctx.db.insert("embeddings", {
        repoId: args.repoId,
        scope: "commit_hunk",
        sha: args.sha,
        path: args.path,
        hunkId: args.hunkId,
        embedding: args.embedding,
        dim: args.dim,
        text: args.text,
        createdAt: Date.now(),
      });
      return { 
        success: true, 
        action: 'inserted',
        embeddingId
      };
    }
  },
});

/**
 * Get embeddings for a specific commit
 */
export const getCommitEmbeddings = query({
  args: {
    repoId: v.number(),
    sha: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("embeddings")
      .withIndex("by_repo_scope", (q) => 
        q.eq("repoId", args.repoId).eq("scope", "commit_hunk")
      )
      .filter((q) => q.eq(q.field("sha"), args.sha))
      .collect();
  },
});

/**
 * Get embeddings for a specific hunk
 */
export const getHunkEmbedding = query({
  args: {
    repoId: v.number(),
    hunkId: v.id("hunks"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("embeddings")
      .withIndex("by_repo_scope", (q) => 
        q.eq("repoId", args.repoId).eq("scope", "commit_hunk" as any)
      )
      .filter((q) => q.eq(q.field("hunkId"), args.hunkId))
      .first();
  },
});

/**
 * Get embeddings for a specific repository
 */
export const getRepositoryEmbeddings = query({
  args: {
    repoId: v.number(),
    scope: v.optional(v.union(
      v.literal("commit_hunk"),
      v.literal("pr_file"),
      v.literal("pr_comment"),
      v.literal("commit_msg")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 100;
    
    if (args.scope) {
      return await ctx.db
        .query("embeddings")
        .withIndex("by_repo_scope", (q) => 
          q.eq("repoId", args.repoId).eq("scope", args.scope as any)
        )
        .take(limit);
    } else {
      return await ctx.db
        .query("embeddings")
        .withIndex("by_repo_scope", (q) => 
          q.eq("repoId", args.repoId)
        )
        .take(limit);
    }
  },
});

/**
 * Delete embeddings for a specific commit
 */
export const deleteCommitEmbeddings = mutation({
  args: {
    repoId: v.number(),
    sha: v.string(),
  },
  handler: async (ctx, args) => {
    const embeddings = await ctx.db
      .query("embeddings")
      .withIndex("by_repo_scope", (q) => 
        q.eq("repoId", args.repoId).eq("scope", "commit_hunk" as any)
      )
      .filter((q) => q.eq(q.field("sha"), args.sha))
      .collect();

    let deletedCount = 0;
    for (const embedding of embeddings) {
      await ctx.db.delete(embedding._id);
      deletedCount++;
    }

    return { deletedCount };
  },
});

/**
 * Delete embeddings for a specific hunk
 */
export const deleteHunkEmbedding = mutation({
  args: {
    repoId: v.number(),
    hunkId: v.id("hunks"),
  },
  handler: async (ctx, args) => {
    const embedding = await ctx.db
      .query("embeddings")
      .withIndex("by_repo_scope", (q) => 
        q.eq("repoId", args.repoId).eq("scope", "commit_hunk" as any)
      )
      .filter((q) => q.eq(q.field("hunkId"), args.hunkId))
      .first();

    if (embedding) {
      await ctx.db.delete(embedding._id);
      return { success: true, deleted: true };
    }

    return { success: false, deleted: false };
  },
});

/**
 * Get all embeddings (for debugging purposes)
 */
export const getAllEmbeddings = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("embeddings")
      .collect();
  },
});

/**
 * Get embedding statistics for a repository
 */
export const getEmbeddingStats = query({
  args: {
    repoId: v.number(),
  },
  handler: async (ctx, args) => {
    const allEmbeddings = await ctx.db
      .query("embeddings")
      .withIndex("by_repo_scope", (q) => 
        q.eq("repoId", args.repoId)
      )
      .collect();

    const stats = {
      total: allEmbeddings.length,
      byScope: {
        commit_hunk: 0,
        pr_file: 0,
        pr_comment: 0,
        commit_msg: 0,
        user_query: 0,
      },
      averageDimension: 0,
    };

    let totalDimension = 0;
    for (const embedding of allEmbeddings) {
      stats.byScope[embedding.scope]++;
      totalDimension += embedding.dim;
    }

    if (allEmbeddings.length > 0) {
      stats.averageDimension = Math.round(totalDimension / allEmbeddings.length);
    }

    return stats;
  },
});
