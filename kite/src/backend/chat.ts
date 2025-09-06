#!/usr/bin/env tsx

import * as readline from 'readline';
import { GPTOSSToolCaller } from './toolCalling';
import { ChatMessage } from './types';
import { validateConfig } from './config';
import { TokenStore } from './tokenStore';
import { openBrowser } from './utils';
import { parseMarkdownToText } from './markdownParser';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import chalk from 'chalk';
import boxen from 'boxen';
import ora from 'ora';

/**
 * Poll for authentication completion
 */
async function waitForAuthentication(tokenStore: TokenStore, maxAttempts: number = 60): Promise<boolean> {
  const spinner = ora({ text: 'Waiting for authentication…', color: 'cyan' }).start();
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const isAuthenticated = await tokenStore.isAuthenticated();
    if (isAuthenticated) {
      spinner.succeed(chalk.green('Authentication successful!'));
      return true;
    }
    const dots = '.'.repeat((attempt % 3) + 1);
    spinner.text = `Waiting for authentication${dots}`;
  }
  spinner.fail(chalk.red('Authentication timeout. Please try again.'));
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
    console.error(chalk.red('Environment configuration error:'), error);
    console.log(chalk.yellow('Please set up your .env file with the required API keys.'));
    return;
  }

  // Check authentication status
  const tokenStore = new TokenStore();
  let isAuthenticated = await tokenStore.isAuthenticated();
  
  if (!isAuthenticated) {
    const header = boxen(
      `${chalk.bold('Authentication required')}
${chalk.dim('You need to sign in to use Kite CLI.')}`,
      { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
    );
    console.log(header);

    const authUrl = 'http://localhost:3000?from_cli=true';
    console.log(`${chalk.cyan('Opening browser')} → ${chalk.underline(authUrl)}`);
    try {
      await openBrowser(authUrl);
      console.log(chalk.green('Browser opened successfully'));
    } catch (error) {
      console.log(`${chalk.yellow('Please manually visit')} ${chalk.underline(authUrl)}`);
    }
    console.log(chalk.dim('Tip: ensure the web server is running with "bun run dev"'));

    isAuthenticated = await waitForAuthentication(tokenStore);
    if (!isAuthenticated) {
      return;
    }
    console.log('');
  }

  // Attempt to fetch user API keys from Convex for BYOK
  let userApiKeys: Map<string, string> | undefined;
  try {
    const spinner = ora({ text: 'Fetching API keys from Convex…', color: 'cyan' }).start();
    const convexClient = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    const convexToken = await tokenStore.getConvexToken();
    if (convexToken) {
      convexClient.setAuth(convexToken);
      const keys = await convexClient.query(api.users.getActiveUserApiKeys, {} as any);
      if (keys && (keys as any[]).length > 0) {
        const map = new Map<string, string>();
        for (const k of keys as any[]) {
          map.set(k.provider, k.encryptedKey);
        }
        userApiKeys = map;
        spinner.succeed('Loaded API keys from Convex');
      } else {
        spinner.info('No API keys found in Convex; falling back to environment variables');
      }
    } else {
      spinner.info('Not authenticated with Convex; falling back to environment variables');
    }
  } catch (e) {
    ora().warn('Failed to fetch API keys from Convex; falling back to environment variables');
  }

  const caller = new GPTOSSToolCaller('gpt-oss-120b', {
    // Do not pass supermemoryApiKey; we aren't using Supermemory by default
    smUserId: process.env.CLI_USER_ID || 'cli-user',
    userApiKeys,
  });
  const messages: ChatMessage[] = [];

  const banner = boxen(
    `${chalk.bold('Welcome to Kite')} ${chalk.dim('— your AI-powered GitHub assistant')}
${chalk.dim('Type your request and press Enter.')}
${chalk.dim('Type "exit" or "quit" to end the session.')}`,
    { padding: 1, borderColor: 'cyan', borderStyle: 'round' }
  );
  console.log(banner);

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
        rl.question(`${chalk.cyan('You')}: `, (input) => {
          resolve(input.trim());
        });
      });

      // Handle exit commands
      if (!userInput || ['exit', 'quit', 'bye'].includes(userInput.toLowerCase())) {
        console.log(`${chalk.green('Goodbye!')} ${chalk.dim('Thanks for using Kite.')}`);
        break;
      }

      // Add user message to conversation
      messages.push({
        role: 'user',
        content: userInput
      });

      // Get AI response with streaming
      console.log(`${chalk.magenta('Kite')}: `);
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
        console.error(`\n${chalk.red('Error getting AI response:')}`, error);
        console.log(chalk.yellow('Please try again or check your API configuration.\n'));
      }
    }
  } catch (error) {
    console.error(chalk.red('Chat session error:'), error);
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
