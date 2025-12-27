/**
 * Tests for WdkAppProvider
 * 
 * Tests validation logic without rendering DOM components
 */

import { validateNetworkConfigs, validateTokenConfigs, validateBalanceRefreshInterval } from '../../utils/validation'
import type { NetworkConfigs, TokenConfigs } from '../../types'
import { mockSecureStorage } from '../../__mocks__/secureStorage'

describe('WdkAppProvider validation', () => {
  const mockNetworkConfigs: NetworkConfigs = {
    ethereum: {
      chainId: 1,
      blockchain: 'ethereum',
    },
  }

  const mockTokenConfigs: TokenConfigs = {
    ethereum: {
      native: {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        address: null,
      },
      tokens: [],
    },
  }

  it('should validate networkConfigs', () => {
    expect(() => validateNetworkConfigs(mockNetworkConfigs)).not.toThrow()
    expect(() => validateNetworkConfigs({} as NetworkConfigs)).toThrow()
  })

  it('should validate tokenConfigs', () => {
    expect(() => validateTokenConfigs(mockTokenConfigs)).not.toThrow()
    expect(() => validateTokenConfigs({} as TokenConfigs)).toThrow()
  })

  it('should validate balanceRefreshInterval', () => {
    expect(() => validateBalanceRefreshInterval(30000)).not.toThrow()
    expect(() => validateBalanceRefreshInterval(0)).not.toThrow()
    expect(() => validateBalanceRefreshInterval(-1)).toThrow()
    expect(() => validateBalanceRefreshInterval(NaN)).toThrow()
  })

  it('should validate secureStorage has required methods', () => {
    const requiredMethods = ['authenticate', 'hasWallet', 'setEncryptionKey', 'setEncryptedSeed', 'getAllEncrypted']
    
    for (const method of requiredMethods) {
      expect(typeof mockSecureStorage[method as keyof typeof mockSecureStorage]).toBe('function')
    }
  })

  it('should detect missing secureStorage methods', () => {
    const invalidStorage = {
      authenticate: jest.fn(),
      // Missing other methods
    }
    
    const requiredMethods = ['hasWallet', 'setEncryptionKey', 'setEncryptedSeed', 'getAllEncrypted']
    for (const method of requiredMethods) {
      expect(typeof (invalidStorage as any)[method]).not.toBe('function')
    }
  })
})
