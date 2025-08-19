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
});
