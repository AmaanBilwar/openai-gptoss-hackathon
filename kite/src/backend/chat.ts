#!/usr/bin/env tsx

import * as readline from 'readline';
import { GPTOSSToolCaller } from './toolCalling';
import { ChatMessage } from './types';
import { validateConfig } from './config';

/**
 * Enhanced interactive chat mode with better Windows compatibility
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

  const caller = new GPTOSSToolCaller();
  const messages: ChatMessage[] = [];

  console.log('Welcome to Kite! Your AI-powered GitHub assistant.');
  console.log('Type your requests and I\'ll help you manage your repositories.');
  console.log('Type "exit" or "quit" to end the session.\n');

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
        messages.push({
          role: 'assistant',
          content: assistantContent
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
