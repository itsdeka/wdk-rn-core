import { createMMKV, type MMKV } from 'react-native-mmkv'

/**
 * Storage adapter interface for Zustand persistence
 */
export interface StorageAdapter {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

/**
 * Create MMKV storage instance for the wallet
 * 
 * SECURITY NOTE: MMKV stores files in the app's document directory, which is app-scoped.
 * Two different apps will NOT share data because each app has its own isolated document directory.
 * 
 * This is for non-sensitive data persistence (wallet metadata, balances, addresses).
 * For sensitive data (encrypted seeds, keys), use SecureStorage from wdk-rn-secure-storage.
 */
export function createMMKVStorage(): MMKV {
  return createMMKV({
    id: 'wallet-storage',
    encryptionKey: 'wallet-encryption-key',
  })
}

/**
 * Storage adapter factory for Zustand persistence
 * This allows Zustand stores to use MMKV for persistence
 */
export function createMMKVStorageAdapter(): StorageAdapter {
  const storage = createMMKVStorage()
  
  return {
    getItem: (name: string): string | null => {
      const value = storage.getString(name)
      return value ?? null
    },
    setItem: (name: string, value: string): void => {
      storage.set(name, value)
    },
    removeItem: (name: string): void => {
      storage.remove(name)
    },
  }
}

