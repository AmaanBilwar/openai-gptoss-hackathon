#!/usr/bin/env tsx

import { GPTOSSToolCaller } from '../toolCalling';
import { ChatMessage } from '../types';
import { validateConfig } from '../config';

/**
 * Test tool calling functionality to debug the Cerebras API issue
 */
async function testToolCalling(): Promise<void> {
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Environment configuration error:', error);
    return;
  }

  const caller = new GPTOSSToolCaller();
  
  // Test with a simple tool call
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: 'Check if branch "main" exists in repository "AmaanBilwar/openai-gptoss-hackathon"'
    }
  ];

  console.log('🧪 Testing Tool Calling');
  console.log('User request:', messages[0].content);
  console.log('---\n');

  try {
    console.log('🤖 Kite: ');
    
    // Test direct tool execution first
    console.log('Testing direct tool execution...');
    const directResult = await caller.executeTool('check_branch_exists', {
      repo: 'AmaanBilwar/openai-gptoss-hackathon',
      branch: 'main'
    });
    console.log('Direct tool result:', directResult);
    
    console.log('\n---\n');
    console.log('Testing streaming tool calls...');
    
    // Test streaming tool calls
    for await (const chunk of caller.callToolsStream(messages, 'medium')) {
      process.stdout.write(chunk);
    }
    
    console.log('\n---');
    console.log('✅ Tool calling test completed!');
    
  } catch (error) {
    console.error('\n❌ Error during tool calling test:', error);
    if (error instanceof Error) {
      console.error('Error details:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testToolCalling().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testToolCalling };
