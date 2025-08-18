import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  users: defineTable({
    // Basic user information
    username: v.string(),
    email: v.string(),
    password: v.optional(v.string()), // Optional for social login users
    
    // GitHub authentication data
    githubId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    githubAuthToken: v.optional(v.string()),
    githubAccessToken: v.optional(v.string()), // OAuth access token
    githubEmail: v.optional(v.string()),
    
    // Better Auth integration
    betterAuthUserId: v.optional(v.string()),
    
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_email", ["email"])
    .index("by_githubId", ["githubId"])
    .index("by_betterAuthUserId", ["betterAuthUserId"]),
});
