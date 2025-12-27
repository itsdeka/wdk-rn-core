/**
 * Address Service
 * 
 * Handles address retrieval and caching operations.
 * This service is focused solely on address management.
 */

// Local imports
import { getWorkletStore } from '../store/workletStore'
import { getWalletStore } from '../store/walletStore'
import { logError } from '../utils/logger'
import { normalizeError } from '../utils/errorUtils'
import { isValidNetworkName, isValidAccountIndex, isValidAddress } from '../utils/typeGuards'

/**
 * Allowed method names for account operations
 * This whitelist prevents calling arbitrary methods and improves security
 */
const ALLOWED_ACCOUNT_METHODS = [
  'getAddress',
  'getBalance',
  'getTokenBalance',
  'signMessage',
  'signTransaction',
  'sendTransaction',
] as const

type AllowedMethodName = typeof ALLOWED_ACCOUNT_METHODS[number]

/**
 * Address Service
 * 
 * Provides methods for retrieving and caching wallet addresses.
 */
export class AddressService {
  /**
   * Get address for a specific network and account index
   * Caches the address in walletStore for future use
   */
  static async getAddress(
    network: string,
    accountIndex = 0
  ): Promise<string> {
    // Runtime validation using type guards
    if (!isValidNetworkName(network)) {
      throw new Error('network must be a valid network name (non-empty string with alphanumeric characters, hyphens, and underscores)')
    }
    if (!isValidAccountIndex(accountIndex)) {
      throw new Error('accountIndex must be a non-negative integer')
    }

    const workletStore = getWorkletStore()
    const walletStore = getWalletStore()
    const workletState = workletStore.getState()
    const walletState = walletStore.getState()

    const cachedAddress = walletState.addresses[network]?.[accountIndex]
    if (cachedAddress) {
      // Validate cached address format
      if (!isValidAddress(cachedAddress)) {
        throw new Error(`Cached address for ${network}:${accountIndex} has invalid format`)
      }
      return cachedAddress
    }

    if (!workletState.isInitialized || !workletState.hrpc) {
      throw new Error('WDK not initialized')
    }

    const loadingKey = `${network}-${accountIndex}`
    
    try {
      walletStore.setState((prev) => ({
        walletLoading: { ...prev.walletLoading, [loadingKey]: true },
      }))

      // Get fresh state to ensure hrpc is still available
      const currentWorkletState = workletStore.getState()
      if (!currentWorkletState.hrpc) {
        throw new Error('HRPC instance not available')
      }

      // Call getAddress method on the account
      const response = await currentWorkletState.hrpc.callMethod({
        methodName: 'getAddress',
        network,
        accountIndex,
        args: null,
      })

      if (!response.result) {
        throw new Error('Failed to get address from worklet')
      }

      let address: string
      try {
        const parsed = JSON.parse(response.result)
        if (typeof parsed !== 'string') {
          throw new Error('Address must be a string')
        }
        // Runtime validation of address format
        if (!isValidAddress(parsed)) {
          throw new Error(`Address from worklet has invalid format: ${parsed}`)
        }
        address = parsed
      } catch (error) {
        throw new Error(`Failed to parse address from worklet response: ${error instanceof Error ? error.message : String(error)}`)
      }

      // Cache the address
      walletStore.setState((prev) => ({
        addresses: {
          ...prev.addresses,
          [network]: {
            ...(prev.addresses[network] || {}),
            [accountIndex]: address,
          },
        },
        walletLoading: { ...prev.walletLoading, [loadingKey]: false },
      }))

      return address
    } catch (error) {
      walletStore.setState((prev) => ({
        walletLoading: { ...prev.walletLoading, [loadingKey]: false },
      }))
      const normalizedError = normalizeError(error, false, { 
        component: 'AddressService', 
        operation: 'getAddress'
      })
      logError('[AddressService] Failed to get address:', normalizedError)
      throw normalizedError
    }
  }

  /**
   * Call a method on a wallet account
   * Generic method for calling any account method through the worklet
   * 
   * @param network - Network name
   * @param accountIndex - Account index
   * @param methodName - Method name (must be in ALLOWED_ACCOUNT_METHODS whitelist)
   * @param args - Optional arguments for the method
   * @throws Error if methodName is not in the allowed list or if validation fails
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
        component: 'AddressService',
        operation: `callAccountMethod:${methodName}`
      })
      logError(`[AddressService] Failed to call ${methodName} on ${network}:${accountIndex}:`, normalizedError)
      throw normalizedError
    }
  }
}

