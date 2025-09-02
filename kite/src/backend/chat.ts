#!/usr/bin/env tsx

import * as readline from 'readline';
import { GPTOSSToolCaller } from './toolCalling';
import { ChatMessage } from './types';
import { validateConfig } from './config';
import { TokenStore } from './tokenStore';
import { openBrowser } from './utils';
import { parseMarkdownToText } from './markdownParser';

/**
 * Poll for authentication completion
 */
async function waitForAuthentication(tokenStore: TokenStore, maxAttempts: number = 60): Promise<boolean> {
  console.log('⏳ Waiting for authentication to complete...');
  console.log('   (This may take a moment after you complete the sign-in process)');
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds between checks
    
    const isAuthenticated = await tokenStore.isAuthenticated();
    if (isAuthenticated) {
      console.log('✅ Authentication successful!');
      return true;
    }
    
    // Show progress indicator
    const dots = '.'.repeat((attempt % 3) + 1);
    process.stdout.write(`\r⏳ Waiting for authentication${dots}   `);
  }
  
  console.log('\n❌ Authentication timeout. Please try again.');
  return false;
}

/**
 * Enhanced interactive chat mode with better Windows compatibility and automatic auth polling
 */
export async function startInteractiveChat(): Promise<void> {
  // Validate environment configuration first
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Environment configuration error:', error);
    console.log('Please set up your .env file with the required API keys.');
    return;
  }

  // Check authentication status
  const tokenStore = new TokenStore();
  let isAuthenticated = await tokenStore.isAuthenticated();
  
  if (!isAuthenticated) {
    console.log('🔐 Authentication required');
    console.log('You need to sign in to use Kite CLI.');
    console.log('');
    
    const authUrl = 'http://localhost:3000?from_cli=true';
    console.log(`Opening browser to: ${authUrl}`);
    
    try {
      await openBrowser(authUrl);
      console.log('✅ Browser opened successfully');
    } catch (error) {
      console.log(`Please manually visit: ${authUrl}`);
    }
    
    console.log('');
    console.log('💡 Tip: Make sure the web server is running with "bun run dev"');
    console.log('');
    
    // Wait for authentication to complete
    isAuthenticated = await waitForAuthentication(tokenStore);
    
    if (!isAuthenticated) {
      return;
    }
    
    console.log(''); // Add spacing after auth success
  }

  const caller = new GPTOSSToolCaller('gpt-oss-120b', {
    supermemoryApiKey: process.env.SUPERMEMORY_API_KEY,
    smUserId: undefined // Will be resolved from authentication
  });
  
  // Initialize SuperMemory client for infinite chat
  let supermemoryClient: SupermemoryClient | null = null;
  if (process.env.SUPERMEMORY_API_KEY) {
    try {
      supermemoryClient = new SupermemoryClient(process.env.SUPERMEMORY_API_KEY);
      console.log('🧠 SuperMemory Infinite Chat enabled');
    } catch (error) {
      console.warn('⚠️  SuperMemory initialization failed:', error);
    }
  }
  
  // Check if backend is available
  console.log('💡 Make sure the web server is running with "bun run dev" for full functionality\n');
  
  // Load previous chat history for infinite chat
  const messages: ChatMessage[] = await loadChatHistory(caller);
  if (messages.length > 0) {
    console.log(`📚 Loaded ${messages.length} previous messages for infinite chat context`);
    console.log('💡 Your conversation continues from where you left off!\n');
  }

  console.log('Welcome to Kite! Your AI-powered GitHub assistant.');
  console.log('Type your requests and I\'ll help you manage your repositories.');
  console.log('Type "exit" or "quit" to end the session.');
  console.log('Type "help" or "?" for available commands.\n');

  // Create readline interface with better Windows support
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  // Disable line buffering for better input handling
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(false);
  }

  try {
    while (true) {
      // Get user input
      const userInput = await new Promise<string>((resolve) => {
        rl.question('You: ', (input) => {
          resolve(input.trim());
        });
      });

      // Handle exit commands
      if (!userInput || ['exit', 'quit', 'bye'].includes(userInput.toLowerCase())) {
        console.log('👋 Goodbye! Thanks for using Kite.');
        break;
      }

      // Add user message to conversation
      messages.push({
        role: 'user',
        content: userInput
      });

      // Get AI response with streaming
      console.log('🤖 Kite: ');
      const responseChunks: string[] = [];
      
      try {
        for await (const chunk of caller.callToolsStream(messages, 'medium')) {
          process.stdout.write(chunk);
          responseChunks.push(chunk);
        }
        console.log('\n'); // Newline after streaming

        // Add assistant response to conversation
        const assistantContent = responseChunks.join('');
        
        // Parse markdown content for better display and storage
        const parsedContent = parseMarkdownToText(assistantContent);
        
        messages.push({
          role: 'assistant',
          content: parsedContent
        });

      } catch (error) {
        console.error('\n❌ Error getting AI response:', error);
        console.log('Please try again or check your API configuration.\n');
      }
    }
  } catch (error) {
    console.error('❌ Chat session error:', error);
  } finally {
    rl.close();
  }
}

// Run chat if this file is executed directly
if (require.main === module) {
  startInteractiveChat().catch((error) => {
    console.error('❌ Failed to start chat:', error);
    process.exit(1);
  });
}
