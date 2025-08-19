#!/usr/bin/env tsx

import { TokenStore } from './tokenStore';

/**
 * CLI authentication utilities
 */
export class AuthCLI {
  private tokenStore: TokenStore;

  constructor() {
    this.tokenStore = new TokenStore();
  }

  /**
   * Check authentication status
   */
  async checkStatus(): Promise<void> {
    const isAuthenticated = await this.tokenStore.isAuthenticated();
    
    if (isAuthenticated) {
      const tokenData = await this.tokenStore.getTokenData();
      console.log('✅ Authenticated');
      if (tokenData?.created_at) {
        const createdDate = new Date(tokenData.created_at);
        console.log(`   Token created: ${createdDate.toLocaleDateString()}`);
      }
    } else {
      console.log('❌ Not authenticated');
      console.log('   Run "bun run chat" to start authentication');
    }
  }

  /**
   * Log out (delete stored token)
   */
  async logout(): Promise<void> {
    const isAuthenticated = await this.tokenStore.isAuthenticated();
    
    if (!isAuthenticated) {
      console.log('❌ Not authenticated - nothing to log out');
      return;
    }

    try {
      await this.tokenStore.delete();
      console.log('✅ Successfully logged out');
    } catch (error) {
      console.error('❌ Failed to log out:', error);
    }
  }

  /**
   * Get authentication URL for CLI
   */
  getAuthUrl(): string {
    return 'http://localhost:3000?from_cli=true';
  }
}

// CLI interface
async function main() {
  const auth = new AuthCLI();
  const command = process.argv[2];

  switch (command) {
    case 'status':
      await auth.checkStatus();
      break;
    case 'logout':
      await auth.logout();
      break;
    case 'url':
      console.log(auth.getAuthUrl());
      break;
    default:
      console.log('Available commands:');
      console.log('  status  - Check authentication status');
      console.log('  logout  - Log out and delete stored token');
      console.log('  url     - Get authentication URL');
      break;
  }
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Auth command failed:', error);
    process.exit(1);
  });
}
