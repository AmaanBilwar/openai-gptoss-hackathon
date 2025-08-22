#!/usr/bin/env tsx

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { config } from './config';

async function testRAGFinal() {
  console.log('🧪 Testing Final RAG System...\n');
  
  const convex = new ConvexHttpClient(config.NEXT_PUBLIC_CONVEX_URL);
  
  try {
    // Test 1: Check if we can access the repository
    console.log('1️⃣ Checking repository access...');
    const repo = await convex.query(api.repos.getRepoBySlug, { 
      slug: 'AnandVishesh1301/developer_portfolio' 
    });
    console.log(`   Repository: ${repo ? '✅ Found' : '❌ Not found'}`);
    
    if (repo) {
      // Test 2: Check if we can access the commit
      console.log('\n2️⃣ Checking commit access...');
      const commit = await convex.query(api.commits.getCommitBySha, { 
        repoId: repo, 
        sha: '981c582264949f25cebd64d152f44eb07b8f848d' 
      });
      console.log(`   Commit: ${commit ? '✅ Found' : '❌ Not found'}`);
      
      if (commit) {
        // Test 3: Check if we can access hunks
        console.log('\n3️⃣ Checking hunks access...');
        const hunks = await convex.query(api.hunks.getHunksByCommit, { 
          commitId: commit._id 
        });
        console.log(`   Hunks: ${hunks.length} found`);
        
        // Test 4: Test RAG Q&A
        console.log('\n4️⃣ Testing RAG Q&A...');
        try {
          const result = await convex.action(api.actions.ask.askCommit, {
            repoSlug: 'AnandVishesh1301/developer_portfolio',
            sha: '981c582264949f25cebd64d152f44eb07b8f848d',
            question: 'What changes were made in this commit?'
          });
          console.log('   RAG Result:', result);
        } catch (error) {
          console.log('   RAG Error:', error);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testRAGFinal().catch(console.error);
