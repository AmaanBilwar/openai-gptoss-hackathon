import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Your application tables
  users: defineTable({
    username: v.optional(v.string()),
    email: v.string(),
  }).index("by_email", ["email"]),
  todos: defineTable({
    userId: v.id("users"),
    text: v.string(),
    completed: v.boolean(),
  }).index("by_user", ["userId"]),
});