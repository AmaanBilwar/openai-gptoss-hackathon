import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TokenData } from './types';
// import { Keyring } from 'keyring'
  
/**
 * TokenStore handles persistence of GitHub OAuth tokens and Convex tokens
 * Uses OS keyring when available, falls back to file storage
 */
export class TokenStore {
  private readonly serviceName: string;
  private readonly filename: string;
  private readonly convexServiceName: string;
  private readonly convexFilename: string;
  private keyring: any = null;
  private keyringInitialized: boolean = false;

  constructor(serviceName: string = 'gh_oauth_cli', filename: string = '.gh_oauth_token') {
    this.serviceName = serviceName;
    this.filename = path.join(os.homedir(), filename);
    this.convexServiceName = 'convex_cli';
    this.convexFilename = path.join(os.homedir(), '.convex_token');
  }

  /**
   * Initialize keyring if available
   */
  private async initializeKeyring(): Promise<void> {
    if (this.keyringInitialized) {
      return;
    }

    // Only try to load keyring in Node.js environment
    if (typeof globalThis !== 'undefined' && typeof process !== 'undefined') {
      try {
        // Use dynamic import to avoid bundling issues
        const keyringModule = await import('keyring');
        this.keyring = keyringModule.default || keyringModule;
        this.keyringInitialized = true;
      } catch (error) {
        console.warn('Keyring not available, falling back to file storage:', error);
        this.keyring = null;
        this.keyringInitialized = true;
      }
    } else {
      this.keyring = null;
      this.keyringInitialized = true;
    }
  }

  /**
   * Save token to secure storage
   */
  async save(token: string): Promise<void> {
    await this.initializeKeyring();
    
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
   * Save Convex token to secure storage
   */
  async saveConvexToken(token: string): Promise<void> {
    await this.initializeKeyring();
    
    const tokenData: TokenData = {
      access_token: token,
      created_at: new Date().toISOString()
    };

    if (this.keyring) {
      try {
        await this.keyring.setPassword(this.convexServiceName, 'token', JSON.stringify(tokenData));
        return;
      } catch (error) {
        console.warn('Failed to save Convex token to keyring, falling back to file storage:', error);
      }
    }

    // Fallback to file storage
    try {
      await fs.promises.writeFile(this.convexFilename, JSON.stringify(tokenData, null, 2), 'utf8');
      // Set restrictive permissions on the token file
      await fs.promises.chmod(this.convexFilename, 0o600);
    } catch (error) {
      throw new Error(`Failed to save Convex token to file: ${error}`);
    }
  }

  /**
   * Load token from secure storage
   */
  async load(): Promise<string | null> {
    await this.initializeKeyring();
    
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
   * Load Convex token from secure storage
   */
  async getConvexToken(): Promise<string | null> {
    await this.initializeKeyring();
    
    if (this.keyring) {
      try {
        const tokenJson = await this.keyring.getPassword(this.convexServiceName, 'token');
        if (tokenJson) {
          const tokenData: TokenData = JSON.parse(tokenJson);
          return tokenData.access_token;
        }
      } catch (error) {
        console.warn('Failed to load Convex token from keyring, trying file storage:', error);
      }
    }

    // Fallback to file storage
    if (!fs.existsSync(this.convexFilename)) {
      return null;
    }

    try {
      const data = await fs.promises.readFile(this.convexFilename, 'utf8');
      const tokenData: TokenData = JSON.parse(data);
      return tokenData.access_token;
    } catch (error) {
      console.warn('Failed to load Convex token from file:', error);
      return null;
    }
  }

  /**
   * Delete token from storage
   */
  async delete(): Promise<void> {
    await this.initializeKeyring();
    
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
   * Delete Convex token from storage
   */
  async deleteConvexToken(): Promise<void> {
    await this.initializeKeyring();
    
    if (this.keyring) {
      try {
        await this.keyring.deletePassword(this.convexServiceName, 'token');
        return;
      } catch (error) {
        console.warn('Failed to delete Convex token from keyring:', error);
      }
    }

    try {
      if (fs.existsSync(this.convexFilename)) {
        await fs.promises.unlink(this.convexFilename);
      }
    } catch (error) {
      console.warn('Failed to delete Convex token file:', error);
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
   * Check if user is authenticated with Convex
   */
  async isConvexAuthenticated(): Promise<boolean> {
    const token = await this.getConvexToken();
    return token !== null;
  }

  /**
   * Get token data with metadata
   */
  async getTokenData(): Promise<TokenData | null> {
    await this.initializeKeyring();
    
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

  /**
   * Get Convex token data with metadata
   */
  async getConvexTokenData(): Promise<TokenData | null> {
    await this.initializeKeyring();
    
    if (this.keyring) {
      try {
        const tokenJson = await this.keyring.getPassword(this.convexServiceName, 'token');
        if (tokenJson) {
          return JSON.parse(tokenJson);
        }
      } catch (error) {
        console.warn('Failed to load Convex token data from keyring:', error);
      }
    }

    if (!fs.existsSync(this.convexFilename)) {
      return null;
    }

    try {
      const data = await fs.promises.readFile(this.convexFilename, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load Convex token data from file:', error);
      return null;
    }
  }
}
