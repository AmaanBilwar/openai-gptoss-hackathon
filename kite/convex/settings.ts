import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Temporary mutation to clear all settings data
export const clearAllSettings = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Delete all settings documents
    const allSettings = await ctx.db.query("settings").collect();
    for (const setting of allSettings) {
      await ctx.db.delete(setting._id);
    }
    
    return { deleted: allSettings.length, message: "All settings cleared" };
  },
});

// Get user settings
export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    return settings;
  },
});

// Update theme setting
export const updateTheme = mutation({
  args: {
    theme: v.union(v.literal("light"), v.literal("dark"), v.literal("auto")),
  },
  handler: async (ctx, { theme }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if settings exist for this user
    const existingSettings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        theme,
        updatedAt: Date.now(),
      });
      return existingSettings._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("settings", {
        userId: identity.subject,
        theme,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return settingsId;
    }
  },
});

// Update multiple settings at once
export const updateSettings = mutation({
  args: {
    settings: v.object({
      theme: v.optional(v.union(v.literal("light"), v.literal("dark"), v.literal("auto"))),
      accentColor: v.optional(v.union(v.literal("orange"), v.literal("blue"), v.literal("green"), v.literal("purple"))),
      fontSize: v.optional(v.union(v.literal("small"), v.literal("medium"), v.literal("large"))),
      compactMode: v.optional(v.boolean()),
      showSidebar: v.optional(v.boolean()),
      animations: v.optional(v.boolean()),
      language: v.optional(v.union(v.literal("en"), v.literal("es"), v.literal("fr"), v.literal("de"))),
      timezone: v.optional(v.string()),
      dateFormat: v.optional(v.union(v.literal("mm/dd/yyyy"), v.literal("dd/mm/yyyy"), v.literal("yyyy-mm-dd"))),
      emailReceipts: v.optional(v.boolean()),
      securityAlerts: v.optional(v.boolean()),
      productUpdates: v.optional(v.boolean()),
      marketingCommunications: v.optional(v.boolean()),
      activityUpdates: v.optional(v.boolean()),
      reminders: v.optional(v.boolean()),
      autoRenew: v.optional(v.boolean()),
      publicProfile: v.optional(v.boolean()),
    }),
  },
  handler: async (ctx, { settings }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Check if settings exist for this user
    const existingSettings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .first();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        ...settings,
        updatedAt: Date.now(),
      });
      return existingSettings._id;
    } else {
      // Create new settings
      const settingsId = await ctx.db.insert("settings", {
        userId: identity.subject,
        ...settings,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return settingsId;
    }
  },
});
