#!/usr/bin/env tsx

import * as readline from 'readline';

console.log('🧪 Testing input visibility...');
console.log('Type something and press Enter. You should see what you type.\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

rl.question('Test input: ', (answer) => {
  console.log(`✅ You typed: "${answer}"`);
  console.log('If you can see this, input is working correctly!');
  rl.close();
  process.exit(0);
});
