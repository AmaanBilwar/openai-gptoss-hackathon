declare module 'keyring' {
  interface Keyring {
    setPassword(service: string, account: string, password: string): Promise<void>;
    getPassword(service: string, account: string): Promise<string | null>;
    deletePassword(service: string, account: string): Promise<void>;
  }

  const keyring: Keyring;
  export default keyring;
}
