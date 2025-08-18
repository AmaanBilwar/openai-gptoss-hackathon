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
