/**
 * Mock SecureStorage for testing
 */
export const createSecureStorage = jest.fn(() => ({
  authenticate: jest.fn().mockResolvedValue(true),
  hasWallet: jest.fn().mockResolvedValue(false),
  getEncryptionKey: jest.fn().mockResolvedValue('mock-encryption-key'),
  getEncryptedSeed: jest.fn().mockResolvedValue('mock-encrypted-seed'),
  getEncryptedEntropy: jest.fn().mockResolvedValue('mock-encrypted-entropy'),
  setEncryptionKey: jest.fn().mockResolvedValue(undefined),
  setEncryptedSeed: jest.fn().mockResolvedValue(undefined),
  setEncryptedEntropy: jest.fn().mockResolvedValue(undefined),
  deleteWallet: jest.fn().mockResolvedValue(undefined),
  isBiometricAvailable: jest.fn().mockResolvedValue(true),
}));

export type SecureStorage = ReturnType<typeof createSecureStorage>;

