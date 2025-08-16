import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TokenData } from './types';

/**
 * TokenStore handles persistence of GitHub OAuth tokens
 * Uses OS keyring when available, falls back to file storage
 */
export class TokenStore {
  private readonly serviceName: string;
  private readonly filename: string;
  private keyring: any = null;

  constructor(serviceName: string = 'gh_oauth_cli', filename: string = '.gh_oauth_token') {
    this.serviceName = serviceName;
    this.filename = path.join(os.homedir(), filename);
    
    // Try to import keyring
    try {
      // Note: keyring is not included in package.json as it's optional
      // Users can install it separately: npm install keyring
      this.keyring = require('keyring');
    } catch {
      this.keyring = null;
    }
  }

  /**
   * Save token to secure storage
   */
  async save(token: string): Promise<void> {
    const tokenData: TokenData = {
      access_token: token,
      created_at: new Date().toISOString()
    };

    if (this.keyring) {
      try {
        await this.keyring.setPassword(this.serviceName, 'token', JSON.stringify(tokenData));
        return;
      } catch (error) {
        console.warn('Failed to save token to keyring, falling back to file storage:', error);
      }
    }

    // Fallback to file storage
    try {
      await fs.promises.writeFile(this.filename, JSON.stringify(tokenData, null, 2), 'utf8');
      // Set restrictive permissions on the token file
      await fs.promises.chmod(this.filename, 0o600);
    } catch (error) {
      throw new Error(`Failed to save token to file: ${error}`);
    }
  }

  /**
   * Load token from secure storage
   */
  async load(): Promise<string | null> {
    if (this.keyring) {
      try {
        const tokenJson = await this.keyring.getPassword(this.serviceName, 'token');
        if (tokenJson) {
          const tokenData: TokenData = JSON.parse(tokenJson);
          return tokenData.access_token;
        }
      } catch (error) {
        console.warn('Failed to load token from keyring, trying file storage:', error);
      }
    }

    // Fallback to file storage
    if (!fs.existsSync(this.filename)) {
      return null;
    }

    try {
      const data = await fs.promises.readFile(this.filename, 'utf8');
      const tokenData: TokenData = JSON.parse(data);
      return tokenData.access_token;
    } catch (error) {
      console.warn('Failed to load token from file:', error);
      return null;
    }
  }

  /**
   * Delete token from storage
   */
  async delete(): Promise<void> {
    if (this.keyring) {
      try {
        await this.keyring.deletePassword(this.serviceName, 'token');
        return;
      } catch (error) {
        console.warn('Failed to delete token from keyring:', error);
      }
    }

    try {
      if (fs.existsSync(this.filename)) {
        await fs.promises.unlink(this.filename);
      }
    } catch (error) {
      console.warn('Failed to delete token file:', error);
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await this.load();
    return token !== null;
  }

  /**
   * Get token data with metadata
   */
  async getTokenData(): Promise<TokenData | null> {
    if (this.keyring) {
      try {
        const tokenJson = await this.keyring.getPassword(this.serviceName, 'token');
        if (tokenJson) {
          return JSON.parse(tokenJson);
        }
      } catch (error) {
        console.warn('Failed to load token data from keyring:', error);
      }
    }

    if (!fs.existsSync(this.filename)) {
      return null;
    }

    try {
      const data = await fs.promises.readFile(this.filename, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load token data from file:', error);
      return null;
    }
  }
}
