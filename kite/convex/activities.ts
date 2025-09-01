import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Log activity
export const logActivity = mutation({
  args: {
    sessionId: v.optional(v.string()),
    toolName: v.string(),
    toolCategory: v.string(),
    status: v.string(),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    executionTimeMs: v.optional(v.number()),
    metadata: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.db.insert("activities", {
      userId: identity.subject,
      ...args,
      timestamp: Date.now(),
    });
  },
});

// Log CLI activity (for unauthenticated CLI usage)
export const logCliActivity = mutation({
  args: {
    sessionId: v.optional(v.string()),
    toolName: v.string(),
    toolCategory: v.string(),
    status: v.string(),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    executionTimeMs: v.optional(v.number()),
    metadata: v.optional(v.any()),
    cliUserId: v.optional(v.string()) // Optional CLI user identifier
  },
  handler: async (ctx, args) => {
    // For CLI usage, we'll create activities without authentication
    // This allows us to track CLI tool usage in the dashboard
    
    const { cliUserId, ...activityData } = args;
    
    return await ctx.db.insert("activities", {
      userId: cliUserId || "cli_user", // Default CLI user ID
      ...activityData,
      timestamp: Date.now(),
    });
  },
});

// Get recent activities for dashboard
export const getRecentActivities = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    
    try {
      if (!identity) {
        // For unauthenticated users, show CLI activities
        return await ctx.db
          .query("activities")
          .withIndex("by_user_timestamp", (q) => 
            q.eq("userId", "cli_user")
          )
          .order("desc")
          .take(args.limit || 50);
      }

      // For authenticated users, show their activities + CLI activities
      const userActivities = await ctx.db
        .query("activities")
        .withIndex("by_user_timestamp", (q) => 
          q.eq("userId", identity.subject)
        )
        .order("desc")
        .take(args.limit || 25);
        
      const cliActivities = await ctx.db
        .query("activities")
        .withIndex("by_user_timestamp", (q) => 
          q.eq("userId", "cli_user")
        )
        .order("desc")
        .take(args.limit || 25);
        
      // Merge and sort by timestamp
      const allActivities = [...userActivities, ...cliActivities]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, args.limit || 50);
        
      return allActivities;
    } catch (error) {
      console.error("Error fetching activities:", error);
      return [];
    }
  },
});

// Get activity stats for dashboard
export const getActivityStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    try {
      let activities = [];
      
      if (!identity) {
        // For unauthenticated users, show CLI activities
        activities = await ctx.db
          .query("activities")
          .withIndex("by_user_id", (q) => q.eq("userId", "cli_user"))
          .collect();
      } else {
        // For authenticated users, combine their activities + CLI activities
        const userActivities = await ctx.db
          .query("activities")
          .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
          .collect();
          
        const cliActivities = await ctx.db
          .query("activities")
          .withIndex("by_user_id", (q) => q.eq("userId", "cli_user"))
          .collect();
          
        activities = [...userActivities, ...cliActivities];
      }

      const total = activities.length;
      const successful = activities.filter(a => a.status === "completed").length;
      const failed = activities.filter(a => a.status === "failed").length;
      const last24h = activities.filter(a => 
        a.timestamp > Date.now() - (24 * 60 * 60 * 1000)
      ).length;

      return { 
        total, 
        successful, 
        failed, 
        last24h, 
        successRate: total > 0 ? (successful / total) * 100 : 0 
      };
    } catch (error) {
      console.error("Error fetching activity stats:", error);
      return { total: 0, successful: 0, failed: 0, last24h: 0, successRate: 0 };
    }
  },
});