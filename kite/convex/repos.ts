import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getRepoBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const repo = await ctx.db
      .query("repos")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .unique();
    return repo?._id;
  },
});

export const createRepo = mutation({
  args: {
    slug: v.string(),
    defaultBranch: v.string(),
    installationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("repos", {
      slug: args.slug,
      defaultBranch: args.defaultBranch,
      installationId: args.installationId,
    });
  },
});
