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

  activities: defineTable({
    userId: v.string(), // Clerk user ID
    sessionId: v.optional(v.string()), // Group related activities
    toolName: v.string(), // e.g., "create_pull_request", "list_repos"
    toolCategory: v.string(), // e.g., "github", "ai", "file_ops"
    status: v.string(), // "started", "completed", "failed"
    input: v.optional(v.any()), // Tool input parameters (sanitized)
    output: v.optional(v.any()), // Tool output (sanitized)
    error: v.optional(v.string()), // Error message if failed
    executionTimeMs: v.optional(v.number()),
    timestamp: v.number(),
    metadata: v.optional(v.object({
      repository: v.optional(v.string()),
      pullRequestNumber: v.optional(v.number()),
      branch: v.optional(v.string()),
      affectedFiles: v.optional(v.array(v.string())),
    }))
  }).index("by_user_id", ["userId"])
    .index("by_tool_name", ["toolName"])
    .index("by_timestamp", ["timestamp"])
    .index("by_user_timestamp", ["userId", "timestamp"])
});
