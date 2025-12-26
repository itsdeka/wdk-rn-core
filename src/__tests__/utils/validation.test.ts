/**
 * Tests for validation utilities
 */

import { validateNetworkConfigs, validateTokenConfigs, validateBalanceRefreshInterval } from '../../utils/validation'
import type { NetworkConfigs, TokenConfigs } from '../../types'

describe('validateNetworkConfigs', () => {
  it('should accept valid network configs', () => {
    const configs: NetworkConfigs = {
      ethereum: {
        chainId: 1,
        blockchain: 'ethereum',
      },
    }
    expect(() => validateNetworkConfigs(configs)).not.toThrow()
  })

  it('should reject non-object configs', () => {
    expect(() => validateNetworkConfigs(null as unknown as NetworkConfigs)).toThrow('networkConfigs must be an object')
    expect(() => validateNetworkConfigs('invalid' as unknown as NetworkConfigs)).toThrow('networkConfigs must be an object')
  })

  it('should reject empty configs', () => {
    expect(() => validateNetworkConfigs({})).toThrow('networkConfigs must contain at least one network')
  })

  it('should reject invalid chainId', () => {
    const configs: NetworkConfigs = {
      ethereum: {
        chainId: -1,
        blockchain: 'ethereum',
      },
    }
    expect(() => validateNetworkConfigs(configs)).toThrow('Invalid chainId')
  })

  it('should reject missing blockchain', () => {
    const configs = {
      ethereum: {
        chainId: 1,
        // Missing blockchain property
      },
    } as unknown as NetworkConfigs
    expect(() => validateNetworkConfigs(configs)).toThrow('Invalid blockchain')
  })

})

describe('validateTokenConfigs', () => {
  it('should accept valid token configs', () => {
    const configs: TokenConfigs = {
      ethereum: {
        native: {
          address: null,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 18,
        },
        tokens: [],
      },
    }
    expect(() => validateTokenConfigs(configs)).not.toThrow()
  })

  it('should reject non-object configs', () => {
    expect(() => validateTokenConfigs(null as unknown as TokenConfigs)).toThrow('tokenConfigs must be an object')
  })

  it('should reject empty configs', () => {
    expect(() => validateTokenConfigs({})).toThrow('tokenConfigs must contain at least one network')
  })

  it('should reject invalid native token', () => {
    const configs: TokenConfigs = {
      ethereum: {
        native: {
          address: null,
          symbol: '',
          name: 'Ethereum',
          decimals: 18,
        },
        tokens: [],
      },
    }
    expect(() => validateTokenConfigs(configs)).toThrow('Invalid native token symbol')
  })

  it('should reject invalid decimals', () => {
    const configs: TokenConfigs = {
      ethereum: {
        native: {
          address: null,
          symbol: 'ETH',
          name: 'Ethereum',
          decimals: 20,
        },
        tokens: [],
      },
    }
    expect(() => validateTokenConfigs(configs)).toThrow('Invalid native token decimals')
  })
})

describe('validateBalanceRefreshInterval', () => {
  it('should accept valid intervals', () => {
    expect(() => validateBalanceRefreshInterval(30000)).not.toThrow()
    expect(() => validateBalanceRefreshInterval(0)).not.toThrow()
    expect(() => validateBalanceRefreshInterval(undefined)).not.toThrow()
  })

  it('should reject negative intervals', () => {
    expect(() => validateBalanceRefreshInterval(-1)).toThrow('balanceRefreshInterval must be a non-negative number')
  })

  it('should reject non-number intervals', () => {
    expect(() => validateBalanceRefreshInterval('invalid' as unknown as number)).toThrow('balanceRefreshInterval must be a number')
  })
})

