/**
 * Validation utilities for WDK provider props and inputs
 * 
 * These functions throw errors for invalid inputs.
 * For type guards (boolean returns), see typeGuards.ts
 */

import type { NetworkConfigs, TokenConfigs } from '../types'
import { 
  isNetworkConfig, 
  isNetworkConfigs, 
  isTokenConfig, 
  isTokenConfigs,
  isValidAccountIndex,
  isValidNetworkName,
  isValidBalanceString,
  isEthereumAddress
} from './typeGuards'

/**
 * Validate network configuration
 */
export function validateNetworkConfigs(networkConfigs: NetworkConfigs): void {
  if (!isNetworkConfigs(networkConfigs)) {
    throw new Error('networkConfigs must be a valid NetworkConfigs object')
  }
}

/**
 * Validate token configuration
 */
export function validateTokenConfigs(tokenConfigs: TokenConfigs): void {
  if (!isTokenConfigs(tokenConfigs)) {
    throw new Error('tokenConfigs must be a valid TokenConfigs object')
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
    if (!Number.isFinite(interval)) {
      throw new Error('balanceRefreshInterval must be a finite number')
    }
  }
}

/**
 * Validate that an object has required methods
 * 
 * @param obj - Object to validate
 * @param requiredMethods - Array of required method names
 * @param objectName - Name of the object for error messages
 */
export function validateRequiredMethods(
  obj: unknown,
  requiredMethods: string[],
  objectName: string
): void {
  if (!obj || typeof obj !== 'object') {
    throw new Error(`${objectName} must be an object`)
  }

  for (const methodName of requiredMethods) {
    if (typeof (obj as Record<string, unknown>)[methodName] !== 'function') {
      throw new Error(`${objectName} must have a ${methodName} method`)
    }
  }
}

/**
 * Validate account index
 */
export function validateAccountIndex(accountIndex: number): void {
  if (!isValidAccountIndex(accountIndex)) {
    throw new Error('accountIndex must be a non-negative integer')
  }
}

/**
 * Validate network name
 */
export function validateNetworkName(network: string): void {
  if (!isValidNetworkName(network)) {
    throw new Error('network must be a non-empty string containing only alphanumeric characters, hyphens, and underscores')
  }
}

/**
 * Validate token address (can be null for native tokens)
 */
export function validateTokenAddress(tokenAddress: string | null): void {
  if (tokenAddress !== null && !isEthereumAddress(tokenAddress)) {
    throw new Error('tokenAddress must be a valid Ethereum address format (0x followed by 40 hex characters) or null')
  }
}

/**
 * Validate balance string
 */
export function validateBalance(balance: string): void {
  if (!isValidBalanceString(balance)) {
    throw new Error('balance must be a valid number string')
  }
}

