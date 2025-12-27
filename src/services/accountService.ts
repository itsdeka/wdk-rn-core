/**
 * Account Service
 * 
 * Handles account method calls through the worklet.
 * This service provides a generic interface for calling account methods
 * like getBalance, getTokenBalance, signMessage, signTransaction, etc.
 */

// Local imports
import { getWorkletStore } from '../store/workletStore'
import { logError } from '../utils/logger'
import { normalizeError } from '../utils/errorUtils'
import { isValidNetworkName, isValidAccountIndex } from '../utils/typeGuards'

/**
 * Allowed method names for account operations
 * This whitelist prevents calling arbitrary methods and improves security
 */
export const ALLOWED_ACCOUNT_METHODS = [
  'getAddress',
  'getBalance',
  'getTokenBalance',
  'signMessage',
  'signTransaction',
  'sendTransaction',
] as const

export type AllowedMethodName = typeof ALLOWED_ACCOUNT_METHODS[number]

/**
 * Account Service
 * 
 * Provides methods for calling account operations through the worklet.
 */
export class AccountService {
  /**
   * Call a method on a wallet account
   * Generic method for calling any account method through the worklet
   * 
   * @param network - Network name
   * @param accountIndex - Account index
   * @param methodName - Method name (must be in ALLOWED_ACCOUNT_METHODS whitelist)
   * @param args - Optional arguments for the method
   * @returns Promise with the method result
   * @throws Error if methodName is not in the allowed list or if validation fails
   * 
   * @example
   * ```typescript
   * // Get balance
   * const balance = await AccountService.callAccountMethod('ethereum', 0, 'getBalance', null)
   * 
   * // Get token balance
   * const tokenBalance = await AccountService.callAccountMethod(
   *   'ethereum', 
   *   0, 
   *   'getTokenBalance', 
   *   '0x...'
   * )
   * 
   * // Sign a message
   * const signature = await AccountService.callAccountMethod(
   *   'ethereum',
   *   0,
   *   'signMessage',
   *   { message: 'Hello World' }
   * )
   * ```
   */
  static async callAccountMethod<T = unknown>(
    network: string,
    accountIndex: number,
    methodName: string,
    args?: unknown
  ): Promise<T> {
    // Validate methodName parameter
    if (typeof methodName !== 'string' || methodName.trim().length === 0) {
      throw new Error('methodName must be a non-empty string')
    }

    // Validate methodName is in the allowed list
    if (!ALLOWED_ACCOUNT_METHODS.includes(methodName as AllowedMethodName)) {
      throw new Error(
        `Method ${methodName} is not allowed. Allowed methods: ${ALLOWED_ACCOUNT_METHODS.join(', ')}`
      )
    }

    // Runtime validation using type guards
    if (!isValidNetworkName(network)) {
      throw new Error('network must be a valid network name (non-empty string with alphanumeric characters, hyphens, and underscores)')
    }
    if (!isValidAccountIndex(accountIndex)) {
      throw new Error('accountIndex must be a non-negative integer')
    }

    const workletStore = getWorkletStore()
    const workletState = workletStore.getState()
    
    if (!workletState.isInitialized || !workletState.hrpc) {
      throw new Error('WDK not initialized')
    }

    try {
      // Get fresh state to ensure hrpc is still available
      const currentWorkletState = workletStore.getState()
      if (!currentWorkletState.hrpc) {
        throw new Error('HRPC instance not available')
      }

      const response = await currentWorkletState.hrpc.callMethod({
        methodName,
        network,
        accountIndex,
        args: args ? JSON.stringify(args) : null,
      })

      if (!response.result) {
        throw new Error(`Method ${methodName} returned no result`)
      }

      // Parse the result and handle BigInt values
      let parsed: T
      try {
        parsed = JSON.parse(response.result) as T
        // Basic validation: ensure parsed is not null/undefined
        if (parsed === null || parsed === undefined) {
          throw new Error('Parsed result is null or undefined')
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('Parsed result is null')) {
          throw error
        }
        throw new Error(`Failed to parse result from ${methodName}: ${error instanceof Error ? error.message : String(error)}`)
      }
      
      // Recursively convert BigInt values to strings to prevent serialization errors
      const convertBigIntToString = (value: unknown): unknown => {
        if (typeof value === 'bigint') {
          return value.toString()
        }
        if (Array.isArray(value)) {
          return value.map(convertBigIntToString)
        }
        if (value && typeof value === 'object') {
          return Object.fromEntries(
            Object.entries(value).map(([key, val]) => [key, convertBigIntToString(val)])
          )
        }
        return value
      }
      
      return convertBigIntToString(parsed) as T
    } catch (error) {
      const normalizedError = normalizeError(error, false, {
        component: 'AccountService',
        operation: `callAccountMethod:${methodName}`
      })
      logError(`[AccountService] Failed to call ${methodName} on ${network}:${accountIndex}:`, normalizedError)
      throw normalizedError
    }
  }
}

