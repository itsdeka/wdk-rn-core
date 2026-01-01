/**
 * Account Service
 * 
 * Handles account method calls through the worklet.
 * This service provides a generic interface for calling account methods
 * like getBalance, getTokenBalance, signMessage, signTransaction, etc.
 */

import { convertBigIntToString } from '../utils/balanceUtils'
import { handleServiceError } from '../utils/errorHandling'
import { requireInitialized } from '../utils/storeHelpers'
import { validateAccountIndex, validateNetworkName } from '../utils/validation'

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
   * @param methodName - Method name
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

    // Validate inputs
    validateNetworkName(network)
    validateAccountIndex(accountIndex)

    // Require initialized worklet
    const hrpc = requireInitialized()

    try {
      const response = await hrpc.callMethod({
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
      return convertBigIntToString(parsed) as T
    } catch (error) {
      handleServiceError(error, 'AccountService', `callAccountMethod:${methodName}`, {
        network,
        accountIndex,
        methodName,
      })
    }
  }
}

