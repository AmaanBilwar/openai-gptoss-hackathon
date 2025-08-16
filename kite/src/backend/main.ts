#!/usr/bin/env tsx

import { startInteractiveChat } from './chat';
import { validateConfig } from './config';

async function main(): Promise<void> {
  try {
    validateConfig();
    
    await startInteractiveChat();
  } catch (error) {
    console.error('Error starting chat application:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}
// run the app
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  });
}
