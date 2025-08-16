#!/usr/bin/env tsx

import { GPTOSSToolCaller } from './toolCalling';
import { GitHubClient } from './githubClient';
import { TokenStore } from './tokenStore';
import { ChatMessage } from './types';
import { validateConfig } from './config';

/**
 * Example usage of the Kite TypeScript backend
 */
async function main() {
  console.log('🚀 Kite TypeScript Backend Examples\n');

  // Validate environment configuration
  try {
    validateConfig();
    console.log('✅ Environment configuration validated\n');
  } catch (error) {
    console.error('❌ Environment configuration error:', error);
    return;
  }

  // Example 1: Basic GitHub client usage
  await exampleGitHubClient();

  // Example 2: AI-powered tool calling
  await exampleAIToolCalling();

  // Example 3: Token management
  await exampleTokenManagement();

  console.log('\n✅ All examples completed!');
}

/**
 * Example 1: Using the GitHub client directly
 */
async function exampleGitHubClient() {
  console.log('📋 Example 1: GitHub Client Usage');
  
  try {
    const githubClient = new GitHubClient();
    
    // Check if authenticated
    const isAuth = await githubClient.getAuthenticatedUser();
    console.log(`✅ Authenticated as: ${isAuth.login}`);
    
    // List repositories
    const reposResult = await githubClient.listRepos();
    if (reposResult.success) {
      console.log(`📦 Found ${reposResult.count} repositories`);
      if (reposResult.repos && reposResult.repos.length > 0) {
        console.log(`   First repo: ${reposResult.repos[0].full_name}`);
      }
    } else {
      console.log(`❌ Failed to list repos: ${reposResult.error}`);
    }
    
  } catch (error) {
    console.log(`❌ GitHub client error: ${error}`);
  }
  
  console.log('');
}

/**
 * Example 2: AI-powered tool calling
 */
async function exampleAIToolCalling() {
  console.log('🤖 Example 2: AI Tool Calling');
  
  try {
    const caller = new GPTOSSToolCaller();
    
    // Simple conversation
    const messages: ChatMessage[] = [
      {
        role: 'user',
        content: 'List my repositories'
      }
    ];
    
    console.log('💬 User: List my repositories');
    console.log('🤖 Kite: ');
    
    // Streaming response
    let response = '';
    for await (const chunk of await caller.callToolsStream(messages, 'medium')) {
      process.stdout.write(chunk);
      response += chunk;
    }
    console.log('\n');
    
    // Add the response to conversation history
    messages.push({
      role: 'assistant',
      content: response
    });
    
    // Follow-up question
    messages.push({
      role: 'user',
      content: 'Create a new branch called example-branch'
    });
    
    console.log('💬 User: Create a new branch called example-branch');
    console.log('🤖 Kite: ');
    
    for await (const chunk of await caller.callToolsStream(messages, 'medium')) {
      process.stdout.write(chunk);
    }
    console.log('\n');
    
  } catch (error) {
    console.log(`❌ AI tool calling error: ${error}`);
  }
  
  console.log('');
}

/**
 * Example 3: Token management
 */
async function exampleTokenManagement() {
  console.log('🔐 Example 3: Token Management');
  
  try {
    const store = new TokenStore();
    
    // Check if we have a stored token
    const token = await store.load();
    if (token) {
      console.log('✅ Found stored token');
      
      // Get token metadata
      const tokenData = await store.getTokenData();
      if (tokenData) {
        console.log(`   Created: ${tokenData.created_at}`);
      }
    } else {
      console.log('❌ No stored token found');
      console.log('   Run: npm run backend:dev login --scope=repo');
    }
    
    // Check authentication status
    const isAuth = await store.isAuthenticated();
    console.log(`🔑 Authentication status: ${isAuth ? 'Authenticated' : 'Not authenticated'}`);
    
  } catch (error) {
    console.log(`❌ Token management error: ${error}`);
  }
  
  console.log('');
}

/**
 * Example 4: Error handling demonstration
 */
async function exampleErrorHandling() {
  console.log('⚠️  Example 4: Error Handling');
  
  try {
    const githubClient = new GitHubClient();
    
    // This will fail if not authenticated
    await githubClient.listRepos();
    
  } catch (error) {
    console.log('✅ Properly caught authentication error');
    console.log(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
  
  console.log('');
}

/**
 * Example 5: Batch operations
 */
async function exampleBatchOperations() {
  console.log('🔄 Example 5: Batch Operations');
  
  try {
    const githubClient = new GitHubClient();
    
    // Perform multiple operations
    const operations = [
      githubClient.listRepos(),
      githubClient.getAuthenticatedUser()
    ];
    
    const results = await Promise.allSettled(operations);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`✅ Operation ${index + 1} succeeded`);
      } else {
        console.log(`❌ Operation ${index + 1} failed: ${result.reason}`);
      }
    });
    
  } catch (error) {
    console.log(`❌ Batch operations error: ${error}`);
  }
  
  console.log('');
}

// Run examples if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Example execution failed:', error);
    process.exit(1);
  });
}

export {
  exampleGitHubClient,
  exampleAIToolCalling,
  exampleTokenManagement,
  exampleErrorHandling,
  exampleBatchOperations
};
