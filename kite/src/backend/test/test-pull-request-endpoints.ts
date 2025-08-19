import { GPTOSSToolCaller } from '../toolCalling';

/**
 * Test script for the new pull request endpoints
 */
async function testPullRequestEndpoints() {
  console.log('🧪 Testing new pull request endpoints...\n');

  const toolCaller = new GPTOSSToolCaller();

  // Test parameters - use a real repository that exists
  const testRepo = 'AmaanBilwar/openai-gptoss-hackathon'; // Use the actual repo from the conversation
  const testPullNumber = 12; // Use the actual PR number from the conversation

  try {
    // Test 1: List pull requests
    console.log('1. Testing list_pull_requests...');
    const listResult = await toolCaller.executeTool('list_pull_requests', {
      repo: testRepo,
      state: 'open'
    });
    console.log('Result:', listResult.success ? '✅ Success' : '❌ Failed');
    if (listResult.success) {
      console.log(`Found ${listResult.pull_request_count} pull requests`);
      // If we found PRs, use the first one for subsequent tests
      if (listResult.pull_requests && listResult.pull_requests.length > 0) {
        const firstPR = listResult.pull_requests[0];
        console.log(`Using PR #${firstPR.number} for subsequent tests`);
        // Update testPullNumber for remaining tests
        const actualPullNumber = firstPR.number;
        
        // Test 2: Get specific pull request
        console.log('\n2. Testing get_pull_request...');
        const getResult = await toolCaller.executeTool('get_pull_request', {
          repo: testRepo,
          pull_number: actualPullNumber
        });
        console.log('Result:', getResult.success ? '✅ Success' : '❌ Failed');
        if (getResult.success) {
          console.log(`Pull request #${actualPullNumber}: ${getResult.title}`);
        } else {
          console.log('Error:', getResult.error);
        }

        // Test 3: List commits on pull request
        console.log('\n3. Testing list_pull_request_commits...');
        const commitsResult = await toolCaller.executeTool('list_pull_request_commits', {
          repo: testRepo,
          pull_number: actualPullNumber
        });
        console.log('Result:', commitsResult.success ? '✅ Success' : '❌ Failed');
        if (commitsResult.success) {
          console.log(`Found ${commitsResult.commit_count} commits`);
        } else {
          console.log('Error:', commitsResult.error);
        }

        // Test 4: List files in pull request
        console.log('\n4. Testing list_pull_request_files...');
        const filesResult = await toolCaller.executeTool('list_pull_request_files', {
          repo: testRepo,
          pull_number: actualPullNumber
        });
        console.log('Result:', filesResult.success ? '✅ Success' : '❌ Failed');
        if (filesResult.success) {
          console.log(`Found ${filesResult.file_count} files`);
        } else {
          console.log('Error:', filesResult.error);
        }

        // Test 5: Check if pull request is merged
        console.log('\n5. Testing check_pull_request_merged...');
        const mergedResult = await toolCaller.executeTool('check_pull_request_merged', {
          repo: testRepo,
          pull_number: actualPullNumber
        });
        console.log('Result:', mergedResult.success ? '✅ Success' : '❌ Failed');
        if (mergedResult.success) {
          console.log(`Merged status: ${mergedResult.merged ? 'Yes' : 'No'}`);
        } else {
          console.log('Error:', mergedResult.error);
        }

        // Test 6: Update pull request branch (this might fail if branch is up to date)
        console.log('\n6. Testing update_pull_request_branch...');
        const updateBranchResult = await toolCaller.executeTool('update_pull_request_branch', {
          repo: testRepo,
          pull_number: actualPullNumber
        });
        console.log('Result:', updateBranchResult.success ? '✅ Success' : '❌ Failed');
        if (updateBranchResult.success) {
          console.log('Branch updated successfully');
        } else {
          console.log('Error:', updateBranchResult.error);
        }
      } else {
        console.log('No pull requests found, skipping individual PR tests');
      }
    } else {
      console.log('Error:', listResult.error);
      console.log('Skipping individual PR tests due to list failure');
    }

    console.log('\n🎉 All tests completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testPullRequestEndpoints().catch(console.error);
}

export { testPullRequestEndpoints };
