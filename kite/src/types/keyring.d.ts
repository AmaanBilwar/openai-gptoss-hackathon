declare module 'keyring' {
  export class Keyring {
    constructor(service: string);
    getPassword(account: string): Promise<string | null>;
    setPassword(account: string, password: string): Promise<void>;
    deletePassword(account: string): Promise<boolean>;
  }
}
