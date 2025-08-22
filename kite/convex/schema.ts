import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

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
    userId: v.string(),
    name: v.string(),
    fullName: v.string(), // e.g., "owner/repo"
    url: v.string(),
    description: v.optional(v.string()),
    isPrivate: v.boolean(),
    createdAt: v.number(),
  }).index("by_user_id", ["userId"])
    .index("by_full_name", ["fullName"]),

  // RAG System Tables
  repos: defineTable({
    slug: v.string(), // e.g., "owner/repo"
    installationId: v.optional(v.string()),
    defaultBranch: v.string(),
  }).index("by_slug", ["slug"]),

  commits: defineTable({
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
    ingestedAt: v.optional(v.number()),
  }).index("by_repo_sha", ["repoId", "sha"])
    .index("by_repo_time", ["repoId", "timestamp"])
    .searchIndex("search_message", {
      searchField: "message",
      filterFields: ["repoId"],
    }),

  files: defineTable({
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
  }).index("by_commit_path", ["commitId", "path"]),

  hunks: defineTable({
    fileId: v.id("files"),
    hunkNo: v.number(), // 0..N
    rangeOld: v.object({
      start: v.number(),
      len: v.number(),
    }),
    rangeNew: v.object({
      start: v.number(),
      len: v.number(),
    }),
    patchHeader: v.string(), // the @@ ... @@ line
    beforeSnippet: v.string(), // trimmed to keep doc <1MB
    afterSnippet: v.string(), // trimmed to keep doc <1MB
  }).index("by_file_hunk", ["fileId", "hunkNo"]),

  summaries_hunk: defineTable({
    hunkId: v.id("hunks"),
    whySummary: v.string(), // 1-3 sentences
    riskTags: v.array(v.string()),
    modelId: v.string(),
    createdAt: v.number(),
  }).index("by_hunk", ["hunkId"]),

  summaries_commit: defineTable({
    commitId: v.id("commits"),
    bullets: v.array(v.string()), // 4-6 bullets
    modelId: v.string(),
    createdAt: v.number(),
  }).index("by_commit", ["commitId"]),

  prs: defineTable({
    repoId: v.id("repos"),
    number: v.number(),
    title: v.string(),
    body: v.string(),
    state: v.string(),
    labels: v.array(v.string()),
    mergeable: v.optional(v.boolean()),
    requiredChecks: v.optional(v.array(v.string())),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_repo_number", ["repoId", "number"])
    .searchIndex("search_pr", {
      searchField: "title",
      filterFields: ["repoId"],
    }),

  pr_files: defineTable({
    prId: v.id("prs"),
    path: v.string(),
    status: v.string(),
    patchHeader: v.optional(v.string()),
    stats: v.optional(v.object({
      additions: v.number(),
      deletions: v.number(),
      changes: v.number(),
    })),
    hunksRef: v.optional(v.array(v.id("hunks"))),
  }).index("by_pr_path", ["prId", "path"]),

  pr_comments: defineTable({
    prId: v.id("prs"),
    author: v.string(),
    body: v.string(),
    createdAt: v.number(),
    filePath: v.optional(v.string()),
    line: v.optional(v.number()),
    type: v.union(v.literal("review"), v.literal("inline"), v.literal("issue")),
  }).index("by_pr_time", ["prId", "createdAt"]),

  embeddings_hunk: defineTable({
    repoId: v.id("repos"),
    commitId: v.id("commits"),
    filePath: v.string(),
    hunkId: v.id("hunks"),
    embedding: v.array(v.float64()), // dim = 1024 for BGE-M3
  }).vectorIndex("by_embedding", {
    vectorField: "embedding",
    dimensions: 1024,
    filterFields: ["repoId", "commitId"],
  }),

  answers: defineTable({
    scope: v.union(v.literal("commit"), v.literal("pr")),
    commitId: v.optional(v.id("commits")),
    prId: v.optional(v.id("prs")),
    questionHash: v.string(),
    topContext: v.array(v.object({
      hunkId: v.id("hunks"),
      filePath: v.string(),
      range: v.object({
        start: v.number(),
        end: v.number(),
      }),
    })),
    answerText: v.string(),
    citations: v.array(v.string()),
    latencyMs: v.number(),
    modelId: v.string(),
    thumb: v.optional(v.union(v.literal("up"), v.literal("down"))),
  }).index("by_scope_key", ["scope", "commitId", "prId", "questionHash"]),

  // Webhook events for debugging
  events_webhook: defineTable({
    eventType: v.string(),
    payload: v.any(),
    processed: v.boolean(),
    createdAt: v.number(),
  }).index("by_type_time", ["eventType", "createdAt"]),
});
