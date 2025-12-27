/**
 * Balance Service
 * 
 * Handles balance operations: getting, setting, updating, and managing balance state.
 * This service is focused solely on balance management.
 */

// Local imports
import { getWalletStore } from '../store/walletStore'
import { validateAccountIndex, validateNetworkName, validateTokenAddress, validateBalance } from '../utils/validation'

/**
 * Balance Service
 * 
 * Provides methods for managing wallet balances.
 */
export class BalanceService {
  /**
   * Update balance for a specific wallet, network, and token
   */
  static updateBalance(
    accountIndex: number,
    network: string,
    tokenAddress: string | null,
    balance: string
  ): void {
    // Validate inputs
    validateAccountIndex(accountIndex)
    validateNetworkName(network)
    validateTokenAddress(tokenAddress)
    validateBalance(balance)

    const walletStore = getWalletStore()
    const tokenKey = tokenAddress || 'native'
    
    walletStore.setState((prev) => ({
      balances: {
        ...prev.balances,
        [network]: {
          ...(prev.balances[network] || {}),
          [accountIndex]: {
            ...(prev.balances[network]?.[accountIndex] || {}),
            [tokenKey]: balance,
          },
        },
      },
    }))
  }

  /**
   * Get balance for a specific wallet, network, and token
   */
  static getBalance(
    accountIndex: number,
    network: string,
    tokenAddress: string | null
  ): string | null {
    // Validate inputs
    validateAccountIndex(accountIndex)
    validateNetworkName(network)
    validateTokenAddress(tokenAddress)

    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    const tokenKey = tokenAddress || 'native'
    
    return walletState.balances[network]?.[accountIndex]?.[tokenKey] || null
  }

  /**
   * Get all balances for a specific wallet and network
   */
  static getBalancesForWallet(
    accountIndex: number,
    network: string
  ): Record<string, string> | null {
    // Validate inputs
    validateAccountIndex(accountIndex)
    validateNetworkName(network)

    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    
    return walletState.balances[network]?.[accountIndex] || null
  }

  /**
   * Set balance loading state
   */
  static setBalanceLoading(
    network: string,
    accountIndex: number,
    tokenAddress: string | null,
    loading: boolean
  ): void {
    // Validate inputs
    validateAccountIndex(accountIndex)
    validateNetworkName(network)
    validateTokenAddress(tokenAddress)

    const walletStore = getWalletStore()
    const tokenKey = tokenAddress || 'native'
    const loadingKey = `${network}-${accountIndex}-${tokenKey}`
    
    walletStore.setState((prev) => {
      if (loading) {
        return {
          balanceLoading: {
            ...prev.balanceLoading,
            [loadingKey]: true,
          },
        }
      } else {
        const { [loadingKey]: _, ...rest } = prev.balanceLoading
        return {
          balanceLoading: rest,
        }
      }
    })
  }

  /**
   * Check if balance is loading
   */
  static isBalanceLoading(
    network: string,
    accountIndex: number,
    tokenAddress: string | null
  ): boolean {
    // Validate inputs
    validateAccountIndex(accountIndex)
    validateNetworkName(network)
    validateTokenAddress(tokenAddress)

    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    const tokenKey = tokenAddress || 'native'
    const loadingKey = `${network}-${accountIndex}-${tokenKey}`
    
    return walletState.balanceLoading[loadingKey] || false
  }

  /**
   * Update last balance update timestamp
   */
  static updateLastBalanceUpdate(
    network: string,
    accountIndex: number
  ): void {
    // Validate inputs
    validateAccountIndex(accountIndex)
    validateNetworkName(network)

    const walletStore = getWalletStore()
    const now = Date.now()
    
    walletStore.setState((prev) => ({
      lastBalanceUpdate: {
        ...prev.lastBalanceUpdate,
        [network]: {
          ...(prev.lastBalanceUpdate[network] || {}),
          [accountIndex]: now,
        },
      },
    }))
  }

  /**
   * Get last balance update timestamp
   */
  static getLastBalanceUpdate(
    network: string,
    accountIndex: number
  ): number | null {
    // Validate inputs
    validateAccountIndex(accountIndex)
    validateNetworkName(network)

    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    
    return walletState.lastBalanceUpdate[network]?.[accountIndex] || null
  }

  /**
   * Clear all balances (useful for wallet reset)
   */
  static clearBalances(): void {
    const walletStore = getWalletStore()
    
    walletStore.setState({
      balances: {},
      balanceLoading: {},
      lastBalanceUpdate: {},
    })
  }
}


