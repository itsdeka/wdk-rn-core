/**
 * Validation utilities for WDK provider props and inputs
 */

import type { NetworkConfigs, TokenConfigs } from '../types'

/**
 * Validate network configuration
 */
export function validateNetworkConfigs(networkConfigs: NetworkConfigs): void {
  if (!networkConfigs || typeof networkConfigs !== 'object') {
    throw new Error('networkConfigs must be an object')
  }

  if (Object.keys(networkConfigs).length === 0) {
    throw new Error('networkConfigs must contain at least one network')
  }

  for (const [networkName, config] of Object.entries(networkConfigs)) {
    if (!config || typeof config !== 'object') {
      throw new Error(`Invalid network config for ${networkName}: must be an object`)
    }

    if (typeof config.chainId !== 'number' || config.chainId <= 0) {
      throw new Error(`Invalid chainId for ${networkName}: must be a positive number`)
    }

    if (!config.blockchain || typeof config.blockchain !== 'string') {
      throw new Error(`Invalid blockchain for ${networkName}: must be a non-empty string`)
    }
  }
}

/**
 * Validate token configuration
 */
export function validateTokenConfigs(tokenConfigs: TokenConfigs): void {
  if (!tokenConfigs || typeof tokenConfigs !== 'object') {
    throw new Error('tokenConfigs must be an object')
  }

  if (Object.keys(tokenConfigs).length === 0) {
    throw new Error('tokenConfigs must contain at least one network')
  }

  for (const [networkName, networkTokens] of Object.entries(tokenConfigs)) {
    if (!networkTokens || typeof networkTokens !== 'object') {
      throw new Error(`Invalid token config for ${networkName}: must be an object`)
    }

    if (!networkTokens.native || typeof networkTokens.native !== 'object') {
      throw new Error(`Invalid native token config for ${networkName}: must be an object`)
    }

    const { native } = networkTokens

    if (typeof native.symbol !== 'string' || native.symbol.length === 0) {
      throw new Error(`Invalid native token symbol for ${networkName}: must be a non-empty string`)
    }

    if (typeof native.name !== 'string' || native.name.length === 0) {
      throw new Error(`Invalid native token name for ${networkName}: must be a non-empty string`)
    }

    if (typeof native.decimals !== 'number' || native.decimals < 0 || native.decimals > 18) {
      throw new Error(`Invalid native token decimals for ${networkName}: must be a number between 0 and 18`)
    }

    if (native.address !== null && typeof native.address !== 'string') {
      throw new Error(`Invalid native token address for ${networkName}: must be null or a string`)
    }

    if (!Array.isArray(networkTokens.tokens)) {
      throw new Error(`Invalid tokens array for ${networkName}: must be an array`)
    }

    for (const token of networkTokens.tokens) {
      if (!token || typeof token !== 'object') {
        throw new Error(`Invalid token config in ${networkName}: must be an object`)
      }

      if (typeof token.symbol !== 'string' || token.symbol.length === 0) {
        throw new Error(`Invalid token symbol in ${networkName}: must be a non-empty string`)
      }

      if (typeof token.name !== 'string' || token.name.length === 0) {
        throw new Error(`Invalid token name in ${networkName}: must be a non-empty string`)
      }

      if (typeof token.decimals !== 'number' || token.decimals < 0 || token.decimals > 18) {
        throw new Error(`Invalid token decimals in ${networkName}: must be a number between 0 and 18`)
      }

      if (token.address !== null && (typeof token.address !== 'string' || token.address.length === 0)) {
        throw new Error(`Invalid token address in ${networkName}: must be null or a non-empty string`)
      }
    }
  }
}

/**
 * Validate balance refresh interval
 */
export function validateBalanceRefreshInterval(interval: number | undefined): void {
  if (interval !== undefined) {
    if (typeof interval !== 'number') {
      throw new Error('balanceRefreshInterval must be a number')
    }
    if (interval < 0) {
      throw new Error('balanceRefreshInterval must be a non-negative number')
    }
  }
}

