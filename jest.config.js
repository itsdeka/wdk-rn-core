module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        diagnostics: {
          ignoreCodes: [151002], // Ignore "Could not find a declaration file" warnings
        },
      },
    ],
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/__tests__/**',
    '!src/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 50,
      lines: 50,
      statements: 50,
    },
  },
  moduleNameMapper: {
    '^@tetherto/wdk-rn-secure-storage$': '<rootDir>/src/__mocks__/secureStorage.ts',
  },
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  // Ignore React Native modules if not available
  modulePathIgnorePatterns: ['<rootDir>/node_modules/'],
  // Allow tests to run without all dependencies
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-mmkv|react-native-bare-kit|pear-wrk-wdk)/)',
  ],
};

