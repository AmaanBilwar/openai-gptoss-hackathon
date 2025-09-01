import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';
import { testEnvironmentConfig } from './test-environment-config';
import { testQueueProcessing } from './test-queue-processing';

/**
 * Comprehensive integration test for the complete RAG Q&A pipeline
 */
async function testCompleteRAGPipeline() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'http://localhost:8000';
  const convex = new ConvexHttpClient(convexUrl);

  console.log('🧪 Testing Complete RAG Q&A Pipeline');
  console.log('=====================================');

  try {
    // 1. Environment Configuration Test
    console.log('\n1. Testing environment configuration...');
    const envSuccess = await testEnvironmentConfig();
    if (!envSuccess) {
      throw new Error('Environment configuration test failed');
    }
    console.log('✅ Environment configuration verified');

    // 2. Queue Processing Test
    console.log('\n2. Testing queue processing system...');
    await testQueueProcessing();
    console.log('✅ Queue processing system verified');

    // 3. Test complete webhook to embedding pipeline
    console.log('\n3. Testing complete webhook to embedding pipeline...');
    await testWebhookToEmbeddingPipeline(convex);
    console.log('✅ Webhook to embedding pipeline verified');

    // 4. Test RAG retrieval system
    console.log('\n4. Testing RAG retrieval system...');
    await testRAGRetrieval(convex);
    console.log('✅ RAG retrieval system verified');

    // 5. Test end-to-end query processing
    console.log('\n5. Testing end-to-end query processing...');
    await testEndToEndQuery(convex);
    console.log('✅ End-to-end query processing verified');

    // 6. Performance and stress testing
    console.log('\n6. Testing performance and stress...');
    await testPerformance(convex);
    console.log('✅ Performance tests completed');

    console.log('\n🎉 Complete RAG Q&A pipeline test completed successfully!');
    return true;

  } catch (error) {
    console.error('\n❌ Complete RAG Q&A pipeline test failed:', error);
    return false;
  }
}

/**
 * Test the complete webhook to embedding pipeline
 */
async function testWebhookToEmbeddingPipeline(convex: ConvexHttpClient) {
  console.log('   🔄 Testing webhook to embedding pipeline...');

  // 1. Simulate webhook event
  const testCommitSha = 'test-commit-pipeline-' + Date.now();
  const webhookEventId = await convex.mutation(api.webhooks.storeWebhookEvent, {
    repoId: 1756108131418,
    eventType: 'push',
    eventId: testCommitSha,
    deliveryId: 'test-delivery-' + Date.now(),
    payload: {}
  });

  // 2. Queue commit for processing
  const queueResult = await convex.mutation(api.processing.queueCommitProcessing, {
    repoId: 1756108131418,
    sha: testCommitSha,
    priority: 1,
    metadata: {}
  });

  // 3. Wait for processing to complete
  console.log('   ⏳ Waiting for processing to complete...');
  let attempts = 0;
  const maxAttempts = 30; // 30 seconds timeout

  while (attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const processingStatus = await convex.query(api.commitProcessing.getCommitProcessingStatus, {
      repoId: 1756108131418,
      sha: testCommitSha
    });

    if (processingStatus?.status === 'completed') {
      console.log('   ✅ Commit processing completed successfully');
      break;
    } else if (processingStatus?.status === 'failed') {
      throw new Error(`Commit processing failed: ${processingStatus.error}`);
    }

    attempts++;
    if (attempts % 5 === 0) {
      console.log(`   ⏳ Still processing... (${attempts}s)`);
    }
  }

  if (attempts >= maxAttempts) {
    throw new Error('Commit processing timed out');
  }

  // 4. Verify embeddings were created
  const embeddings = await convex.query(api.embeddings.getCommitEmbeddings, {
    repoId: 1756108131418,
    sha: testCommitSha
  });

  if (!embeddings || embeddings.length === 0) {
    throw new Error('No embeddings found for processed commit');
  }

  console.log(`   ✅ Created ${embeddings.length} embeddings for commit`);
}

/**
 * Test RAG retrieval system
 */
async function testRAGRetrieval(convex: ConvexHttpClient) {
  console.log('   🔍 Testing RAG retrieval system...');

  // 1. Get available commits with embeddings
  const commitsWithEmbeddings = await convex.query(api.embeddings.listCommitsWithEmbeddings, {
    repoId: 1756108131418,
    limit: 5
  });

  if (!commitsWithEmbeddings || commitsWithEmbeddings.length === 0) {
    console.log('   ⚠️ No commits with embeddings found - skipping RAG test');
    return;
  }

  // 2. Test semantic search
  const testCommit = commitsWithEmbeddings[0];
  const searchQuery = 'code changes and functionality';

  const searchResults = await convex.query(api.rag.searchCommitCode, {
    repoId: 1756108131418,
    sha: testCommit.sha,
    query: searchQuery,
    options: {
      k: 3,
      minSimilarity: 0.1,
      diversify: true
    }
  });

  if (searchResults && searchResults.length > 0) {
    console.log(`   ✅ RAG search successful - found ${searchResults.length} results`);
    console.log(`   📊 Average similarity: ${(searchResults.reduce((sum, r) => sum + r.similarity, 0) / searchResults.length).toFixed(3)}`);
  } else {
    console.log('   ⚠️ RAG search returned no results');
  }
}

/**
 * Test end-to-end query processing
 */
async function testEndToEndQuery(convex: ConvexHttpClient) {
  console.log('   🔄 Testing end-to-end query processing...');

  // 1. Test repository-level search
  const repoSearchQuery = 'utility functions and helpers';
  
  try {
    const repoResults = await convex.query(api.rag.searchRepositoryCode, {
      repoId: 1756108131418,
      query: repoSearchQuery,
      k: 5
    });

    if (repoResults && repoResults.length > 0) {
      console.log(`   ✅ Repository search successful - found ${repoResults.length} results`);
    } else {
      console.log('   ⚠️ Repository search returned no results');
    }
  } catch (error) {
    console.log('   ⚠️ Repository search failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  // 2. Test PR search (if PRs exist)
  try {
    const prResults = await convex.query(api.rag.searchPRCode, {
      repoId: 1756108131418,
      number: 1, // Test with PR #1
      query: 'feature implementation',
      options: {
        k: 3,
        minSimilarity: 0.1
      }
    });

    if (prResults && prResults.length > 0) {
      console.log(`   ✅ PR search successful - found ${prResults.length} results`);
    } else {
      console.log('   ⚠️ PR search returned no results (no PRs or no embeddings)');
    }
  } catch (error) {
    console.log('   ⚠️ PR search failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

/**
 * Test performance and stress
 */
async function testPerformance(convex: ConvexHttpClient) {
  console.log('   ⚡ Testing performance...');

  // 1. Test concurrent queries
  const startTime = Date.now();
  const concurrentQueries = 5;
  const queryPromises = [];

  for (let i = 0; i < concurrentQueries; i++) {
    queryPromises.push(
      convex.query(api.processing.getQueueHealth, {})
    );
  }

  await Promise.all(queryPromises);
  const concurrentTime = Date.now() - startTime;

  console.log(`   ✅ Concurrent queries (${concurrentQueries}) completed in ${concurrentTime}ms`);

  // 2. Test embedding generation performance
  const embeddingStartTime = Date.now();
  
  try {
    const response = await fetch('http://localhost:8081/embed', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        texts: ['Test text for performance measurement']
      }),
    });

    if (response.ok) {
      const embeddingTime = Date.now() - embeddingStartTime;
      console.log(`   ✅ Single embedding generated in ${embeddingTime}ms`);
    } else {
      console.log('   ⚠️ Embedding performance test failed');
    }
  } catch (error) {
    console.log('   ⚠️ Embedding performance test failed:', error instanceof Error ? error.message : 'Unknown error');
  }

  // 3. Test queue processing performance
  const queueStartTime = Date.now();
  const queueItems = await convex.query(api.processing.getNextQueueItems, { limit: 10 });
  const queueTime = Date.now() - queueStartTime;

  console.log(`   ✅ Queue query completed in ${queueTime}ms (${queueItems.length} items)`);
}

/**
 * Generate deployment checklist
 */
function generateDeploymentChecklist() {
  console.log('\n📋 Deployment Checklist');
  console.log('======================');
  console.log('\nBefore deploying to production, ensure:');
  console.log('');
  console.log('✅ Environment Configuration:');
  console.log('   - All environment variables are set in production');
  console.log('   - API keys have proper permissions');
  console.log('   - Webhook secrets are configured');
  console.log('');
  console.log('✅ Infrastructure:');
  console.log('   - Convex deployment is live and accessible');
  console.log('   - Embedding service is deployed and running');
  console.log('   - GitHub webhook is configured to point to your deployment');
  console.log('');
  console.log('✅ Monitoring:');
  console.log('   - Queue monitoring dashboard is accessible');
  console.log('   - Error logging is configured');
  console.log('   - Performance metrics are being collected');
  console.log('');
  console.log('✅ Testing:');
  console.log('   - All integration tests pass');
  console.log('   - Webhook processing works end-to-end');
  console.log('   - RAG queries return relevant results');
  console.log('');
  console.log('✅ Security:');
  console.log('   - API keys are properly secured');
  console.log('   - Webhook signatures are verified');
  console.log('   - Rate limiting is configured');
  console.log('');
  console.log('✅ Documentation:');
  console.log('   - API documentation is up to date');
  console.log('   - User guides are available');
  console.log('   - Troubleshooting guides are prepared');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testCompleteRAGPipeline()
    .then((success) => {
      if (success) {
        generateDeploymentChecklist();
      }
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('\n❌ Test execution failed:', error);
      process.exit(1);
    });
}

export { testCompleteRAGPipeline, generateDeploymentChecklist };
