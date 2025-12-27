/**
 * Mock SecureStorage for testing
 */

export const mockSecureStorage = {
  authenticate: jest.fn(() => Promise.resolve(true)),
  hasWallet: jest.fn(() => Promise.resolve(false)),
  setEncryptionKey: jest.fn(() => Promise.resolve()),
  getEncryptionKey: jest.fn(() => Promise.resolve(null)),
  setEncryptedSeed: jest.fn(() => Promise.resolve()),
  getEncryptedSeed: jest.fn(() => Promise.resolve(null)),
  setEncryptedEntropy: jest.fn(() => Promise.resolve()),
  getEncryptedEntropy: jest.fn(() => Promise.resolve(null)),
  getAllEncrypted: jest.fn(() => Promise.resolve({
    encryptedSeed: null,
    encryptedEntropy: null,
    encryptionKey: null,
  })),
  clearAll: jest.fn(() => Promise.resolve()),
  isBiometricAvailable: jest.fn(() => Promise.resolve(true)),
  deleteWallet: jest.fn(() => Promise.resolve()),
  cleanup: jest.fn(),
}

export default mockSecureStorage
