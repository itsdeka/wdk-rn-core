/**
 * Tests for type guard utilities
 */

import {
  isNetworkConfig,
  isNetworkConfigs,
  isTokenConfig,
  isTokenConfigs,
  isWalletAddresses,
  isWalletBalances,
  isEthereumAddress,
  isValidAccountIndex,
  isValidNetworkName,
  isValidBalanceString,
} from '../../utils/typeGuards'
import type { NetworkConfig, NetworkConfigs, TokenConfig, TokenConfigs } from '../../types'

describe('typeGuards', () => {
  describe('isNetworkConfig', () => {
    it('should return true for valid network config', () => {
      const valid: NetworkConfig = {
        chainId: 1,
        blockchain: 'ethereum',
      }
      expect(isNetworkConfig(valid)).toBe(true)
    })

    it('should return false for invalid network config', () => {
      expect(isNetworkConfig(null)).toBe(false)
      expect(isNetworkConfig({})).toBe(false)
      expect(isNetworkConfig({ chainId: '1', blockchain: 'ethereum' })).toBe(false)
      expect(isNetworkConfig({ chainId: 1 })).toBe(false)
      expect(isNetworkConfig({ blockchain: 'ethereum' })).toBe(false)
    })
  })

  describe('isNetworkConfigs', () => {
    it('should return true for valid network configs', () => {
      const valid: NetworkConfigs = {
        ethereum: {
          chainId: 1,
          blockchain: 'ethereum',
        },
      }
      expect(isNetworkConfigs(valid)).toBe(true)
    })

    it('should return false for invalid network configs', () => {
      expect(isNetworkConfigs(null)).toBe(false)
      expect(isNetworkConfigs({})).toBe(false)
      expect(isNetworkConfigs([])).toBe(false)
      expect(isNetworkConfigs({ ethereum: null })).toBe(false)
    })
  })

  describe('isTokenConfig', () => {
    it('should return true for valid token config', () => {
      const valid: TokenConfig = {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        address: null,
      }
      expect(isTokenConfig(valid)).toBe(true)

      const validWithAddress: TokenConfig = {
        symbol: 'USDT',
        name: 'Tether',
        decimals: 6,
        address: '0x1234567890123456789012345678901234567890',
      }
      expect(isTokenConfig(validWithAddress)).toBe(true)
    })

    it('should return false for invalid token config', () => {
      expect(isTokenConfig(null)).toBe(false)
      expect(isTokenConfig({})).toBe(false)
      expect(isTokenConfig({ symbol: 'ETH' })).toBe(false)
      expect(isTokenConfig({ symbol: 'ETH', name: 'Ethereum', decimals: '18' })).toBe(false)
    })
  })

  describe('isTokenConfigs', () => {
    it('should return true for valid token configs', () => {
      const valid: TokenConfigs = {
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
      expect(isTokenConfigs(valid)).toBe(true)
    })

    it('should return false for invalid token configs', () => {
      expect(isTokenConfigs(null)).toBe(false)
      expect(isTokenConfigs({})).toBe(false)
      expect(isTokenConfigs([])).toBe(false)
    })
  })

  describe('isWalletAddresses', () => {
    it('should return true for valid wallet addresses', () => {
      const valid = {
        ethereum: {
          0: '0x1234567890123456789012345678901234567890',
          1: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
        },
      }
      expect(isWalletAddresses(valid)).toBe(true)
    })

    it('should return false for invalid wallet addresses', () => {
      expect(isWalletAddresses(null)).toBe(false)
      expect(isWalletAddresses({})).toBe(true) // Empty object is valid
      expect(isWalletAddresses([])).toBe(false)
      expect(isWalletAddresses({ ethereum: 'invalid' })).toBe(false)
      expect(isWalletAddresses({ ethereum: { 0: 'invalid' } })).toBe(false)
    })
  })

  describe('isWalletBalances', () => {
    it('should return true for valid wallet balances', () => {
      const valid = {
        ethereum: {
          0: {
            '0x0000000000000000000000000000000000000000': '1000000000000000000',
            '0x1234567890123456789012345678901234567890': '2000000000000000000',
          },
        },
      }
      expect(isWalletBalances(valid)).toBe(true)
    })

    it('should return false for invalid wallet balances', () => {
      expect(isWalletBalances(null)).toBe(false)
      expect(isWalletBalances({})).toBe(true) // Empty object is valid
      expect(isWalletBalances([])).toBe(false)
      expect(isWalletBalances({ ethereum: { 0: 'invalid' } })).toBe(false)
    })
  })

  describe('isEthereumAddress', () => {
    it('should return true for valid Ethereum addresses', () => {
      expect(isEthereumAddress('0x1234567890123456789012345678901234567890')).toBe(true)
      expect(isEthereumAddress('0xABCDEFabcdef1234567890123456789012345678')).toBe(true)
    })

    it('should return false for invalid Ethereum addresses', () => {
      expect(isEthereumAddress('')).toBe(false)
      expect(isEthereumAddress('0x123')).toBe(false)
      expect(isEthereumAddress('1234567890123456789012345678901234567890')).toBe(false)
      expect(isEthereumAddress(null)).toBe(false)
      expect(isEthereumAddress(123)).toBe(false)
    })
  })

  describe('isValidAccountIndex', () => {
    it('should return true for valid account indices', () => {
      expect(isValidAccountIndex(0)).toBe(true)
      expect(isValidAccountIndex(1)).toBe(true)
      expect(isValidAccountIndex(100)).toBe(true)
    })

    it('should return false for invalid account indices', () => {
      expect(isValidAccountIndex(-1)).toBe(false)
      expect(isValidAccountIndex(1.5)).toBe(false)
      expect(isValidAccountIndex(NaN)).toBe(false)
      expect(isValidAccountIndex(Infinity)).toBe(false)
    })
  })

  describe('isValidNetworkName', () => {
    it('should return true for valid network names', () => {
      expect(isValidNetworkName('ethereum')).toBe(true)
      expect(isValidNetworkName('polygon-mainnet')).toBe(true)
      expect(isValidNetworkName('network_1')).toBe(true)
    })

    it('should return false for invalid network names', () => {
      expect(isValidNetworkName('')).toBe(false)
      expect(isValidNetworkName('  ')).toBe(false)
      expect(isValidNetworkName('network with spaces')).toBe(false)
      expect(isValidNetworkName('network@invalid')).toBe(false)
    })
  })

  describe('isValidBalanceString', () => {
    it('should return true for valid balance strings', () => {
      expect(isValidBalanceString('0')).toBe(true)
      expect(isValidBalanceString('100')).toBe(true)
      expect(isValidBalanceString('100.5')).toBe(true)
      expect(isValidBalanceString('-100')).toBe(true)
    })

    it('should return false for invalid balance strings', () => {
      expect(isValidBalanceString('')).toBe(false)
      expect(isValidBalanceString('abc')).toBe(false)
      expect(isValidBalanceString('100.5.5')).toBe(false)
      expect(isValidBalanceString('100a')).toBe(false)
    })
  })
})

