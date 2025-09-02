#!/usr/bin/env tsx

import express from 'express';
import cors from 'cors';
import { GPTOSSToolCaller } from './toolCalling';
import { TokenStore } from './tokenStore';
import { parseMarkdownToText } from './markdownParser';
import { ChatMessage } from './types';
import { validateConfig } from './config';
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";


const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize the token store; callers will be constructed per request to inject user headers
const tokenStore = new TokenStore();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Kite API is running',
    timestamp: new Date().toISOString()
  });
});

// Authentication status endpoint
app.get('/auth/status', async (req, res) => {
  try {
    const isAuthenticated = await tokenStore.isAuthenticated();
    res.json({ authenticated: isAuthenticated });
  } catch (error) {
    console.error('Error checking auth status:', error);
    res.status(500).json({ 
      error: 'Failed to check auth status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Tools execution endpoint
app.post('/api/tools/execute', async (req, res) => {
  try {
    const { tool, parameters } = req.body;

    if (!tool || typeof tool !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Tool name is required and must be a string'
      });
    }

    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Parameters are required and must be an object'
      });
    }

    // Check authentication
    const hasAuth = await tokenStore.getConvexToken();
    if (!hasAuth) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Execute the tool with activity logging
    const toolCall = {
      function: {
        name: tool,
        arguments: JSON.stringify(parameters)
      }
    };
    const smApiKey = process.env.SUPERMEMORY_API_KEY;
    // Best-effort user id resolution
    let smUserId: string | undefined = process.env.CLI_USER_ID;
    try {
      const convexClient = await getConvexClientWithAuth();
      const hasAuth = await tokenStore.getConvexToken();
      if (hasAuth) {
        const user = await convexClient.query(api.users.getCurrentUser, {});
        if (user && (user as any).userId) smUserId = (user as any).userId;
      }
    } catch {}

    const caller = new GPTOSSToolCaller('gpt-oss-120b', {
      supermemoryApiKey: smApiKey,
      smUserId
    });

    const result = await caller.callTool(toolCall);
    return res.json(result);

  } catch (error) {
    console.error('Tool execution error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { messages, stream = false, model = 'medium', userId } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Convert messages to internal format
    const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    
    const smApiKey = process.env.SUPERMEMORY_API_KEY;
    let smUserId: string | undefined = userId as string | undefined;
    if (!smUserId) {
      try {
        const convexClient = await getConvexClientWithAuth();
        const hasAuth = await tokenStore.getConvexToken();
        if (hasAuth) {
          const user = await convexClient.query(api.users.getCurrentUser, {});
          if (user && (user as any).userId) smUserId = (user as any).userId;
        }
      } catch {}
    }
    if (!smUserId) {
      smUserId = process.env.CLI_USER_ID || 'unknown-user';
    }

    const caller = new GPTOSSToolCaller('gpt-oss-120b', {
      supermemoryApiKey: smApiKey,
      smUserId
    });

    if (stream) {
      // Set up SSE for streaming
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });

      const responseChunks: string[] = [];
      
      for await (const chunk of caller.callToolsStream(chatMessages, model)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        responseChunks.push(chunk);
      }
      
      res.write(`data: ${JSON.stringify({ done: true, fullResponse: responseChunks.join('') })}\n\n`);
      return res.end();
    } else {
      // Non-streaming response
      const response = await caller.callTools(chatMessages, model);
      const parsedContent = parseMarkdownToText(response);
      
      return res.json({ 
        response: parsedContent,
        messages: [...chatMessages, { role: 'assistant', content: parsedContent }]
      });
    }
  } catch (error) {
    console.error('Error processing chat request:', error);
    return res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Save Convex token endpoint
app.post('/api/cli/save-convex-token', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Convex token is required and must be a string'
      });
    }

    // Save the Convex token using TokenStore
    await tokenStore.saveConvexToken(token);

    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving Convex token:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper: build Convex client, set auth if Clerk JWT (Convex template) is available
async function getConvexClientWithAuth(): Promise<ConvexHttpClient> {
  const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  try {
    const token = await tokenStore.getConvexToken();
    if (token) {
      // Set Clerk JWT so ctx.auth.getUserIdentity() is available in Convex
      convexClient.setAuth(token);
    } else {
      // No token; leave unauthenticated for Simple endpoints
    }
  } catch (e) {
    console.warn("Convex client auth setup failed; proceeding unauthenticated:", e);
  }
  return convexClient;
}

// Chat persistence endpoints
app.post('/api/chats', async (req, res) => {
  try {
    const { initialMessage, userId } = req.body;

    if (!initialMessage || typeof initialMessage !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Initial message is required and must be a string'
      });
    }

    {
      const hasAuth = await tokenStore.getConvexToken();
      if (!hasAuth && !userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
    }

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    let chatId: string;
    const hasAuth = await tokenStore.getConvexToken();
    if (hasAuth) {
      // Use authenticated function that reads userId from Clerk/Convex identity
      chatId = await convexClient.mutation(api.chats.createChat, {
        title: initialMessage.length > 50 ? initialMessage.substring(0, 47) + "..." : initialMessage,
        initialMessage,
      }) as any;
    } else {
      // Fallback to simple unauthenticated path
      chatId = await convexClient.mutation(api.chats.createChatSimple, {
        initialMessage,
        userId
      }) as any;
    }

    return res.json({ success: true, chatId });
  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.post('/api/chats/:chatId/messages', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { role, content, userId } = req.body;
    
    if (!role || !content || !chatId) {
      return res.status(400).json({
        success: false,
        error: 'Chat ID, role, and content are required'
      });
    }

    if (!['user', 'assistant'].includes(role)) {
      return res.status(400).json({
        success: false,
        error: 'Role must be either "user" or "assistant"'
      });
    }

    {
      const hasAuth = await tokenStore.getConvexToken();
      if (!hasAuth && !userId) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
    }

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    const hasAuth = await tokenStore.getConvexToken();
    if (hasAuth) {
      await convexClient.mutation(api.chats.addMessage, {
        chatId: chatId as any,
        role,
        content,
      });
    } else {
      // Fallback to simple unauthenticated path
      await convexClient.mutation(api.chats.addMessageSimple, {
        chatId: chatId as any, // Cast to Convex ID type
        role,
        content,
        userId
      });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('Error adding message:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/chats', async (req, res) => {
  try {
    const { userId } = req.query;

    {
      const hasAuth = await tokenStore.getConvexToken();
      if (!hasAuth && (!userId || typeof userId !== 'string')) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
    }

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    let chats: any;
    const hasAuth = await tokenStore.getConvexToken();
    if (hasAuth) {
      chats = await convexClient.query(api.chats.getUserChats, {});
    } else {
      chats = await convexClient.query(api.chats.getUserChatsSimple, { userId: userId as string });
    }

    return res.json({ success: true, chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.get('/api/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.query;
    
    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: 'Chat ID is required'
      });
    }

    {
      const hasAuth = await tokenStore.getConvexToken();
      if (!hasAuth && (!userId || typeof userId !== 'string')) {
        return res.status(400).json({
          success: false,
          error: 'User ID is required'
        });
      }
    }

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    let chat: any;
    const hasAuth = await tokenStore.getConvexToken();
    if (hasAuth) {
      chat = await convexClient.query(api.chats.getChat, { 
        chatId: chatId as any,
      });
    } else {
      chat = await convexClient.query(api.chats.getChatSimple, { 
        chatId: chatId as any, // Cast to Convex ID type
        userId: userId as string,
      });
    }

    return res.json({ success: true, chat });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current user ID (with environment variable support)
app.get('/api/user/current', async (req, res) => {
  try {
    // Prefer Convex auth when available to return real Clerk userId
    const convexClient = await getConvexClientWithAuth();
    const hasAuth = await tokenStore.getConvexToken();

    let userId = process.env.CLI_USER_ID;

    if (hasAuth) {
      try {
        // Minimal check: query any authenticated function that reads identity
        const user = await convexClient.query(api.users.getCurrentUser, {});
        if (user && user.userId) {
          userId = user.userId;
        }
      } catch (e) {
        console.warn("Convex authenticated user lookup failed, falling back:", e);
      }
    }

    // If still missing, try frontend route
    if (!userId) {
      try {
        const frontendResponse = await fetch('http://localhost:3000/api/cli/get-current-user', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (frontendResponse.ok) {
          const userData = await frontendResponse.json() as { success: boolean; user?: { id: string } };
          if (userData.success && userData.user) {
            userId = userData.user.id;
          }
        }
      } catch (frontendError) {
        console.log('Frontend not available, using fallback user ID');
      }
    }

    if (!userId) {
      userId = "cli-user";
    }

    res.json({ 
      success: true, 
      user: {
        id: userId,
        name: userId === "cli-user" ? "CLI User" : `User ${userId}`,
        type: userId === "cli-user" ? "cli" : "authenticated"
      }
    });
  } catch (error) {
    console.error('Error getting current user:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Start the server
const PORT = process.env.API_PORT || 3001;

function startServer() {
  // Validate environment configuration first
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Environment configuration error:', error);
    console.log('Please set up your .env file with the required API keys.');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Kite API server running on port ${PORT}`);
    console.log(`📡 Ready to serve CLI requests`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  });
}

// Start the server if this file is run directly
if (require.main === module) {
  startServer();
}

export { startServer, app };
