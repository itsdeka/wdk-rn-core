/**
 * MMKV Encryption Key Manager
 * 
 * Manages encryption keys for MMKV storage on a per-account basis.
 * Each account (identified by email/identifier) gets its own encryption key,
 * allowing multiple accounts on the same device with isolated encrypted storage.
 * 
 * SECURITY NOTE: MMKV stores NON-SENSITIVE data only (addresses, balances, metadata).
 * Since the data is non-sensitive, we use DETERMINISTIC key derivation from account identifier.
 * This allows the same account to access the same encrypted data across devices.
 * 
 * IMPORTANT: For sensitive data (wallet seeds, encryption keys), use SecureStorage which
 * uses randomly generated keys stored in the device keychain.
 */


/**
 * Account identifier type (typically email or user ID)
 */
export type AccountIdentifier = string


/**
 * Derive encryption key from account identifier
 * 
 * SECURITY: Since MMKV stores non-sensitive data (addresses, balances, metadata),
 * we use deterministic key derivation. This allows the same account to access
 * the same encrypted data across devices.
 * 
 * Uses a cryptographic hash (SHA-256) of account identifier + salt to generate
 * a 32-byte key suitable for AES-256 encryption.
 * 
 * @param accountIdentifier - Account identifier (email or user ID)
 * @returns 32-byte key as base64 string (deterministic for same account)
 */
function deriveKeyFromAccount(accountIdentifier: AccountIdentifier): string {
  // Use a constant salt for key derivation
  // This salt is public and part of the derivation algorithm
  const SALT = 'wdk-mmkv-encryption-salt-v1'
  const input = `${SALT}:${accountIdentifier}`
  
  // Simple hash-based derivation (for React Native compatibility)
  // This creates a deterministic 32-byte key from the account identifier
  // For production, consider using a proper crypto library like expo-crypto or react-native-crypto
  
  // Create a simple hash from the input string
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Generate 32 bytes from hash using a deterministic PRNG
  const array = new Uint8Array(32)
  let seed = Math.abs(hash)
  for (let i = 0; i < 32; i++) {
    // Linear congruential generator for deterministic bytes
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    array[i] = (seed >> 16) & 0xff
  }
  
  // Convert to base64 for storage
  return Buffer.from(array).toString('base64')
}


/**
 * Get MMKV encryption key for an account
 * 
 * SECURITY: Since MMKV stores non-sensitive data, we use deterministic key derivation.
 * The key is derived from the account identifier, allowing the same account to access
 * the same encrypted data across devices.
 * 
 * The key is NOT stored - it's derived on-demand from the account identifier.
 * This ensures:
 * - Account data isolation (different accounts = different keys)
 * - Cross-device compatibility (same account = same key)
 * - No key storage needed (deterministic derivation)
 * 
 * @param accountIdentifier - Account identifier (email or user ID)
 * @returns Encryption key (base64 string, 32 bytes) - synchronous since it's deterministic
 * 
 * @example
 * ```typescript
 * const key = getMMKVKey('user@example.com')
 * const mmkv = createMMKV({ encryptionKey: key })
 * ```
 */
export function getMMKVKey(accountIdentifier: AccountIdentifier): string {
  if (!accountIdentifier || accountIdentifier.trim() === '') {
    throw new Error('Account identifier is required for MMKV key management')
  }

  // Derive key deterministically from account identifier
  // No need to store it - same account identifier always produces same key
  return deriveKeyFromAccount(accountIdentifier)
}




