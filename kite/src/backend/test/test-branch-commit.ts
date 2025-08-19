import { ToolCaller } from '../toolCalling';

async function testBranchCommit() {
  const toolCaller = new ToolCaller();
  
  console.log('Testing commit_and_push with branch creation...');
  
  // Test 1: Commit and push to a new branch
  const result1 = await toolCaller.executeTool('commit_and_push', {
    commit_message: 'test: add branch creation feature',
    branch: 'test-branch-creation',
    auto_push: true
  });
  
  console.log('Result 1:', JSON.stringify(result1, null, 2));
  
  // Test 2: Regular commit without branch (should use current branch)
  const result2 = await toolCaller.executeTool('commit_and_push', {
    commit_message: 'test: regular commit without branch',
    auto_push: true
  });
  
  console.log('Result 2:', JSON.stringify(result2, null, 2));
}

testBranchCommit().catch(console.error);
