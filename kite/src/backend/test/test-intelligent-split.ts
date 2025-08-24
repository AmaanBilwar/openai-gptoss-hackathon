import { IntelligentCommitSplitter } from '../intelligentCommitSplitter';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testIntelligentCommitSplit() {
  console.log('🧪 Testing Intelligent Commit Split...');
  
  const supermemoryApiKey = process.env.SUPERMEMORY_API_KEY;
  const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
  
  if (!supermemoryApiKey) {
    console.error('❌ SUPERMEMORY_API_KEY environment variable not set');
    console.log('💡 Please set the SUPERMEMORY_API_KEY environment variable to test intelligent commit splitting');
    return;
  }
  
  if (!cerebrasApiKey) {
    console.error('❌ CEREBRAS_API_KEY environment variable not set');
    console.log('💡 Please set the CEREBRAS_API_KEY environment variable to test intelligent commit splitting');
    return;
  }
  
  try {
    // Initialize the intelligent commit splitter
    const splitter = new IntelligentCommitSplitter(supermemoryApiKey, cerebrasApiKey);
    
    console.log('🚀 Running intelligent commit splitting analysis...');
    
    // Run the analysis in dry-run mode
    const commitGroups = await splitter.runIntelligentSplitting(false);
    
    if (commitGroups.length > 0) {
      console.log(`✅ Analysis completed! Found ${commitGroups.length} commit groups.`);
      console.log('\n📋 Commit Groups:');
      
      for (let i = 0; i < commitGroups.length; i++) {
        const group = commitGroups[i];
        console.log(`\n${i + 1}. ${group.feature_name}`);
        console.log(`   Title: ${group.commit_title}`);
        console.log(`   Description: ${group.commit_message}`);
        console.log(`   Files: ${group.files.map(f => f.file_path).join(', ')}`);
      }
    } else {
      console.log('ℹ️  No changes detected or no commit groups identified.');
    }
    
  } catch (error) {
    console.error('❌ Error during intelligent commit splitting:', error);
  }
}

// Run the test
testIntelligentCommitSplit().catch(console.error);
