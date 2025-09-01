import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Helper function to resolve repoId from owner/repo
 */
async function resolveRepoId(ctx: any, owner: string, repo: string): Promise<number> {
  const fullName = `${owner}/${repo}`;
  
  // Try to find existing repository
  const existingRepo = await ctx.db
    .query("repositories")
    .withIndex("by_full_name", (q: any) => q.eq("fullName", fullName))
    .first();

  if (existingRepo) {
    return existingRepo.repoId;
  }

  // If not found, create a minimal repository entry for testing
  // TODO:[In production, this should be done through the GitHub API]
  
  const repoId = Date.now(); // Use timestamp as a temporary repoId
  await ctx.db.insert("repositories", {
    userId: "test-user", // For testing purposes
    repoId: repoId,
    owner: owner,
    name: repo,
    fullName: fullName,
    htmlUrl: `https://github.com/${fullName}`,
    description: "Auto-created for testing",
    private: false,
    defaultBranch: "main",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return repoId;
}


/**
 * Upsert a commit
 */
export const upsertCommit = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    sha: v.string(),
    treeSha: v.optional(v.string()),
    authorLogin: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    authoredDateIso: v.optional(v.string()),
    committerLogin: v.optional(v.string()),
    committerEmail: v.optional(v.string()),
    committedDateIso: v.optional(v.string()),
    message: v.string(),
    parentShas: v.array(v.string()),
    stats: v.optional(v.object({
      additions: v.optional(v.number()),
      deletions: v.optional(v.number()),
      total: v.optional(v.number()),
      filesChanged: v.optional(v.number()),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Check if commit already exists
    const existingCommit = await ctx.db
      .query("commits")
      .withIndex("by_repo_sha", (q) => 
        q.eq("repoId", repoId).eq("sha", args.sha)
      )
      .first();

    if (existingCommit) {
      // Update existing commit
      await ctx.db.patch(existingCommit._id, {
        treeSha: args.treeSha,
        authorLogin: args.authorLogin,
        authorEmail: args.authorEmail,
        authoredDateIso: args.authoredDateIso,
        committerLogin: args.committerLogin,
        committerEmail: args.committerEmail,
        committedDateIso: args.committedDateIso,
        message: args.message,
        parentShas: args.parentShas,
        stats: args.stats,
      });
      return existingCommit._id;
    }

    // Insert new commit
    return await ctx.db.insert("commits", {
      repoId,
      sha: args.sha,
      treeSha: args.treeSha,
      authorLogin: args.authorLogin,
      authorEmail: args.authorEmail,
      authoredDateIso: args.authoredDateIso,
      committerLogin: args.committerLogin,
      committerEmail: args.committerEmail,
      committedDateIso: args.committedDateIso,
      message: args.message,
      parentShas: args.parentShas,
      stats: args.stats,
      createdAt: Date.now(),
    });
  },
});

/**
 * Upsert commit files
 */
export const upsertCommitFiles = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    sha: v.string(),
    files: v.array(v.object({
      path: v.string(),
      status: v.union(
        v.literal("added"),
        v.literal("modified"),
        v.literal("removed"),
        v.literal("renamed"),
        v.literal("copied"),
        v.literal("changed"),
        v.literal("unchanged")
      ),
      previousPath: v.optional(v.string()),
      additions: v.optional(v.number()),
      deletions: v.optional(v.number()),
      patch: v.optional(v.string()),
      blobShaBefore: v.optional(v.string()),
      blobShaAfter: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Delete existing commit files for this commit
    const existingFiles = await ctx.db
      .query("commit_files")
      .withIndex("by_repo_commit", (q) => 
        q.eq("repoId", repoId).eq("sha", args.sha)
      )
      .collect();

    for (const file of existingFiles) {
      await ctx.db.delete(file._id);
    }

    // Insert new commit files
    const fileIds = [];
    for (const file of args.files) {
      const fileId = await ctx.db.insert("commit_files", {
        repoId,
        sha: args.sha,
        path: file.path,
        status: file.status,
        previousPath: file.previousPath,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        blobShaBefore: file.blobShaBefore,
        blobShaAfter: file.blobShaAfter,
        createdAt: Date.now(),
      });
      fileIds.push(fileId);
    }

    return fileIds;
  },
});

/**
 * Upsert hunks for a commit
 */
export const upsertHunks = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    sha: v.string(),
    hunks: v.array(v.object({
      path: v.string(),
      hunkIndex: v.number(),
      header: v.string(),
      oldStart: v.optional(v.number()),
      oldLines: v.optional(v.number()),
      newStart: v.optional(v.number()),
      newLines: v.optional(v.number()),
      hunk: v.string(),
      summary: v.optional(v.string()),
      labels: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Delete existing hunks for this commit
    const existingHunks = await ctx.db
      .query("hunks")
      .withIndex("by_repo_commit_path", (q) => 
        q.eq("repoId", repoId).eq("sha", args.sha)
      )
      .collect();

    for (const hunk of existingHunks) {
      await ctx.db.delete(hunk._id);
    }

    // Insert new hunks
    const hunkIds = [];
    for (const hunk of args.hunks) {
      const hunkId = await ctx.db.insert("hunks", {
        repoId,
        sha: args.sha,
        path: hunk.path,
        hunkIndex: hunk.hunkIndex,
        header: hunk.header,
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        hunk: hunk.hunk,
        summary: hunk.summary,
        labels: hunk.labels,
        createdAt: Date.now(),
      });
      hunkIds.push(hunkId);
    }

    return hunkIds;
  },
});

/**
 * Get commits for a repository
 */
export const getCommits = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);
    const limit = args.limit || 50;

    return await ctx.db
      .query("commits")
      .withIndex("by_repo_authored", (q) => q.eq("repoId", repoId))
      .order("desc")
      .take(limit);
  },
});

/**
 * Get a specific commit
 */
export const getCommit = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    sha: v.string(),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    return await ctx.db
      .query("commits")
      .withIndex("by_repo_sha", (q) => 
        q.eq("repoId", repoId).eq("sha", args.sha)
      )
      .first();
  },
});

/**
 * Get commit files
 */
export const getCommitFiles = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    sha: v.string(),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    return await ctx.db
      .query("commit_files")
      .withIndex("by_repo_commit", (q) => 
        q.eq("repoId", repoId).eq("sha", args.sha)
      )
      .collect();
  },
});

/**
 * Get hunks for a commit
 */
export const getHunks = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    sha: v.string(),
    path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    if (args.path) {
      return await ctx.db
        .query("hunks")
        .withIndex("by_repo_commit_path", (q: any) => 
          q.eq("repoId", repoId).eq("sha", args.sha).eq("path", args.path!)
        )
        .collect();
    } else {
      return await ctx.db
        .query("hunks")
        .withIndex("by_repo_commit_path", (q: any) => 
          q.eq("repoId", repoId).eq("sha", args.sha)
        )
        .collect();
    }
  },
});

/**
 * Get hunks by their IDs
 */
export const getHunksByIds = query({
  args: {
    hunkIds: v.array(v.id("hunks")),
  },
  handler: async (ctx, args) => {
    const hunks = [];
    
    for (const hunkId of args.hunkIds) {
      const hunk = await ctx.db.get(hunkId);
      if (hunk) {
        hunks.push(hunk);
      }
    }
    
    return hunks;
  },
});

/**
 * Bulk upsert commit with files and hunks
 */
export const upsertCommitWithFilesAndHunks = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    commit: v.object({
      sha: v.string(),
      treeSha: v.optional(v.string()),
      authorLogin: v.optional(v.string()),
      authorEmail: v.optional(v.string()),
      authoredDateIso: v.optional(v.string()),
      committerLogin: v.optional(v.string()),
      committerEmail: v.optional(v.string()),
      committedDateIso: v.optional(v.string()),
      message: v.string(),
      parentShas: v.array(v.string()),
      stats: v.optional(v.object({
        additions: v.optional(v.number()),
        deletions: v.optional(v.number()),
        total: v.optional(v.number()),
        filesChanged: v.optional(v.number()),
      })),
    }),
    files: v.array(v.object({
      path: v.string(),
      status: v.union(
        v.literal("added"),
        v.literal("modified"),
        v.literal("removed"),
        v.literal("renamed"),
        v.literal("copied"),
        v.literal("changed"),
        v.literal("unchanged")
      ),
      previousPath: v.optional(v.string()),
      additions: v.optional(v.number()),
      deletions: v.optional(v.number()),
      patch: v.optional(v.string()),
      blobShaBefore: v.optional(v.string()),
      blobShaAfter: v.optional(v.string()),
    })),
    hunks: v.array(v.object({
      path: v.string(),
      hunkIndex: v.number(),
      header: v.string(),
      oldStart: v.optional(v.number()),
      oldLines: v.optional(v.number()),
      newStart: v.optional(v.number()),
      newLines: v.optional(v.number()),
      hunk: v.string(),
      summary: v.optional(v.string()),
      labels: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Upsert commit
    const commitId = await ctx.db.insert("commits", {
      repoId,
      sha: args.commit.sha,
      treeSha: args.commit.treeSha,
      authorLogin: args.commit.authorLogin,
      authorEmail: args.commit.authorEmail,
      authoredDateIso: args.commit.authoredDateIso,
      committerLogin: args.commit.committerLogin,
      committerEmail: args.commit.committerEmail,
      committedDateIso: args.commit.committedDateIso,
      message: args.commit.message,
      parentShas: args.commit.parentShas,
      stats: args.commit.stats,
      createdAt: Date.now(),
    });

    // Upsert files
    const fileIds = [];
    for (const file of args.files) {
      const fileId = await ctx.db.insert("commit_files", {
        repoId,
        sha: args.commit.sha,
        path: file.path,
        status: file.status,
        previousPath: file.previousPath,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        blobShaBefore: file.blobShaBefore,
        blobShaAfter: file.blobShaAfter,
        createdAt: Date.now(),
      });
      fileIds.push(fileId);
    }

    // Upsert hunks
    const hunkIds = [];
    for (const hunk of args.hunks) {
      const hunkId = await ctx.db.insert("hunks", {
        repoId,
        sha: args.commit.sha,
        path: hunk.path,
        hunkIndex: hunk.hunkIndex,
        header: hunk.header,
        oldStart: hunk.oldStart,
        oldLines: hunk.oldLines,
        newStart: hunk.newStart,
        newLines: hunk.newLines,
        hunk: hunk.hunk,
        summary: hunk.summary,
        labels: hunk.labels,
        createdAt: Date.now(),
      });
      hunkIds.push(hunkId);
    }

    return {
      commitId,
      fileIds,
      hunkIds,
    };
  },
});

/**
 * Update hunk summary with LLM-generated content
 */
export const updateHunkSummary = mutation({
  args: {
    hunkId: v.id("hunks"),
    summary: v.string(),
    labels: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // Update the hunk with the new summary and labels
    await ctx.db.patch(args.hunkId, {
      summary: args.summary,
      labels: args.labels,
    });

    return { success: true };
  },
});

/**
 * Update multiple hunk summaries in batch
 */
export const updateHunkSummariesBatch = mutation({
  args: {
    updates: v.array(v.object({
      hunkId: v.id("hunks"),
      summary: v.string(),
      labels: v.optional(v.array(v.string())),
    })),
  },
  handler: async (ctx, args) => {
    const results = [];
    
    for (const update of args.updates) {
      try {
        await ctx.db.patch(update.hunkId, {
          summary: update.summary,
          labels: update.labels,
        });
        results.push({ hunkId: update.hunkId, success: true });
      } catch (error) {
        results.push({ 
          hunkId: update.hunkId, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    return { results };
  },
});

/**
 * Store a commit with all its files, hunks, summaries, and embeddings
 * This is used by the automated embedding pipeline
 */
export const storeCommitWithHunks = mutation({
  args: {
    repoId: v.number(),
    commit: v.object({}),
    files: v.array(v.object({})),
    hunks: v.array(v.object({})),
    summaries: v.array(v.object({})),
    embeddings: v.array(v.object({})),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`🔄 Storing commit with ${args.files.length} files, ${args.hunks.length} hunks`);

      const commitData = args.commit as any;
      
      // 1. Store the commit
      const commitId = await ctx.db.insert("commits", {
        repoId: args.repoId,
        sha: commitData.sha,
        treeSha: commitData.treeSha,
        authorLogin: commitData.authorLogin,
        authorEmail: commitData.authorEmail,
        authoredDateIso: commitData.authoredDateIso,
        committerLogin: commitData.committerLogin,
        committerEmail: commitData.committerEmail,
        committedDateIso: commitData.committedDateIso,
        message: commitData.message,
        parentShas: commitData.parentShas || [],
        stats: commitData.stats,
        createdAt: Date.now(),
      });

      // 2. Store files
      const fileIds = [];
      for (const file of args.files) {
        const fileData = file as any;
        const fileId = await ctx.db.insert("commit_files", {
          repoId: args.repoId,
          sha: commitData.sha,
          path: fileData.path,
          status: fileData.status,
          previousPath: fileData.previousPath,
          additions: fileData.additions,
          deletions: fileData.deletions,
          patch: fileData.patch,
          blobShaBefore: fileData.blobShaBefore,
          blobShaAfter: fileData.blobShaAfter,
          createdAt: Date.now(),
        });
        fileIds.push(fileId);
      }

      // 3. Store hunks with summaries
      const hunkIds = [];
      for (let i = 0; i < args.hunks.length; i++) {
        const hunk = args.hunks[i] as any;
        const summary = args.summaries[i] as any;
        
        const hunkId = await ctx.db.insert("hunks", {
          repoId: args.repoId,
          sha: commitData.sha,
          path: hunk.path,
          hunkIndex: hunk.hunkIndex,
          header: hunk.header,
          oldStart: hunk.oldStart,
          oldLines: hunk.oldLines,
          newStart: hunk.newStart,
          newLines: hunk.newLines,
          hunk: hunk.hunk,
          summary: summary.summary,
          labels: summary.labels,
          createdAt: Date.now(),
        });
        hunkIds.push(hunkId);
      }

      // 4. Store embeddings
      for (let i = 0; i < args.embeddings.length; i++) {
        const embedding = args.embeddings[i] as any;
        const hunk = args.hunks[i] as any;
        
        await ctx.db.insert("embeddings", {
          repoId: args.repoId,
          scope: "commit_hunk",
          sha: commitData.sha,
          path: hunk.path,
          hunkId: hunkIds[i],
          embedding: embedding.vector,
          dim: embedding.dim,
          text: embedding.text,
          createdAt: Date.now(),
        });
      }

      console.log(`✅ Stored commit ${commitData.sha.substring(0, 8)}: ${fileIds.length} files, ${hunkIds.length} hunks, ${args.embeddings.length} embeddings`);

      return {
        commitId,
        fileIds,
        hunkIds,
        embeddingCount: args.embeddings.length
      };

    } catch (error) {
      console.error(`❌ Failed to store commit with hunks:`, error);
      throw error;
    }
  },
});

/**
 * Get hunks by their IDs
 */
