import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

// Get all chats for the current user
export const getUserChats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    return await ctx.db
      .query("chats")
      .withIndex("by_user_id", (q) => q.eq("userId", identity.subject))
      .order("desc")
      .collect();
  },
});

// Create a new chat
export const createChat = mutation({
  args: {
    title: v.string(),
    initialMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const messages = args.initialMessage 
      ? [{
          role: "user" as const,
          content: args.initialMessage,
          timestamp: Date.now(),
        }]
      : [];

    return await ctx.db.insert("chats", {
      userId: identity.subject,
      title: args.title,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Add a message to a chat
export const addMessage = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== identity.subject) {
      throw new Error("Chat not found or unauthorized");
    }

    const newMessage = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    };

    await ctx.db.patch(args.chatId, {
      messages: [...chat.messages, newMessage],
      updatedAt: Date.now(),
    });
  },
});

// Get a specific chat
export const getChat = query({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== identity.subject) {
      return null;
    }

    return chat;
  },
});

// Delete a chat
export const deleteChat = mutation({
  args: { chatId: v.id("chats") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== identity.subject) {
      throw new Error("Chat not found or unauthorized");
    }

    await ctx.db.delete(args.chatId);
  },
});


// Create a new chat without authentication (for CLI)
export const createChatSimple = mutation({
  args: {
    initialMessage: v.string(),
    userId: v.string(), // Pass userId directly
  },
  handler: async (ctx, args) => {
    // Use the first message as the title (truncated to 50 chars)
    const title = args.initialMessage.length > 50 
      ? args.initialMessage.substring(0, 47) + "..." 
      : args.initialMessage;
    
    const messages = [{
      role: "user" as const,
      content: args.initialMessage,
      timestamp: Date.now(),
    }];

    return await ctx.db.insert("chats", {
      userId: args.userId,
      title,
      messages,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// Add a message to a chat without authentication (for CLI)
export const addMessageSimple = mutation({
  args: {
    chatId: v.id("chats"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    userId: v.string(), // Pass userId directly
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== args.userId) {
      throw new Error("Chat not found or unauthorized");
    }

    const newMessage = {
      role: args.role,
      content: args.content,
      timestamp: Date.now(),
    };

    await ctx.db.patch(args.chatId, {
      messages: [...chat.messages, newMessage],
      updatedAt: Date.now(),
    });
  },
});

// Get all chats for a user without authentication (for CLI)
export const getUserChatsSimple = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("chats")
      .withIndex("by_user_id", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

// Get a specific chat without authentication (for CLI)
export const getChatSimple = query({
  args: { 
    chatId: v.id("chats"),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    const chat = await ctx.db.get(args.chatId);
    if (!chat || chat.userId !== args.userId) {
      return null;
    }
    return chat;
  },
});
