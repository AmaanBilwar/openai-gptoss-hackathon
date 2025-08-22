import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getPRByNumber = query({
  args: { 
    repoId: v.id("repos"),
    number: v.number() 
  },
  handler: async (ctx, args) => {
    const pr = await ctx.db
      .query("prs")
      .withIndex("by_repo_number", (q) => 
        q.eq("repoId", args.repoId).eq("number", args.number)
      )
      .unique();
    return pr?._id;
  },
});

export const upsertPR = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    // Check if PR exists
    const existingPR = await ctx.db
      .query("prs")
      .withIndex("by_repo_number", (q) => 
        q.eq("repoId", args.repoId).eq("number", args.number)
      )
      .unique();

    if (existingPR) {
      // Update existing PR
      await ctx.db.patch(existingPR._id, {
        title: args.title,
        body: args.body,
        state: args.state,
        labels: args.labels,
        mergeable: args.mergeable,
        requiredChecks: args.requiredChecks,
        updatedAt: args.updatedAt,
      });
      return existingPR._id;
    } else {
      // Create new PR
      return await ctx.db.insert("prs", {
        repoId: args.repoId,
        number: args.number,
        title: args.title,
        body: args.body,
        state: args.state,
        labels: args.labels,
        mergeable: args.mergeable,
        requiredChecks: args.requiredChecks,
        createdAt: args.createdAt,
        updatedAt: args.updatedAt,
      });
    }
  },
});
