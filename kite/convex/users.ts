import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get current user profile
export const getCurrentUser = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("users"),
      userId: v.string(),
      name: v.string(),
      email: v.string(),
      avatar: v.optional(v.string()),
      bio: v.optional(v.string()),
      location: v.optional(v.string()),
      followers: v.optional(v.number()),
      following: v.optional(v.number()),
      githubUsername: v.optional(v.string()),
      // Plan and subscription information
      planType: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))),
      planStatus: v.optional(v.union(v.literal("active"), v.literal("cancelled"), v.literal("expired"), v.literal("trial"))),
      planStartDate: v.optional(v.number()),
      planEndDate: v.optional(v.number()),
      // Usage tracking
      standardCreditsUsed: v.optional(v.number()),
      standardCreditsTotal: v.optional(v.number()),
      premiumCreditsUsed: v.optional(v.number()),
      premiumCreditsTotal: v.optional(v.number()),
      lastUsageReset: v.optional(v.number()),
      _creationTime: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .unique();

    return user;
  },
});

// Get current user settings
export const getUserSettings = query({
  args: {},
  returns: v.union(
    v.object({
      _id: v.id("settings"),
      _creationTime: v.number(),
      userId: v.string(),
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
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .unique();

    return settings;
  },
});

// Create or update user profile
export const upsertUser = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    avatar: v.optional(v.string()),
    bio: v.optional(v.string()),
    location: v.optional(v.string()),
    followers: v.optional(v.number()),
    following: v.optional(v.number()),
    githubUsername: v.optional(v.string()),
    // Plan and subscription information
    planType: v.optional(v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise"))),
    planStatus: v.optional(v.union(v.literal("active"), v.literal("cancelled"), v.literal("expired"), v.literal("trial"))),
    planStartDate: v.optional(v.number()),
    planEndDate: v.optional(v.number()),
    // Usage tracking
    standardCreditsUsed: v.optional(v.number()),
    standardCreditsTotal: v.optional(v.number()),
    premiumCreditsUsed: v.optional(v.number()),
    premiumCreditsTotal: v.optional(v.number()),
    lastUsageReset: v.optional(v.number()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .unique();

    if (existingUser) {
      // Update existing user
      await ctx.db.patch(existingUser._id, {
        name: args.name,
        email: args.email,
        avatar: args.avatar,
        bio: args.bio,
        location: args.location,
        followers: args.followers,
        following: args.following,
        githubUsername: args.githubUsername,
        planType: args.planType,
        planStatus: args.planStatus,
        planStartDate: args.planStartDate,
        planEndDate: args.planEndDate,
        standardCreditsUsed: args.standardCreditsUsed,
        standardCreditsTotal: args.standardCreditsTotal,
        premiumCreditsUsed: args.premiumCreditsUsed,
        premiumCreditsTotal: args.premiumCreditsTotal,
        lastUsageReset: args.lastUsageReset,
      });
      return existingUser._id;
    } else {
      // Create new user with default values
      return await ctx.db.insert("users", {
        userId: identity.subject,
        name: args.name,
        email: args.email,
        avatar: args.avatar,
        bio: args.bio,
        location: args.location,
        followers: args.followers || 0,
        following: args.following || 0,
        githubUsername: args.githubUsername,
        planType: args.planType || "free",
        planStatus: args.planStatus || "trial",
        planStartDate: args.planStartDate || Date.now(),
        planEndDate: args.planEndDate,
        standardCreditsUsed: args.standardCreditsUsed || 0,
        standardCreditsTotal: args.standardCreditsTotal || 100,
        premiumCreditsUsed: args.premiumCreditsUsed || 0,
        premiumCreditsTotal: args.premiumCreditsTotal || 0,
        lastUsageReset: args.lastUsageReset || Date.now(),
      });
    }
  },
});

// Create or update user settings
export const upsertUserSettings = mutation({
  args: {
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
  },
  returns: v.id("settings"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existingSettings = await ctx.db
      .query("settings")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .unique();

    const now = Date.now();

    if (existingSettings) {
      // Update existing settings
      await ctx.db.patch(existingSettings._id, {
        ...args,
        updatedAt: now,
      });
      return existingSettings._id;
    } else {
      // Create new settings with defaults
      return await ctx.db.insert("settings", {
        userId: identity.subject,
        theme: args.theme || "dark",
        accentColor: args.accentColor || "orange",
        fontSize: args.fontSize || "medium",
        compactMode: args.compactMode || false,
        showSidebar: args.showSidebar || true,
        animations: args.animations || true,
        language: args.language || "en",
        timezone: args.timezone || "UTC",
        dateFormat: args.dateFormat || "mm/dd/yyyy",
        emailReceipts: args.emailReceipts || false,
        securityAlerts: args.securityAlerts || true,
        productUpdates: args.productUpdates || true,
        marketingCommunications: args.marketingCommunications || false,
        activityUpdates: args.activityUpdates || true,
        reminders: args.reminders || false,
        apiPermissions: args.apiPermissions || {
          readAccess: true,
          writeAccess: true,
          adminAccess: false,
        },
        autoRenew: args.autoRenew || true,
        twoFactorEnabled: args.twoFactorEnabled || false,
        publicProfile: args.publicProfile || false,
        createdAt: now,
        updatedAt: now,
      });
    }
  },
});

// Update user usage credits
export const updateUserCredits = mutation({
  args: {
    standardCreditsUsed: v.optional(v.number()),
    premiumCreditsUsed: v.optional(v.number()),
    resetUsage: v.optional(v.boolean()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const updateData: any = {};
    
    if (args.resetUsage) {
      updateData.standardCreditsUsed = 0;
      updateData.premiumCreditsUsed = 0;
      updateData.lastUsageReset = Date.now();
    } else {
      if (args.standardCreditsUsed !== undefined) {
        updateData.standardCreditsUsed = args.standardCreditsUsed;
      }
      if (args.premiumCreditsUsed !== undefined) {
        updateData.premiumCreditsUsed = args.premiumCreditsUsed;
      }
    }

    await ctx.db.patch(user._id, updateData);
    return true;
  },
});

// Update user plan
export const updateUserPlan = mutation({
  args: {
    planType: v.union(v.literal("free"), v.literal("pro"), v.literal("enterprise")),
    planStatus: v.union(v.literal("active"), v.literal("cancelled"), v.literal("expired"), v.literal("trial")),
    planStartDate: v.optional(v.number()),
    planEndDate: v.optional(v.number()),
    standardCreditsTotal: v.optional(v.number()),
    premiumCreditsTotal: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const updateData: any = {
      planType: args.planType,
      planStatus: args.planStatus,
    };

    if (args.planStartDate) updateData.planStartDate = args.planStartDate;
    if (args.planEndDate) updateData.planEndDate = args.planEndDate;
    if (args.standardCreditsTotal) updateData.standardCreditsTotal = args.standardCreditsTotal;
    if (args.premiumCreditsTotal) updateData.premiumCreditsTotal = args.premiumCreditsTotal;

    await ctx.db.patch(user._id, updateData);
    return true;
  },
});
