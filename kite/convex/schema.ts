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
    // Plan and subscription information
    planType: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))),
    planStatus: v.optional(v.union(v.literal("active"), v.literal("cancelled"), v.literal("expired"), v.literal("trial"))),
    planStartDate: v.optional(v.number()), // timestamp
    planEndDate: v.optional(v.number()), // timestamp
    // Usage tracking
    standardCreditsUsed: v.optional(v.number()),
    standardCreditsTotal: v.optional(v.number()),
    premiumCreditsUsed: v.optional(v.number()),
    premiumCreditsTotal: v.optional(v.number()),
    lastUsageReset: v.optional(v.number()), // timestamp
  }).index("by_user_id", ["userId"]),

  settings: defineTable({
    userId: v.string(), // Clerk user ID
    // Appearance settings
    theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("auto"))),
    accentColor: v.optional(v.union(v.literal("orange"), v.literal("blue"), v.literal("green"), v.literal("purple"))),
    fontSize: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
    compactMode: v.optional(v.boolean()),
    showSidebar: v.optional(v.boolean()),
    animations: v.optional(v.boolean()),
    
    // Language and regional settings
    language: v.optional(v.union(v.literal("en"), v.literal("es"), v.literal("fr"), v.literal("de"))),
    timezone: v.optional(v.string()),
    dateFormat: v.optional(v.union(v.literal("mm/dd/yyyy"), v.literal("dd/mm/yyyy"), v.literal("yyyy-mm-dd"))),
    
    // Notification preferences
    emailReceipts: v.optional(v.boolean()),
    securityAlerts: v.optional(v.boolean()),
    productUpdates: v.optional(v.boolean()),
    marketingCommunications: v.optional(v.boolean()),
    activityUpdates: v.optional(v.boolean()),
    reminders: v.optional(v.boolean()),
    
    // API and integration settings
    apiKey: v.optional(v.string()),
    apiPermissions: v.optional(v.object({
      readAccess: v.boolean(),
      writeAccess: v.boolean(),
      adminAccess: v.boolean(),
    })),
    
    // Billing preferences
    autoRenew: v.optional(v.boolean()),
    paymentMethod: v.optional(v.string()),
    
    // Privacy and security
    twoFactorEnabled: v.optional(v.boolean()),
    publicProfile: v.optional(v.boolean()),
    
    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
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
    .index("by_user_timestamp", ["userId", "timestamp"]),
});
