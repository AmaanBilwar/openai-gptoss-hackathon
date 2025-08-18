#!/usr/bin/env tsx

import { GPTOSSToolCaller } from './toolCalling';
import { ChatMessage } from './types';
import { validateConfig } from './config';

/**
 * Test multi-turn tool use functionality
 */
async function testMultiTurnToolUse(): Promise<void> {
  try {
    validateConfig();
  } catch (error) {
    console.error('❌ Environment configuration error:', error);
    return;
  }

  const caller = new GPTOSSToolCaller();
  const messages: ChatMessage[] = [
    {
      role: 'user',
      content: 'Create a new branch called "feature-test" for the repo AmaanBilwar/openai-gptoss-hackathon, then create an issue with title "Test Issue" and body "This is a test issue for multi-turn functionality"'
    }
  ];

  console.log('🧪 Testing Multi-Turn Tool Use');
  console.log('User request:', messages[0].content);
  console.log('---\n');

  try {
    console.log('🤖 Kite: ');
    
    const response = await caller.callToolsMultiTurn(messages, 'medium');
    console.log(response);
    
    console.log('\n---');
    console.log('✅ Multi-turn test completed!');
    
  } catch (error) {
    console.error('\n❌ Error during multi-turn test:', error);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  testMultiTurnToolUse().catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
}

export { testMultiTurnToolUse };
