import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all repositories for the current user
export const getUserRepositories = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("repositories")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

// Add a repository
export const addRepository = mutation({
  args: {
    repoId: v.number(),
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    htmlUrl: v.string(),
    description: v.optional(v.string()),
    private: v.boolean(),
    defaultBranch: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if repository already exists for this user
    const existingRepo = await ctx.db
      .query("repositories")
      .withIndex("by_full_name", (q) => q.eq("fullName", args.fullName))
      .first();

    if (existingRepo && existingRepo.userId === identity.subject) {
      return existingRepo._id;
    }

    return await ctx.db.insert("repositories", {
      userId: identity.subject,
      repoId: args.repoId,
      owner: args.owner,
      name: args.name,
      fullName: args.fullName,
      htmlUrl: args.htmlUrl,
      description: args.description,
      private: args.private,
      defaultBranch: args.defaultBranch,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Get a specific repository
export const getRepository = query({
  args: { repositoryId: v.id("repositories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const repository = await ctx.db.get(args.repositoryId);
    if (!repository || repository.userId !== identity.subject) {
      return null;
    }

    return repository;
  },
});

// Get repository by full name (owner/repo)
export const getRepositoryByFullName = query({
  args: { fullName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return await ctx.db
      .query("repositories")
      .withIndex("by_full_name", (q) => q.eq("fullName", args.fullName))
      .first();
  },
});

// Get repository by repoId (for internal use)
export const getRepositoryById = query({
  args: { repoId: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("repositories")
      .withIndex("by_repo_id", (q) => q.eq("repoId", args.repoId))
      .first();
  },
});

// Remove a repository
export const removeRepository = mutation({
  args: { repositoryId: v.id("repositories") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const repository = await ctx.db.get(args.repositoryId);
    if (!repository || repository.userId !== identity.subject) {
      throw new Error("Repository not found or unauthorized");
    }

    await ctx.db.delete(args.repositoryId);
  },
});
