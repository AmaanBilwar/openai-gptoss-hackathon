#!/usr/bin/env tsx

import express from 'express';
import cors from 'cors';
import { GPTOSSToolCaller } from './toolCalling';
import { TokenStore } from './tokenStore';
import { parseMarkdownToText } from './markdownParser';
import { ChatMessage } from './types';
import { validateConfig } from './config';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize the tool caller and token store
const caller = new GPTOSSToolCaller();
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

// Chat endpoint
app.post('/chat', async (req, res) => {
  try {
    const { messages, stream = false, model = 'medium' } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages array is required' });
    }

    // Convert messages to internal format
    const chatMessages: ChatMessage[] = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

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
      res.end();
    } else {
      // Non-streaming response
      const response = await caller.callTools(chatMessages, model);
      const parsedContent = parseMarkdownToText(response);
      
      res.json({ 
        response: parsedContent,
        messages: [...chatMessages, { role: 'assistant', content: parsedContent }]
      });
    }
  } catch (error) {
    console.error('Error processing chat request:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error instanceof Error ? error.message : 'Unknown error'
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
