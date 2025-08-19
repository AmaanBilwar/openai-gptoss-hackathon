#!/usr/bin/env tsx

import { GitHubClient } from '../githubClient';

async function testListRepositoryCommits() {
  console.log('Testing list_repository_commits functionality...');
  
  const client = new GitHubClient();
  
  try {
    // Test with a public repository
    const result = await client.listRepositoryCommits({
      owner: 'octocat',
      repo: 'Hello-World',
      perPage: 5
    });
    
    console.log('Result:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Test passed! Found commits:', result.commit_count);
    } else {
      console.log('❌ Test failed:', result.error);
    }
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

// Run the test
testListRepositoryCommits().catch(console.error);
