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
 * Upsert a pull request
 */
export const upsertPullRequest = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    state: v.union(v.literal("open"), v.literal("closed"), v.literal("merged")),
    title: v.string(),
    body: v.optional(v.string()),
    authorLogin: v.optional(v.string()),
    headRef: v.string(),
    headSha: v.string(),
    baseRef: v.string(),
    baseSha: v.string(),
    draft: v.optional(v.boolean()),
    mergeable: v.optional(v.union(v.literal("unknown"), v.literal("true"), v.literal("false"))),
    mergeableState: v.optional(v.string()),
    requiredReviews: v.optional(v.number()),
    approvals: v.optional(v.number()),
    checks: v.optional(v.object({
      success: v.optional(v.number()),
      pending: v.optional(v.number()),
      failure: v.optional(v.number()),
    })),
    createdAtIso: v.optional(v.string()),
    updatedAtIso: v.optional(v.string()),
    closedAtIso: v.optional(v.string()),
    mergedAtIso: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Check if PR already exists
    const existingPR = await ctx.db
      .query("pull_requests")
      .withIndex("by_repo_number", (q) => 
        q.eq("repoId", repoId).eq("number", args.number)
      )
      .first();

    if (existingPR) {
      // Update existing PR
      await ctx.db.patch(existingPR._id, {
        state: args.state,
        title: args.title,
        body: args.body,
        authorLogin: args.authorLogin,
        headRef: args.headRef,
        headSha: args.headSha,
        baseRef: args.baseRef,
        baseSha: args.baseSha,
        draft: args.draft,
        mergeable: args.mergeable,
        mergeableState: args.mergeableState,
        requiredReviews: args.requiredReviews,
        approvals: args.approvals,
        checks: args.checks,
        createdAtIso: args.createdAtIso,
        updatedAtIso: args.updatedAtIso,
        closedAtIso: args.closedAtIso,
        mergedAtIso: args.mergedAtIso,
        updatedAt: Date.now(),
      });
      return existingPR._id;
    }

    // Insert new PR
    return await ctx.db.insert("pull_requests", {
      repoId,
      number: args.number,
      state: args.state,
      title: args.title,
      body: args.body,
      authorLogin: args.authorLogin,
      headRef: args.headRef,
      headSha: args.headSha,
      baseRef: args.baseRef,
      baseSha: args.baseSha,
      draft: args.draft,
      mergeable: args.mergeable,
      mergeableState: args.mergeableState,
      requiredReviews: args.requiredReviews,
      approvals: args.approvals,
      checks: args.checks,
      createdAtIso: args.createdAtIso,
      updatedAtIso: args.updatedAtIso,
      closedAtIso: args.closedAtIso,
      mergedAtIso: args.mergedAtIso,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

/**
 * Upsert PR files
 */
export const upsertPRFiles = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
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
      sha: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Delete existing PR files for this PR
    const existingFiles = await ctx.db
      .query("pr_files")
      .withIndex("by_repo_pr", (q) => 
        q.eq("repoId", repoId).eq("number", args.number)
      )
      .collect();

    for (const file of existingFiles) {
      await ctx.db.delete(file._id);
    }

    // Insert new PR files
    const fileIds = [];
    for (const file of args.files) {
      const fileId = await ctx.db.insert("pr_files", {
        repoId,
        number: args.number,
        path: file.path,
        status: file.status,
        previousPath: file.previousPath,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        sha: file.sha,
        createdAt: Date.now(),
      });
      fileIds.push(fileId);
    }

    return fileIds;
  },
});

/**
 * Upsert PR reviews
 */
export const upsertPRReviews = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    reviews: v.array(v.object({
      reviewerLogin: v.string(),
      state: v.union(
        v.literal("APPROVED"),
        v.literal("CHANGES_REQUESTED"),
        v.literal("COMMENTED"),
        v.literal("DISMISSED"),
        v.literal("PENDING")
      ),
      submittedAtIso: v.optional(v.string()),
      body: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Delete existing PR reviews for this PR
    const existingReviews = await ctx.db
      .query("pr_reviews")
      .withIndex("by_repo_pr", (q) => 
        q.eq("repoId", repoId).eq("number", args.number)
      )
      .collect();

    for (const review of existingReviews) {
      await ctx.db.delete(review._id);
    }

    // Insert new PR reviews
    const reviewIds = [];
    for (const review of args.reviews) {
      const reviewId = await ctx.db.insert("pr_reviews", {
        repoId,
        number: args.number,
        reviewerLogin: review.reviewerLogin,
        state: review.state,
        submittedAtIso: review.submittedAtIso,
        body: review.body,
        createdAt: Date.now(),
      });
      reviewIds.push(reviewId);
    }

    return reviewIds;
  },
});

/**
 * Upsert PR comments
 */
export const upsertPRComments = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    comments: v.array(v.object({
      commentId: v.number(),
      authorLogin: v.string(),
      body: v.string(),
      path: v.optional(v.string()),
      diffHunk: v.optional(v.string()),
      line: v.optional(v.number()),
      side: v.optional(v.string()),
      createdAtIso: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Delete existing PR comments for this PR
    const existingComments = await ctx.db
      .query("pr_comments")
      .withIndex("by_repo_pr", (q) => 
        q.eq("repoId", repoId).eq("number", args.number)
      )
      .collect();

    for (const comment of existingComments) {
      await ctx.db.delete(comment._id);
    }

    // Insert new PR comments
    const commentIds = [];
    for (const comment of args.comments) {
      const commentId = await ctx.db.insert("pr_comments", {
        repoId,
        number: args.number,
        commentId: comment.commentId,
        authorLogin: comment.authorLogin,
        body: comment.body,
        path: comment.path,
        diffHunk: comment.diffHunk,
        line: comment.line,
        side: comment.side,
        createdAtIso: comment.createdAtIso,
        createdAt: Date.now(),
      });
      commentIds.push(commentId);
    }

    return commentIds;
  },
});

/**
 * Get pull requests for a repository
 */
export const getPullRequests = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    state: v.optional(v.union(v.literal("open"), v.literal("closed"), v.literal("merged"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);
    const limit = args.limit || 50;

    if (args.state) {
      return await ctx.db
        .query("pull_requests")
        .withIndex("by_repo_state", (q) => 
          q.eq("repoId", repoId).eq("state", args.state!)
        )
        .order("desc")
        .take(limit);
    } else {
      return await ctx.db
        .query("pull_requests")
        .withIndex("by_repo_number", (q) => q.eq("repoId", repoId))
        .order("desc")
        .take(limit);
    }
  },
});

/**
 * Get a specific pull request
 */
export const getPullRequest = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    return await ctx.db
      .query("pull_requests")
      .withIndex("by_repo_number", (q) => 
        q.eq("repoId", repoId).eq("number", args.number)
      )
      .first();
  },
});

/**
 * Get PR files
 */
export const getPRFiles = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    return await ctx.db
      .query("pr_files")
      .withIndex("by_repo_pr", (q) => 
        q.eq("repoId", repoId).eq("number", args.number)
      )
      .collect();
  },
});

/**
 * Get PR reviews
 */
export const getPRReviews = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    return await ctx.db
      .query("pr_reviews")
      .withIndex("by_repo_pr", (q) => 
        q.eq("repoId", repoId).eq("number", args.number)
      )
      .collect();
  },
});

/**
 * Get PR comments
 */
export const getPRComments = query({
  args: {
    owner: v.string(),
    repo: v.string(),
    number: v.number(),
    path: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    if (args.path) {
      return await ctx.db
        .query("pr_comments")
        .withIndex("by_repo_pr_path", (q) => 
          q.eq("repoId", repoId).eq("number", args.number).eq("path", args.path)
        )
        .collect();
    } else {
      return await ctx.db
        .query("pr_comments")
        .withIndex("by_repo_pr", (q) => 
          q.eq("repoId", repoId).eq("number", args.number)
        )
        .collect();
    }
  },
});

/**
 * Get commits for a specific PR
 */
export const getPRCommits = query({
  args: {
    repoId: v.number(),
    number: v.number(),
  },
  handler: async (ctx, args) => {
    // For now, we'll return commits that have the PR number in their message
    // This is a simplified approach - in a real implementation, you'd have a PR-commits mapping table
    const commits = await ctx.db
      .query("commits")
      .withIndex("by_repo_sha", (q) => q.eq("repoId", args.repoId))
      .collect();
    
    // Filter commits that mention the PR number
    return commits.filter(commit => commit.message.includes(`#${args.number}`));
  },
});

/**
 * Bulk upsert PR with files, reviews, and comments
 */
export const upsertPullRequestWithAll = mutation({
  args: {
    owner: v.string(),
    repo: v.string(),
    pr: v.object({
      number: v.number(),
      state: v.union(v.literal("open"), v.literal("closed"), v.literal("merged")),
      title: v.string(),
      body: v.optional(v.string()),
      authorLogin: v.optional(v.string()),
      headRef: v.string(),
      headSha: v.string(),
      baseRef: v.string(),
      baseSha: v.string(),
      draft: v.optional(v.boolean()),
      mergeable: v.optional(v.union(v.literal("unknown"), v.literal("true"), v.literal("false"))),
      mergeableState: v.optional(v.string()),
      requiredReviews: v.optional(v.number()),
      approvals: v.optional(v.number()),
      checks: v.optional(v.object({
        success: v.optional(v.number()),
        pending: v.optional(v.number()),
        failure: v.optional(v.number()),
      })),
      createdAtIso: v.optional(v.string()),
      updatedAtIso: v.optional(v.string()),
      closedAtIso: v.optional(v.string()),
      mergedAtIso: v.optional(v.string()),
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
      sha: v.optional(v.string()),
    })),
    reviews: v.array(v.object({
      reviewerLogin: v.string(),
      state: v.union(
        v.literal("APPROVED"),
        v.literal("CHANGES_REQUESTED"),
        v.literal("COMMENTED"),
        v.literal("DISMISSED"),
        v.literal("PENDING")
      ),
      submittedAtIso: v.optional(v.string()),
      body: v.optional(v.string()),
    })),
    comments: v.array(v.object({
      commentId: v.number(),
      authorLogin: v.string(),
      body: v.string(),
      path: v.optional(v.string()),
      diffHunk: v.optional(v.string()),
      line: v.optional(v.number()),
      side: v.optional(v.string()),
      createdAtIso: v.optional(v.string()),
    })),
  },
  handler: async (ctx, args) => {
    const repoId = await resolveRepoId(ctx, args.owner, args.repo);

    // Upsert PR
    const prId = await ctx.db.insert("pull_requests", {
      repoId,
      number: args.pr.number,
      state: args.pr.state,
      title: args.pr.title,
      body: args.pr.body,
      authorLogin: args.pr.authorLogin,
      headRef: args.pr.headRef,
      headSha: args.pr.headSha,
      baseRef: args.pr.baseRef,
      baseSha: args.pr.baseSha,
      draft: args.pr.draft,
      mergeable: args.pr.mergeable,
      mergeableState: args.pr.mergeableState,
      requiredReviews: args.pr.requiredReviews,
      approvals: args.pr.approvals,
      checks: args.pr.checks,
      createdAtIso: args.pr.createdAtIso,
      updatedAtIso: args.pr.updatedAtIso,
      closedAtIso: args.pr.closedAtIso,
      mergedAtIso: args.pr.mergedAtIso,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Upsert files
    const fileIds = [];
    for (const file of args.files) {
      const fileId = await ctx.db.insert("pr_files", {
        repoId,
        number: args.pr.number,
        path: file.path,
        status: file.status,
        previousPath: file.previousPath,
        additions: file.additions,
        deletions: file.deletions,
        patch: file.patch,
        sha: file.sha,
        createdAt: Date.now(),
      });
      fileIds.push(fileId);
    }

    // Upsert reviews
    const reviewIds = [];
    for (const review of args.reviews) {
      const reviewId = await ctx.db.insert("pr_reviews", {
        repoId,
        number: args.pr.number,
        reviewerLogin: review.reviewerLogin,
        state: review.state,
        submittedAtIso: review.submittedAtIso,
        body: review.body,
        createdAt: Date.now(),
      });
      reviewIds.push(reviewId);
    }

    // Upsert comments
    const commentIds = [];
    for (const comment of args.comments) {
      const commentId = await ctx.db.insert("pr_comments", {
        repoId,
        number: args.pr.number,
        commentId: comment.commentId,
        authorLogin: comment.authorLogin,
        body: comment.body,
        path: comment.path,
        diffHunk: comment.diffHunk,
        line: comment.line,
        side: comment.side,
        createdAtIso: comment.createdAtIso,
        createdAt: Date.now(),
      });
      commentIds.push(commentId);
    }

    return {
      prId,
      fileIds,
      reviewIds,
      commentIds,
    };
  },
});

/**
 * Store a pull request with its metadata
 * This is used by the automated embedding pipeline
 */
export const storePullRequest = mutation({
  args: {
    repoId: v.number(),
    prData: v.object({}),
  },
  handler: async (ctx, args) => {
    try {
      console.log(`🔄 Storing pull request data`);

      const prData = args.prData as any;
      
      // Check if PR already exists
      const existingPR = await ctx.db
        .query("pull_requests")
        .withIndex("by_repo_number", (q) => 
          q.eq("repoId", args.repoId).eq("number", prData.number)
        )
        .first();

      if (existingPR) {
        // Update existing PR
        await ctx.db.patch(existingPR._id, {
          state: prData.state,
          title: prData.title,
          body: prData.body,
          authorLogin: prData.authorLogin,
          headRef: prData.headRef,
          headSha: prData.headSha,
          baseRef: prData.baseRef,
          baseSha: prData.baseSha,
          draft: prData.draft,
          mergeable: prData.mergeable,
          mergeableState: prData.mergeableState,
          requiredReviews: prData.requiredReviews,
          approvals: prData.approvals,
          checks: prData.checks,
          createdAtIso: prData.createdAtIso,
          updatedAtIso: prData.updatedAtIso,
          closedAtIso: prData.closedAtIso,
          mergedAtIso: prData.mergedAtIso,
          updatedAt: Date.now(),
        });
        
        console.log(`✅ Updated existing PR #${prData.number}`);
        return existingPR._id;
      }

      // Insert new PR
      const prId = await ctx.db.insert("pull_requests", {
        repoId: args.repoId,
        number: prData.number,
        state: prData.state,
        title: prData.title,
        body: prData.body,
        authorLogin: prData.authorLogin,
        headRef: prData.headRef,
        headSha: prData.headSha,
        baseRef: prData.baseRef,
        baseSha: prData.baseSha,
        draft: prData.draft,
        mergeable: prData.mergeable,
        mergeableState: prData.mergeableState,
        requiredReviews: prData.requiredReviews,
        approvals: prData.approvals,
        checks: prData.checks,
        createdAtIso: prData.createdAtIso,
        updatedAtIso: prData.updatedAtIso,
        closedAtIso: prData.closedAtIso,
        mergedAtIso: prData.mergedAtIso,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      console.log(`✅ Stored new PR #${prData.number}`);
      return prId;

    } catch (error) {
      console.error(`❌ Failed to store pull request:`, error);
      throw error;
    }
  },
});
