import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../../convex/_generated/api';

/**
 * Test script for the automated queue processing system
 */
async function testQueueProcessing() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://posh-cassowary-12.convex.cloud';
  const convex = new ConvexHttpClient(convexUrl);

  console.log('🧪 Testing Automated Queue Processing System');
  console.log('===========================================');

  try {
    // 1. Check initial queue health
    console.log('\n1. Checking initial queue health...');
    const initialHealth = await convex.query(api.processing.getQueueHealth, {});
    console.log('✅ Queue health:', initialHealth);

    // 2. Queue a test commit for processing
    console.log('\n2. Queuing test commit for processing...');
    const queueResult = await convex.mutation(api.processing.queueCommitProcessing, {
      repoId: 1756108131418, // kite-test-repo
      sha: 'test-commit-queue-' + Date.now(),
      priority: 1,
      metadata: {}
    });
    console.log(`✅ Queued commit: ${queueResult}`);

    // 3. Check queue status after queuing
    console.log('\n3. Checking queue status after queuing...');
    const queueItems = await convex.query(api.processing.getNextQueueItems, { limit: 5 });
    console.log(`✅ Found ${queueItems.length} items in queue`);

    // 4. Manually trigger queue processing
    console.log('\n4. Manually triggering queue processing...');
    const triggerResult = await convex.mutation(api.processing.triggerQueueProcessing, {});
    console.log('✅ Trigger result:', triggerResult);

    // 5. Check processing statistics
    console.log('\n5. Checking processing statistics...');
    const stats = await convex.query(api.processing.getProcessingStats, {});
    console.log('✅ Processing stats:', stats);

    // 6. Wait a moment and check queue health again
    console.log('\n6. Waiting and checking queue health...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const finalHealth = await convex.query(api.processing.getQueueHealth, {});
    console.log('✅ Final queue health:', finalHealth);

    // 7. Test queue management functions
    console.log('\n7. Testing queue management functions...');
    
    // Test resetting stuck items (should be 0 in test)
    const resetResult = await convex.mutation(api.processing.cleanUpQueueItems, {});
    console.log('✅ Reset stuck items result:', resetResult);

    console.log('\n🎉 Queue processing test completed successfully!');

  } catch (error) {
    console.error('❌ Queue processing test failed:', error);
  }
}

/**
 * Test the complete webhook to queue pipeline
 */
async function testWebhookToQueuePipeline() {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL || 'https://posh-cassowary-12.convex.cloud';
  const convex = new ConvexHttpClient(convexUrl);

  console.log('\n🧪 Testing Webhook to Queue Pipeline');
  console.log('====================================');

  try {
    // 1. Simulate webhook event storage
    console.log('\n1. Simulating webhook event...');
    const webhookEventId = await convex.mutation(api.webhooks.storeWebhookEvent, {
      repoId: 1756108131418,
      eventType: 'push',
      eventId: 'test-webhook-' + Date.now(),
      deliveryId: 'test-delivery-' + Date.now(),
      payload: {}
    });
    console.log(`✅ Stored webhook event: ${webhookEventId}`);

    // 2. Queue commit from webhook
    console.log('\n2. Queuing commit from webhook...');
    const queueResult = await convex.mutation(api.processing.queueCommitProcessing, {
      repoId: 1756108131418,
      sha: 'test-commit-pipeline-' + Date.now(),
      priority: 2,
      metadata: {}
    });
    console.log(`✅ Queued commit from webhook: ${queueResult}`);

    // 3. Check queue status
    console.log('\n3. Checking queue status...');
    const queueItems = await convex.query(api.processing.getNextQueueItems, { limit: 10 });
    console.log(`✅ Queue items: ${queueItems.length}`);

    // 4. Check processing status
    console.log('\n4. Checking processing status...');
    const commitProcessing = await convex.query(api.commitProcessing.getCommitProcessingStatus, {
      repoId: 1756108131418,
      sha: 'test-commit-pipeline-' + Date.now()
    });
    console.log('✅ Commit processing status:', commitProcessing);

    console.log('\n🎉 Webhook to queue pipeline test completed!');

  } catch (error) {
    console.error('❌ Webhook to queue pipeline test failed:', error);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testQueueProcessing()
    .then(() => testWebhookToQueuePipeline())
    .then(() => {
      console.log('\n✅ All queue processing tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Queue processing tests failed:', error);
      process.exit(1);
    });
}

export { testQueueProcessing, testWebhookToQueuePipeline };
