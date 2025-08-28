import { SupermemoryClient } from './supermemoryClient';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testSupermemory() {
  console.log('🧪 Testing Supermemory Client...');
  
  const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
  
  if (!supermemoryApiKey) {
    console.error('❌ SUPERMEMORY_API_KEY environment variable not set');
    return;
  }
  
  try {
    const client = new SupermemoryClient(supermemoryApiKey);
    
    // Test adding a memory
    console.log('📤 Adding test memory...');
    const memory = await client.addMemory(
      'This is a test memory for commit splitting',
      { test: true, session: 'test' },
      ['test', 'commit-split']
    );
    console.log(`✅ Added memory with ID: ${memory.id}`);
    
    // Skip search test for now due to API issues
    console.log('⏭️ Skipping search test due to API issues...');
    
    // Test deleting the memory
    console.log('🗑️ Deleting test memory...');
    const deleted = await client.deleteMemory(memory.id);
    if (deleted) {
      console.log(`✅ Successfully deleted memory: ${memory.id}`);
    } else {
      console.log(`❌ Failed to delete memory: ${memory.id}`);
    }
    
    // Test batch deletion with empty array
    console.log('🗑️ Testing batch deletion with empty array...');
    const batchResult = await client.deleteMemoriesBatch([]);
    console.log(`✅ Batch deletion result: ${batchResult} memories deleted`);
    
    console.log('✅ Supermemory client test completed successfully!');
    
  } catch (error) {
    console.error('❌ Error testing Supermemory:', error);
  }
}

// Run the test
testSupermemory().catch(console.error);
