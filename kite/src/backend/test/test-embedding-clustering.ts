import { IntelligentCommitSplitter } from '../intelligentCommitSplitter';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function testEmbeddingClustering() {
  console.log('🧪 Testing Embedding-based Commit Clustering...');
  
  const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
  
  if (!cerebrasApiKey) {
    console.error('❌ CEREBRAS_API_KEY environment variable not set');
    console.log('💡 Please set the CEREBRAS_API_KEY environment variable to test intelligent commit splitting');
    return;
  }

  try {
    // Initialize the intelligent commit splitter with new flow
    console.log('🔧 Initializing IntelligentCommitSplitter with embedding-based clustering...');
    const splitter = new IntelligentCommitSplitter(cerebrasApiKey);
    
    console.log('🚀 Running embedding-based commit analysis...');
    console.log('📊 Flow: get hunks → vectorize → cluster by similarity → generate commits');
    
    // Run the analysis in dry-run mode (don't actually commit)
    const commitGroups = await splitter.runIntelligentSplitting(false);
    
    if (commitGroups.length > 0) {
      console.log(`✅ Analysis completed! Found ${commitGroups.length} semantic commit groups.`);
      console.log('\n📋 Embedding-based Commit Groups:');
      
      for (let i = 0; i < commitGroups.length; i++) {
        const group = commitGroups[i];
        console.log(`\n${i + 1}. ${group.feature_name}`);
        console.log(`   📝 Title: ${group.commit_title}`);
        console.log(`   📄 Description: ${group.commit_message}`);
        console.log(`   📁 Files (${group.files.length}): ${group.files.map(f => f.file_path).join(', ')}`);
        
        // Show hunk information if available
        const totalHunks = group.files.reduce((sum, file) => sum + (file.hunks?.length || 0), 0);
        if (totalHunks > 0) {
          console.log(`   🔧 Total hunks: ${totalHunks}`);
        }
      }
      
      // Test clustering effectiveness
      console.log('\n📊 Clustering Analysis:');
      const totalFiles = commitGroups.reduce((sum, group) => sum + group.files.length, 0);
      const avgFilesPerGroup = totalFiles / commitGroups.length;
      console.log(`   📈 Average files per group: ${avgFilesPerGroup.toFixed(1)}`);
      
      // Check for semantic clustering (groups with multiple files likely found similarities)
      const semanticGroups = commitGroups.filter(group => group.files.length > 1);
      console.log(`   🧠 Semantic groups (multiple files): ${semanticGroups.length}/${commitGroups.length}`);
      
      if (semanticGroups.length > 0) {
        console.log('   ✨ Successfully identified related changes through embeddings!');
      }
      
    } else {
      console.log('No changes detected or no commit groups identified.');
      console.log('Try making some changes to your code files and run again.');
    }
    
  } catch (error) {
    console.error('❌ Error during embedding-based clustering test:', error);
    
    // Provide helpful debugging information
    if (error instanceof Error) {
      if (error.message.includes('JINA') || error.message.includes('embedding')) {
        console.log('💡 This might be an embedding service issue. The system should fall back to local embeddings.');
      } else if (error.message.includes('git')) {
        console.log('💡 This might be a git-related issue. Make sure you have uncommitted changes.');
      } else if (error.message.includes('CEREBRAS')) {
        console.log('💡 This might be a Cerebras API issue. Check your API key and quota.');
      }
    }
  }
}

// Additional test for specific embedding clustering scenarios
async function testClusteringSimilarity() {
  console.log('\n🔬 Testing Clustering Similarity Scenarios...');
  
  const cerebrasApiKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasApiKey) return;
  
  try {
    const splitter = new IntelligentCommitSplitter(cerebrasApiKey);
    
    // Test with current changes
    console.log('🔍 Analyzing current changes for similarity patterns...');
    const commitGroups = await splitter.runIntelligentSplitting(false);
    
    // Analyze clustering patterns
    console.log('\n🎯 Similarity Analysis:');
    
    for (const group of commitGroups) {
      if (group.files.length > 1) {
        console.log(`\n🔗 Group "${group.feature_name}":`);
        console.log(`   📁 Files: ${group.files.map(f => f.file_path).join(', ')}`);
        
        // Check for common patterns
        const fileExtensions = group.files.map(f => f.file_path.split('.').pop()).filter(Boolean);
        const uniqueExtensions = [...new Set(fileExtensions)];
        console.log(`   📄 File types: ${uniqueExtensions.join(', ')}`);
        
        const directories = group.files.map(f => f.file_path.split('/').slice(0, -1).join('/'));
        const uniqueDirs = [...new Set(directories)];
        console.log(`   📂 Directories: ${uniqueDirs.join(', ')}`);
        
        if (group.description.includes('similarity')) {
          console.log(`   ✨ Semantic similarity detected!`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error in similarity testing:', error);
  }
}

// Run the tests
async function runAllTests() {
  await testEmbeddingClustering();
  await testClusteringSimilarity();
  
  console.log('\n🏁 Testing completed!');
  console.log('💡 The new flow uses lightweight embeddings to find semantically related code changes');
  console.log('🔄 Flow: hunks → embeddings → cosine similarity → clusters → descriptive commits');
}

runAllTests().catch(console.error);