#!/usr/bin/env tsx

import express from 'express';
import cors from 'cors';
import { GPTOSSToolCaller } from './toolCalling';
import { TokenStore } from './tokenStore';
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
    
    // Get authenticated user ID from Convex
    let smUserId: string | undefined;
    try {
      const convexClient = await getConvexClientWithAuth();
      const user = await convexClient.query(api.users.getCurrentUser, {});
      if (user && (user as any).userId) {
        smUserId = (user as any).userId;
      } else {
        return res.status(401).json({
          success: false,
          error: 'User not found'
        });
      }
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: 'Authentication failed'
      });
    }

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
    const { messages, stream = false, model = 'medium' } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Check authentication
    const hasAuth = await tokenStore.getConvexToken();
    if (!hasAuth) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Convert messages to internal format
    const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Get authenticated user ID from Convex
    let smUserId: string | undefined;
    try {
      const convexClient = await getConvexClientWithAuth();
      const user = await convexClient.query(api.users.getCurrentUser, {});
      if (user && (user as any).userId) {
        smUserId = (user as any).userId;
      } else {
        return res.status(401).json({ error: 'User not found' });
      }
    } catch (error) {
      return res.status(401).json({ error: 'Authentication failed' });
    }

    const caller = new GPTOSSToolCaller('gpt-oss-120b', {
      supermemoryApiKey: process.env.SUPERMEMORY_API_KEY,
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
      // Always use streaming for consistency
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
      throw new Error("No authentication token available");
    }
  } catch (e) {
    console.warn("Convex client auth setup failed:", e);
    throw e;
  }
  return convexClient;
}

// Chat persistence endpoints
app.post('/api/chats', async (req, res) => {
  try {
    const { initialMessage } = req.body;

    if (!initialMessage || typeof initialMessage !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Initial message is required and must be a string'
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

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    // Use authenticated function that reads userId from Clerk/Convex identity
    const chatId = await convexClient.mutation(api.chats.createChat, {
      title: initialMessage.length > 50 ? initialMessage.substring(0, 47) + "..." : initialMessage,
      initialMessage,
    }) as any;

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
    const { role, content } = req.body;
    
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

    // Check authentication
    const hasAuth = await tokenStore.getConvexToken();
    if (!hasAuth) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    await convexClient.mutation(api.chats.addMessage, {
      chatId: chatId as any,
      role,
      content,
    });

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
    // Check authentication
    const hasAuth = await tokenStore.getConvexToken();
    if (!hasAuth) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    const chats = await convexClient.query(api.chats.getUserChats, {});

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
    
    if (!chatId) {
      return res.status(400).json({
        success: false,
        error: 'Chat ID is required'
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

    // Initialize Convex client (set auth if available)
    const convexClient = await getConvexClientWithAuth();

    const chat = await convexClient.query(api.chats.getChat, { 
      chatId: chatId as any,
    });

    return res.json({ success: true, chat });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get current user ID (requires authentication)
app.get('/api/user/current', async (req, res) => {
  try {
    // Check authentication
    const hasAuth = await tokenStore.getConvexToken();
    if (!hasAuth) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    // Get authenticated user from Convex
    const convexClient = await getConvexClientWithAuth();
    const user = await convexClient.query(api.users.getCurrentUser, {});
    
    if (!user || !user.userId) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({ 
      success: true, 
      user: {
        id: user.userId,
        name: user.name,
        type: "authenticated"
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
