#!/usr/bin/env tsx

import { GPTOSSToolCaller } from './toolCalling';
import { ChatMessage } from './types';
import { validateConfig } from './config';

async function testChatHistory(): Promise<void> {
  try {
    console.log('🧪 Testing chat history functionality...\n');
    
    // Validate environment configuration
    validateConfig();
    
    // Create tool caller instance
    const caller = new GPTOSSToolCaller('gpt-oss-120b');
    
    // Test messages
    const testMessages: ChatMessage[] = [
      {
        role: 'user',
        content: 'Hello, can you help me commit my changes?'
      },
      {
        role: 'assistant',
        content: 'Of course! I can help you commit your changes. Let me check the current git status first.'
      },
      {
        role: 'user',
        content: 'Great! I want to commit with the message "Add new feature"'
      },
      {
        role: 'assistant',
        content: 'Perfect! I\'ll help you commit with that message. Let me use the intelligent commit splitting tool.'
      }
    ];
    
    console.log('📝 Test messages:');
    testMessages.forEach((msg, index) => {
      const role = msg.role === 'user' ? 'You' : 'Kite';
      console.log(`  ${index + 1}. ${role}: ${msg.content}`);
    });
    console.log('');
    
    // Test saving chat history
    console.log('💾 Testing chat history save...');
    const chatId = await caller.saveChatHistory(testMessages);
    if (chatId) {
      console.log(`✅ Chat saved successfully with ID: ${chatId}`);
    } else {
      console.log('❌ Failed to save chat history');
      return;
    }
    
    // Test loading chat history
    console.log('\n📚 Testing chat history load...');
    const loadedMessages = await caller.loadChatHistory();
    if (loadedMessages.length > 0) {
      console.log(`✅ Loaded ${loadedMessages.length} messages from chat history`);
      console.log('📝 Loaded messages:');
      loadedMessages.forEach((msg, index) => {
        const role = msg.role === 'user' ? 'You' : 'Kite';
        console.log(`  ${index + 1}. ${role}: ${msg.content}`);
      });
    } else {
      console.log('❌ Failed to load chat history');
    }
    
    // Test listing chats
    console.log('\n📋 Testing chat listing...');
    const chats = await caller.listChats();
    if (chats.length > 0) {
      console.log(`✅ Found ${chats.length} chats:`);
      chats.forEach((chat, index) => {
        const date = new Date(chat.createdAt).toLocaleDateString();
        console.log(`  ${index + 1}. ${chat.title} (${chat.messageCount} messages, ${date})`);
      });
    } else {
      console.log('❌ No chats found');
    }
    
    // Test loading specific chat by ID
    if (chatId && chats.length > 0) {
      console.log('\n🔍 Testing specific chat load...');
      const specificChatMessages = await caller.loadChatById(chatId);
      if (specificChatMessages.length > 0) {
        console.log(`✅ Loaded specific chat with ${specificChatMessages.length} messages`);
      } else {
        console.log('❌ Failed to load specific chat');
      }
    }
    
    console.log('\n🎉 Chat history testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testChatHistory().catch((error) => {
    console.error('❌ Failed to run test:', error);
    process.exit(1);
  });
}
