import { GPTOSSToolCaller } from '../toolCalling';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testCommitFix() {
  console.log('🧪 Testing Commit and Push Fix...');
  
  try {
    const toolCaller = new GPTOSSToolCaller();
    
    // Test 1: Test with valid commit message
    console.log('\n📝 Test 1: Testing with valid commit message...');
    const result1 = await toolCaller.executeTool('commit_and_push', {
      commit_message: 'fix: test commit message',
      auto_push: false
    });
    console.log('Result 1:', JSON.stringify(result1, null, 2));
    
    // Test 2: Test with undefined commit message (should fail gracefully)
    console.log('\n❌ Test 2: Testing with undefined commit message...');
    const result2 = await toolCaller.executeTool('commit_and_push', {
      commit_message: undefined,
      auto_push: false
    });
    console.log('Result 2:', JSON.stringify(result2, null, 2));
    
    // Test 3: Test with empty commit message (should fail gracefully)
    console.log('\n❌ Test 3: Testing with empty commit message...');
    const result3 = await toolCaller.executeTool('commit_and_push', {
      commit_message: '',
      auto_push: false
    });
    console.log('Result 3:', JSON.stringify(result3, null, 2));
    
    console.log('\n✅ Commit fix testing completed!');
    
  } catch (error) {
    console.error('❌ Error during commit fix testing:', error);
  }
}

// Run the test
testCommitFix().catch(console.error);
