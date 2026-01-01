/**
 * Runtime Type Guards
 * 
 * Provides runtime type checking for critical data paths to ensure type safety
 * beyond TypeScript's compile-time checks.
 */

import type {
  NetworkConfig,
  NetworkConfigs,
  TokenConfig,
  TokenConfigs,
  WalletAddresses,
  WalletBalances,
} from '../types'

/**
 * Type guard to check if a value is a valid NetworkConfig
 */
export function isNetworkConfig(value: unknown): value is NetworkConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const config = value as Record<string, unknown>

  // Required fields
  if (typeof config.chainId !== 'number' || config.chainId <= 0 || !Number.isInteger(config.chainId)) {
    return false
  }

  if (typeof config.blockchain !== 'string' || config.blockchain.trim().length === 0) {
    return false
  }

  // Optional fields validation
  if (config.provider !== undefined && (typeof config.provider !== 'string' || config.provider.trim().length === 0)) {
    return false
  }

  if (config.bundlerUrl !== undefined && (typeof config.bundlerUrl !== 'string' || config.bundlerUrl.trim().length === 0)) {
    return false
  }

  if (config.paymasterUrl !== undefined && (typeof config.paymasterUrl !== 'string' || config.paymasterUrl.trim().length === 0)) {
    return false
  }

  if (config.paymasterAddress !== undefined) {
    if (typeof config.paymasterAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(config.paymasterAddress)) {
      return false
    }
  }

  if (config.entryPointAddress !== undefined) {
    if (typeof config.entryPointAddress !== 'string' || !/^0x[a-fA-F0-9]{40}$/.test(config.entryPointAddress)) {
      return false
    }
  }

  if (config.transferMaxFee !== undefined && (typeof config.transferMaxFee !== 'number' || config.transferMaxFee < 0)) {
    return false
  }

  return true
}

/**
 * Type guard to check if a value is a valid NetworkConfigs
 */
export function isNetworkConfigs(value: unknown): value is NetworkConfigs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const configs = value as Record<string, unknown>

  if (Object.keys(configs).length === 0) {
    return false
  }

  for (const [networkName, config] of Object.entries(configs)) {
    // Validate network name format
    if (!networkName || typeof networkName !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(networkName)) {
      return false
    }

    if (!isNetworkConfig(config)) {
      return false
    }
  }

  return true
}

/**
 * Type guard to check if a value is a valid TokenConfig
 */
export function isTokenConfig(value: unknown): value is TokenConfig {
  if (!value || typeof value !== 'object') {
    return false
  }

  const config = value as Record<string, unknown>

  if (typeof config.symbol !== 'string' || config.symbol.length === 0) {
    return false
  }

  if (typeof config.name !== 'string' || config.name.length === 0) {
    return false
  }

  if (typeof config.decimals !== 'number' || config.decimals < 0 || config.decimals > 18 || !Number.isInteger(config.decimals)) {
    return false
  }

  if (config.address !== null) {
    if (typeof config.address !== 'string' || config.address.length === 0) {
      return false
    }
    // Validate Ethereum address format for ERC20 tokens
    if (!/^0x[a-fA-F0-9]{40}$/.test(config.address)) {
      return false
    }
  }

  return true
}

/**
 * Type guard to check if a value is a valid TokenConfigs
 */
export function isTokenConfigs(value: unknown): value is TokenConfigs {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const configs = value as Record<string, unknown>

  if (Object.keys(configs).length === 0) {
    return false
  }

  for (const [networkName, networkTokens] of Object.entries(configs)) {
    if (!networkName || typeof networkName !== 'string') {
      return false
    }

    if (!networkTokens || typeof networkTokens !== 'object' || Array.isArray(networkTokens)) {
      return false
    }

    const tokens = networkTokens as Record<string, unknown>

    // Check native token
    if (!isTokenConfig(tokens.native)) {
      return false
    }

    // Check tokens array
    if (!Array.isArray(tokens.tokens)) {
      return false
    }

    for (const token of tokens.tokens) {
      if (!isTokenConfig(token)) {
        return false
      }
    }
  }

  return true
}

/**
 * Type guard to check if a value is a valid WalletAddresses structure
 */
export function isWalletAddresses(value: unknown): value is WalletAddresses {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const addresses = value as Record<string, unknown>

  for (const [network, networkAddresses] of Object.entries(addresses)) {
    if (typeof network !== 'string') {
      return false
    }

    if (!networkAddresses || typeof networkAddresses !== 'object' || Array.isArray(networkAddresses)) {
      return false
    }

    const addrMap = networkAddresses as Record<string, unknown>

    for (const [accountIndexStr, address] of Object.entries(addrMap)) {
      const accountIndex = parseInt(accountIndexStr, 10)
      if (isNaN(accountIndex) || accountIndex < 0) {
        return false
      }

      if (typeof address !== 'string' || address.length === 0) {
        return false
      }

      // Basic address format check (Ethereum or Spark)
      if (!isValidAddress(address)) {
        return false
      }
    }
  }

  return true
}

/**
 * Type guard to check if a value is a valid WalletBalances structure
 */
export function isWalletBalances(value: unknown): value is WalletBalances {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const balances = value as Record<string, unknown>

  for (const [network, networkBalances] of Object.entries(balances)) {
    if (typeof network !== 'string') {
      return false
    }

    if (!networkBalances || typeof networkBalances !== 'object' || Array.isArray(networkBalances)) {
      return false
    }

    const balanceMap = networkBalances as Record<string, unknown>

    for (const [accountIndexStr, accountBalances] of Object.entries(balanceMap)) {
      const accountIndex = parseInt(accountIndexStr, 10)
      if (isNaN(accountIndex) || accountIndex < 0) {
        return false
      }

      if (!accountBalances || typeof accountBalances !== 'object' || Array.isArray(accountBalances)) {
        return false
      }

      const tokenBalances = accountBalances as Record<string, unknown>

      for (const [tokenAddress, balance] of Object.entries(tokenBalances)) {
        if (typeof tokenAddress !== 'string') {
          return false
        }

        if (typeof balance !== 'string') {
          return false
        }

        // Validate balance is a valid number string
        if (!/^-?\d+(\.\d+)?$/.test(balance)) {
          return false
        }
      }
    }
  }

  return true
}

/**
 * Type guard to check if a value is a valid Ethereum address
 */
export function isEthereumAddress(value: unknown): value is string {
  return typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value)
}

/**
 * Type guard to check if a value is a valid Spark address (Bech32 format)
 * Spark addresses start with "spark1" followed by Bech32-encoded characters
 */
export function isSparkAddress(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  // Spark addresses use Bech32 encoding: spark1 followed by base32 characters
  // Bech32 uses: qpzry9x8gf2tvdw0s3jn54khce6mua7l (lowercase alphanumeric excluding 1, b, i, o)
  // For validation, we'll accept spark1 followed by lowercase alphanumeric characters
  return /^spark1[a-z0-9]+$/.test(value) && value.length >= 14 && value.length <= 90
}

/**
 * Type guard to check if a value is a valid address (Ethereum or Spark format)
 */
export function isValidAddress(value: unknown): value is string {
  return isEthereumAddress(value) || isSparkAddress(value)
}

/**
 * Type guard to check if a value is a valid account index
 */
export function isValidAccountIndex(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/**
 * Type guard to check if a value is a valid network name
 */
export function isValidNetworkName(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && /^[a-zA-Z0-9_-]+$/.test(value)
}

/**
 * Type guard to check if a value is a valid balance string
 */
export function isValidBalanceString(value: unknown): value is string {
  return typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)
}


