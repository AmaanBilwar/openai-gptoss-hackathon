import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Create a new user
export const createUser = mutation({
  args: {
    username: v.string(),
    email: v.string(),
    password: v.optional(v.string()),
    githubId: v.optional(v.string()),
    githubUsername: v.optional(v.string()),
    githubAuthToken: v.optional(v.string()),
    githubEmail: v.optional(v.string()),
    betterAuthUserId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    
    const userId = await ctx.db.insert("users", {
      username: args.username,
      email: args.email,
      password: args.password,
      githubId: args.githubId,
      githubUsername: args.githubUsername,
      githubAuthToken: args.githubAuthToken,
      githubEmail: args.githubEmail,
      betterAuthUserId: args.betterAuthUserId,
      createdAt: now,
      updatedAt: now,
    });
    
    return userId;
  },
});

// Get current user from our users table
export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    
    // Try to find user by GitHub ID first
    if (identity.providerId === "github") {
      const user = await ctx.db
        .query("users")
        .withIndex("by_githubId", (q) => q.eq("githubId", identity.providerId))
        .unique();
      
      if (user) {
        return user;
      }
    }
    
    // Fallback: try to find by email
    if (identity.email) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_email", (q) => q.eq("email", identity.email))
        .unique();
      
      return user;
    }
    
    return null;
  },
});

// Get user by ID
export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.userId);
  },
});

// Update user
export const updateUser = mutation({
  args: {
    userId: v.id("users"),
    updates: v.object({
      username: v.optional(v.string()),
      email: v.optional(v.string()),
      githubUsername: v.optional(v.string()),
      githubAuthToken: v.optional(v.string()),
      githubAccessToken: v.optional(v.string()),
      githubEmail: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const updates = {
      ...args.updates,
      updatedAt: Date.now(),
    };
    
    await ctx.db.patch(args.userId, updates);
    return await ctx.db.get(args.userId);
  },
});

// Get user by Better Auth user ID
export const getUserByBetterAuthId = query({
  args: { betterAuthUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_betterAuthUserId", (q) => q.eq("betterAuthUserId", args.betterAuthUserId))
      .unique();
    
    return user;
  },
});

// Get user by email
export const getUserByEmail = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    
    return user;
  },
});

// Get user by GitHub ID
export const getUserByGitHubId = query({
  args: { githubId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_githubId", (q) => q.eq("githubId", args.githubId))
      .unique();
    
    return user;
  },
});

// Get all users (for admin purposes)
export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users;
  },
});
