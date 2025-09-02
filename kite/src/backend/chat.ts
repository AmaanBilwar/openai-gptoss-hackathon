#!/usr/bin/env tsx

import * as readline from 'readline';
import { GPTOSSToolCaller } from './toolCalling';
import { ChatMessage } from './types';
import { validateConfig } from './config';
import { TokenStore } from './tokenStore';
import { openBrowser } from './utils';
import { parseMarkdownToText, hasMarkdown } from './markdownParser';
import { SupermemoryClient } from './supermemoryClient';
/** Save chat history using authenticated backend */
async function saveChatHistory(messages: ChatMessage[], caller: GPTOSSToolCaller): Promise<void> {
  const chatId = await caller.saveChatHistory(messages);
}

/** Load chat history using authenticated backend */
async function loadChatHistory(caller: GPTOSSToolCaller): Promise<ChatMessage[]> {
  const messages = await caller.loadChatHistory();
  return messages;
}

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

  // Chat history saving optimization
  let pendingSave = false;
  let saveTimeout: NodeJS.Timeout | null = null;
  
  const scheduleChatHistorySave = (messages: ChatMessage[], caller: GPTOSSToolCaller) => {
    if (pendingSave) return; // Already scheduled
    
    pendingSave = true;
    if (saveTimeout) clearTimeout(saveTimeout);
    
    saveTimeout = setTimeout(async () => {
      try {
        await saveChatHistory(messages, caller);
      } catch (error) {
        console.error('\n⚠️  Warning: Failed to save chat history:', error);
      } finally {
        pendingSave = false;
        saveTimeout = null;
      }
    }, 2000); // Save after 2 seconds of inactivity
  };

  try {
    while (true) {
      // Get user input
      const userInput = await new Promise<string>((resolve) => {
        rl.question('You: ', (input) => {
          resolve(input.trim());
        });
      });

      // Handle special commands
      if (!userInput) {
        continue;
      }
      
      const lowerInput = userInput.toLowerCase();
      
      if (['exit', 'quit', 'bye'].includes(lowerInput)) {
        console.log('👋 Goodbye! Thanks for using Kite.');
        break;
      }
      
      if (['help', '?', '/help'].includes(lowerInput)) {
        console.log('\n📚 Available Commands:');
        console.log('  help, ? - Show this help message');
        console.log('  clear, /clear - Clear current session');
        console.log('  history, /history - Show current session history');
        console.log('  chats, /chats - List saved chats from Convex');
        console.log('  load <number> - Load a specific saved chat');
        console.log('  delete <number> - Delete a specific saved chat');
        console.log('  exit, quit, bye - Exit the application');
        console.log('');
        console.log('💡 You can also ask me to:');
        console.log('  - Commit and push your changes');
        console.log('  - Create pull requests');
        console.log('  - Manage branches');
        console.log('  - Resolve merge conflicts');
        console.log('  - And much more!\n');
        continue;
      }
      
      if (['clear', '/clear'].includes(lowerInput)) {
        messages.length = 0;
        console.log('🗑️  Current session cleared.\n');
        continue;
      }
      
      if (['history', '/history'].includes(lowerInput)) {
        if (messages.length === 0) {
          console.log('📝 No chat history yet.\n');
        } else {
          console.log('\n📝 Current Session History:');
          messages.forEach((msg, index) => {
            const role = msg.role === 'user' ? 'You' : 'Kite';
            const content = msg.content.length > 50 ? msg.content.substring(0, 50) + '...' : msg.content;
            console.log(`  ${index + 1}. ${role}: ${content}`);
          });
          console.log('');
        }
        continue;
      }

      if (['chats', '/chats'].includes(lowerInput)) {
        try {
          console.log('\n📚 Loading saved chats from Convex...');
          const chats = await caller.listChats();
          if (chats.length === 0) {
            console.log('📝 No saved chats found.\n');
          } else {
            console.log('\n📚 Saved Chats:');
            chats.forEach((chat, index) => {
              const date = new Date(chat.createdAt).toLocaleDateString();
              const title = chat.title.length > 40 ? chat.title.substring(0, 37) + '...' : chat.title;
              console.log(`  ${index + 1}. ${title} (${chat.messageCount} messages, ${date})`);
            });
            console.log('\nUse "/load <number>" to load a specific chat.\n');
          }
        } catch (error) {
          console.log('❌ Failed to load saved chats:', error);
        }
        continue;
      }

      if (lowerInput.startsWith('load ')) {
        const chatNumber = parseInt(lowerInput.substring(5).trim());
        if (isNaN(chatNumber) || chatNumber < 1) {
          console.log('🔍 Please provide a valid chat number. Usage: /load <number>\n');
          continue;
        }
        
        try {
          console.log(`📚 Loading chat ${chatNumber}...`);
          const chats = await caller.listChats();
          if (chatNumber > chats.length) {
            console.log(`❌ Chat ${chatNumber} not found. Use /chats to see available chats.\n`);
            continue;
          }
          
          const selectedChat = chats[chatNumber - 1];
          const chatMessages = await caller.loadChatById(selectedChat.id);
          
          if (chatMessages.length > 0) {
            messages.length = 0; // Clear current session
            messages.push(...chatMessages); // Load the selected chat
            console.log(`✅ Loaded chat: ${selectedChat.title} (${chatMessages.length} messages)\n`);
          } else {
            console.log('❌ Failed to load chat messages.\n');
          }
        } catch (error) {
          console.log('❌ Failed to load chat:', error);
        }
        continue;
      }

      if (lowerInput.startsWith('delete ')) {
        const chatNumber = parseInt(lowerInput.substring(7).trim());
        if (isNaN(chatNumber) || chatNumber < 1) {
          console.log('🗑️  Please provide a valid chat number. Usage: /delete <number>\n');
          continue;
        }
        
        try {
          console.log(`🗑️  Deleting chat ${chatNumber}...`);
          const chats = await caller.listChats();
          if (chatNumber > chats.length) {
            console.log(`❌ Chat ${chatNumber} not found. Use /chats to see available chats.\n`);
            continue;
          }
          
          const selectedChat = chats[chatNumber - 1];
          const success = await caller.deleteChat(selectedChat.id);
          
          if (success) {
            console.log(`✅ Chat deleted: ${selectedChat.title}\n`);
          } else {
            console.log('❌ Failed to delete chat.\n');
          }
        } catch (error) {
          console.log('❌ Failed to delete chat:', error);
        }
        continue;
      }
      
      if (lowerInput.startsWith('search ')) {
        const query = lowerInput.substring(7).trim();
        if (!query) {
          console.log('🔍 Please provide a search query. Usage: search <query>\n');
          continue;
        }
        
        if (supermemoryClient) {
          try {
            console.log(`🔍 Searching memory for: "${query}"`);
            const results = await supermemoryClient.searchMemories(query, 5);
            if (results.results && results.results.length > 0) {
              console.log('\n📖 Memory Search Results:');
              results.results.forEach((result: any, index: number) => {
                const content = result.content?.length > 100 ? result.content.substring(0, 100) + '...' : result.content;
                console.log(`  ${index + 1}. ${content}`);
              });
              if (results.summary) {
                console.log(`\n📋 Summary: ${results.summary}`);
              }
            } else {
              console.log('🔍 No relevant memories found.\n');
            }
          } catch (error) {
            console.error('❌ Memory search failed:', error);
          }
        } else {
          console.log('🔍 Memory search requires SuperMemory API key.\n');
        }
        console.log('');
        continue;
      }
      
      if (['memory', '/memory'].includes(lowerInput)) {
        if (supermemoryClient) {
          console.log('\n🧠 Memory Statistics:');
          console.log(`  - Total messages in session: ${messages.length}`);
          console.log(`  - SuperMemory enabled: Yes`);
          console.log(`  - Infinite chat: Active`);
        } else {
          console.log('\n🧠 Memory Statistics:');
          console.log(`  - Total messages in session: ${messages.length}`);
          console.log(`  - SuperMemory enabled: No`);
          console.log(`  - Infinite chat: Limited to session`);
        }
        console.log('');
        continue;
      }

      // Add user message to conversation
      messages.push({
        role: 'user',
        content: userInput
      });

      // Get AI response with streaming
      console.log('Kite: ');
      const responseChunks: string[] = [];
      
      try {
        // Let the LLM naturally decide when to use tools vs. respond directly
        for await (const chunk of caller.callToolsStream(messages, 'medium')) {
          process.stdout.write(chunk);
          responseChunks.push(chunk);
        }
        console.log('\n'); // Newline after streaming

        // Add assistant response to conversation
        const assistantContent = responseChunks.join('');
        
        // Only add to conversation if we got meaningful content
        if (assistantContent.trim()) {
          // Only parse markdown if it contains markdown syntax for faster processing
          const parsedContent = hasMarkdown(assistantContent) 
            ? parseMarkdownToText(assistantContent)
            : assistantContent;
          
          messages.push({
            role: 'assistant',
            content: parsedContent
          });
        } else {
          // If no content was generated, add a placeholder to maintain conversation flow
          messages.push({
            role: 'assistant',
            content: '[No response generated]'
          });
        }
        
        // Save chat history in the background without blocking user input
        scheduleChatHistorySave(messages, caller);

      } catch (error) {
        console.error('\n❌ Error getting AI response:', error);
        
        // Provide more helpful error messages
        if (error instanceof Error) {
          if (error.message.includes('authentication') || error.message.includes('token')) {
            console.log('🔐 Authentication error. Please check your credentials and try again.\n');
          } else if (error.message.includes('network') || error.message.includes('timeout')) {
            console.log('🌐 Network error. Please check your internet connection and try again.\n');
          } else if (error.message.includes('API') || error.message.includes('rate limit')) {
            console.log('⚡ API error. Please check your API configuration and try again.\n');
          } else {
            console.log('Please try again or check your API configuration.\n');
          }
        } else {
          console.log('Please try again or check your API configuration.\n');
        }
      }
    }
  } catch (error) {
    console.error('❌ Chat session error:', error);
  } finally {
    // Clean up any pending save operations
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    // Save final chat history before closing
    if (messages.length > 0) {
      await saveChatHistory(messages, caller);
    }
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
