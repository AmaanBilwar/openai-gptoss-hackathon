import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const now = () => v.number();

export default defineSchema({
  users: defineTable({
    userId: v.string(), // Clerk user ID
    name: v.string(),
    email: v.string(),
    avatar: v.optional(v.string()),
  bio: v.optional(v.string()),
  location: v.optional(v.string()),
  followers: v.optional(v.number()), // follower count
  following: v.optional(v.number()), // following count
  githubUsername: v.optional(v.string()),
  }).index("by_user_id", ["userId"]),

  chats: defineTable({
    userId: v.string(),
    title: v.string(),
    messages: v.array(v.object({
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      timestamp: v.number(),
    })),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user_id", ["userId"]),

  repositories: defineTable({
    userId: v.string(),             // owner in your app (who added/authorized)
    repoId: v.number(),             // GitHub repository id
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),           // owner/name
    description: v.optional(v.string()),
    private: v.boolean(),
    archived: v.optional(v.boolean()),
    defaultBranch: v.string(),
    htmlUrl: v.string(),
    sshUrl: v.optional(v.string()),
    cloneUrl: v.optional(v.string()),
    pushedAtIso: v.optional(v.string()),
    createdAtIso: v.optional(v.string()),
    updatedAtIso: v.optional(v.string()),
    // for branch protection summaries you persist
    hasBranchProtection: v.optional(v.boolean()),
    createdAt: now(),
    updatedAt: now(),
  })
    .index("by_user_id", ["userId"])
    .index("by_full_name", ["fullName"])
    .index("by_repo_id", ["repoId"]),

  branches: defineTable({
    repoId: v.number(),
    name: v.string(),
    headSha: v.string(),
    etag: v.optional(v.string()),           // for conditional GETs
    protected: v.optional(v.boolean()),
    protection: v.optional(
      v.object({
        requiredStatusChecks: v.optional(v.array(v.string())),
        requiredApprovingReviewCount: v.optional(v.number()),
        enforceAdmins: v.optional(v.boolean()),
        allowForcePushes: v.optional(v.boolean()),
        allowDeletions: v.optional(v.boolean()),
        // add fields you actually consume
      })
    ),
    updatedAt: now(),
  }).index("by_repo_branch", ["repoId", "name"])
    .index("by_repo", ["repoId"]),

  webhooks: defineTable({
    repoId: v.number(),
    webhookId: v.optional(v.number()), // GitHub webhook id if created
    events: v.array(v.string()),
    secretHash: v.optional(v.string()), // HMAC key hash/fingerprint
    active: v.boolean(),
    lastDeliveryId: v.optional(v.string()),
    createdAt: now(),
    updatedAt: now(),
  }).index("by_repo", ["repoId"]),

  commits: defineTable({
    repoId: v.number(),
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
    stats: v.optional(
      v.object({
        additions: v.optional(v.number()),
        deletions: v.optional(v.number()),
        filesChanged: v.optional(v.number()),
      })
    ),
    createdAt: now(),
  }).index("by_repo_sha", ["repoId", "sha"])
    .index("by_repo_authored", ["repoId", "authoredDateIso"]),

  commit_files: defineTable({
    repoId: v.number(),
    sha: v.string(),       // commit sha
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
    previousPath: v.optional(v.string()), // for renames
    additions: v.optional(v.number()),
    deletions: v.optional(v.number()),
    patch: v.optional(v.string()), // unified diff for this file in the commit
    blobShaBefore: v.optional(v.string()),
    blobShaAfter: v.optional(v.string()),
    createdAt: now(),
  }).index("by_repo_commit", ["repoId", "sha"])
    .index("by_repo_path", ["repoId", "path"]),

  hunks: defineTable({
    // smallest RAG unit (an @@ ... @@ section)
    repoId: v.number(),
    sha: v.string(),      // commit sha (or PR aggregate sha if you materialize)
    path: v.string(),
    hunkIndex: v.number(), // 0..N within that file diff
    header: v.string(),    // @@ -a,b +c,d @@ …
    // line ranges (optional but handy for citation)
    oldStart: v.optional(v.number()),
    oldLines: v.optional(v.number()),
    newStart: v.optional(v.number()),
    newLines: v.optional(v.number()),
    // raw hunk text (small; consider truncation policy)
    hunk: v.string(),
    // LLM-generated mini summary for retrieval
    summary: v.optional(v.string()),
    // lightweight labels/tags (e.g., "fix", "refactor")
    labels: v.optional(v.array(v.string())),
    createdAt: now(),
  }).index("by_repo_commit_path", ["repoId", "sha", "path"])
    .index("by_repo_path", ["repoId", "path"]),
    
  // Optional: generic embeddings table to support commit/PR RAG
  // You can shard by "scope" to keep queries fast.
  embeddings: defineTable({
    repoId: v.number(),
    scope: v.union(
      v.literal("commit_hunk"),
      v.literal("pr_file"),
      v.literal("pr_comment"),
      v.literal("commit_msg")
    ),
    // keys to find the source chunk
    sha: v.optional(v.string()),          // commit sha (for commit_hunk/commit_msg)
    prNumber: v.optional(v.number()),     // for PR scopes
    path: v.optional(v.string()),
    hunkId: v.optional(v.id("hunks")),
    // vector & text preview
    embedding: v.array(v.number()),       // e.g., 768-d
    dim: v.number(),
    text: v.optional(v.string()),         // short preview/debug
    createdAt: now(),
  }).index("by_repo_scope", ["repoId", "scope"])
    .index("by_repo_pr", ["repoId", "prNumber"]),
  // If Convex vector indexes are enabled in your project:
  // .vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 768, filterFields: ["repoId","scope","prNumber"] })

  pull_requests: defineTable({
    repoId: v.number(),
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
    mergeableState: v.optional(v.string()), // GitHub mergeable_state string
    // quick rollup for gating
    requiredReviews: v.optional(v.number()),
    approvals: v.optional(v.number()),
    checks: v.optional(
      v.object({
        success: v.optional(v.number()),
        pending: v.optional(v.number()),
        failure: v.optional(v.number()),
      })
    ),
    createdAtIso: v.optional(v.string()),
    updatedAtIso: v.optional(v.string()),
    closedAtIso: v.optional(v.string()),
    mergedAtIso: v.optional(v.string()),
    createdAt: now(),
    updatedAt: now(),
  }).index("by_repo_number", ["repoId", "number"])
    .index("by_repo_state", ["repoId", "state"]),

  pr_files: defineTable({
    repoId: v.number(),
    number: v.number(),
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
    patch: v.optional(v.string()), // unified diff for this file within the PR
    sha: v.optional(v.string()),   // blobSha
    createdAt: now(),
  })
    .index("by_repo_pr", ["repoId", "number"])
    .index("by_repo_pr_path", ["repoId", "number", "path"]),

  pr_reviews: defineTable({
    repoId: v.number(),
    number: v.number(),
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
    createdAt: now(),
  }).index("by_repo_pr", ["repoId", "number"]),

  pr_comments: defineTable({
    repoId: v.number(),
    number: v.number(),
    commentId: v.number(),
    authorLogin: v.string(),
    body: v.string(),
    path: v.optional(v.string()),
    // positions relative to diff, if provided
    diffHunk: v.optional(v.string()),
    line: v.optional(v.number()),
    side: v.optional(v.string()), // "LEFT"/"RIGHT"
    createdAtIso: v.optional(v.string()),
    createdAt: now(),
  }).index("by_repo_pr", ["repoId", "number"])
    .index("by_repo_pr_path", ["repoId", "number", "path"]),

  summaries: defineTable({
    // cached LLM rollups for speed
    kind: v.union(
      v.literal("commit"),
      v.literal("commit_file"),
      v.literal("pr"),
      v.literal("pr_file")
    ),
    repoId: v.number(),
    sha: v.optional(v.string()),
    prNumber: v.optional(v.number()),
    path: v.optional(v.string()),
    summary: v.string(),  // compact "why/what/impact"
    model: v.optional(v.string()),
    createdAt: now(),
    updatedAt: now(),
  })
    .index("by_commit", ["repoId", "sha"])
    .index("by_pr", ["repoId", "prNumber"])
    .index("by_pr_file", ["repoId", "prNumber", "path"]),
    
  // Placeholder for Amaan's PR Splitting feature
  split_plans: defineTable({
    // intelligent PR split artifacts (optional but future-proof)
    repoId: v.number(),
    baseSha: v.string(),
    plan: v.object({}),     // clusters → files/hunks; safe to store compact JSON
    rationale: v.optional(v.string()),
    createdByUserId: v.string(),
    createdAt: now(),
  }).index("by_repo_base", ["repoId", "baseSha"]),

  // Placeholer for Ani's merge conflicts feature
  conflicts: defineTable({
    // merge conflict resolver artifacts
    repoId: v.number(),
    prNumber: v.number(),
    path: v.string(),
    ours: v.string(),    // extracted code block
    theirs: v.string(),
    context: v.optional(v.string()),
    resolutionPatch: v.optional(v.string()),
    postedCommentId: v.optional(v.number()),
    createdAt: now(),
  }).index("by_repo_pr_path", ["repoId", "prNumber", "path"]),

  // Audit Log(for dashboard, to be integrated later)
  audit_log: defineTable({
    // who/what/when for any tool call
    userId: v.optional(v.string()),
    tool: v.string(), // e.g., "get_user_info", "merge_pr", "rag_query"
    target: v.optional(v.object({
      repoId: v.optional(v.number()),
      fullName: v.optional(v.string()),
      branch: v.optional(v.string()),
      prNumber: v.optional(v.number()),
      sha: v.optional(v.string()),
    })),
    inputsHash: v.optional(v.string()),
    status: v.union(v.literal("ok"), v.literal("error")),
    error: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    createdAt: now(),
  }).index("by_tool", ["tool"]),

});
