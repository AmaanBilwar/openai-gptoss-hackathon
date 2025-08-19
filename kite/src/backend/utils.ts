import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Opens the default browser to the specified URL
 */
export async function openBrowser(url: string): Promise<void> {
  const platform = process.platform;
  
  try {
    switch (platform) {
      case 'darwin': // macOS
        await execAsync(`open "${url}"`);
        break;
      case 'win32': // Windows
        try {
          // Try the standard start command first
          await execAsync(`start "" "${url}"`);
        } catch {
          // Fallback: try using the default browser directly
          await execAsync(`rundll32 url.dll,FileProtocolHandler "${url}"`);
        }
        break;
      default: // Linux and others
        await execAsync(`xdg-open "${url}"`);
        break;
    }
  } catch (error) {
    console.warn('Could not automatically open browser:', error);
    console.log(`Please manually visit: ${url}`);
  }
}

/**
 * Generates a random state parameter for OAuth security
 */
export function generateState(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}
