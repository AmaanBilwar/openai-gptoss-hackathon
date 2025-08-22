import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getAnswer = query({
  args: {
    scope: v.union(v.literal("commit"), v.literal("pr")),
    commitId: v.optional(v.id("commits")),
    prId: v.optional(v.id("prs")),
    questionHash: v.string(),
  },
  handler: async (ctx, args) => {
    const key = args.scope === "commit" ? args.commitId : args.prId;
    if (!key) return null;
    
    // Use a simple query instead of the index for now
    const answers = await ctx.db
      .query("answers")
      .filter((q) => 
        q.eq(q.field("scope"), args.scope) &&
        q.eq(q.field("questionHash"), args.questionHash) &&
        (args.scope === "commit" 
          ? q.eq(q.field("commitId"), args.commitId)
          : q.eq(q.field("prId"), args.prId))
      )
      .collect();
    
    return answers[0] || null;
  },
});

export const createAnswer = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("answers", {
      scope: args.scope,
      commitId: args.commitId,
      prId: args.prId,
      questionHash: args.questionHash,
      topContext: args.topContext,
      answerText: args.answerText,
      citations: args.citations,
      latencyMs: args.latencyMs,
      modelId: args.modelId,
      thumb: args.thumb,
    });
  },
});
