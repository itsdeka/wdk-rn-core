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
}

