/**
 * Jest setup file
 * Configures test environment and mocks
 * 
 * Note: These mocks are only needed for tests that use React Native modules.
 * Utility tests (validation, errorUtils, balanceUtils) don't require these mocks.
 */

// Mock React Native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((dict) => dict.ios),
  },
}), { virtual: true });

// Mock react-native-mmkv
jest.mock('react-native-mmkv', () => {
  const mockMMKVInstance = {
    set: jest.fn(),
    getString: jest.fn(),
    getNumber: jest.fn(),
    getBoolean: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
    contains: jest.fn(),
  }
  
  return {
    createMMKV: jest.fn(() => mockMMKVInstance),
    MMKV: jest.fn(() => mockMMKVInstance),
  }
}, { virtual: true });

// Mock react-native-bare-kit
jest.mock('react-native-bare-kit', () => ({
  Worklet: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    IPC: {},
  })),
}), { virtual: true });

// Mock pear-wrk-wdk
jest.mock('pear-wrk-wdk', () => ({
  HRPC: jest.fn().mockImplementation(() => ({
    workletStart: jest.fn(),
    initializeWDK: jest.fn(),
    generateEntropyAndEncrypt: jest.fn(),
    getMnemonicFromEntropy: jest.fn(),
    getSeedAndEntropyFromMnemonic: jest.fn(),
  })),
  bundle: {},
}), { virtual: true });

// Note: React mock is not needed in setup.ts since it's only required for tests that use zustand stores
// Those tests will mock React locally to avoid issues with module resolution

