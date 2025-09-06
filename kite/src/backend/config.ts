import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env file
// Look for .env in the kite directory (parent of src/backend)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

// Also try loading from current directory as fallback
dotenv.config();

export interface EnvironmentConfig {
  GITHUB_CLIENT_ID: string;
  CEREBRAS_API_KEY: string;
  MORPH_API_KEY?: string;
  GITHUB_API_URL?: string;
}

export const config: EnvironmentConfig = {
  GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID || '',
  CEREBRAS_API_KEY: process.env.CEREBRAS_API_KEY || '',
  MORPH_API_KEY: process.env.MORPH_API_KEY || '',
  GITHUB_API_URL: process.env.GITHUB_API_URL || 'https://api.github.com'
};

// Validate required environment variables
export function validateConfig(): void {
  const required = ['GITHUB_CLIENT_ID'];
  const missing = required.filter(key => !config[key as keyof EnvironmentConfig]);
  
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please create a .env file in the kite directory with these variables:\n` +
      `GITHUB_CLIENT_ID=your_github_client_id\n` +
      `CEREBRAS_API_KEY=your_cerebras_api_key (optional if using user API keys)`
    );
  }
  
  // Warn if CEREBRAS_API_KEY is missing but don't fail
  if (!config.CEREBRAS_API_KEY) {
    console.warn('⚠️  CEREBRAS_API_KEY not set. Users will need to provide their own API keys through the Kite settings.');
  }
}

// Export individual config values for convenience
export const { GITHUB_CLIENT_ID, CEREBRAS_API_KEY, MORPH_API_KEY, GITHUB_API_URL } = config;
