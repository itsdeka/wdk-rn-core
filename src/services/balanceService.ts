/**
 * Balance Service
 * 
 * Handles balance operations: getting, setting, updating, and managing balance state.
 * This service is focused solely on balance management.
 */

import { getWalletStore } from '../store/walletStore'
import { updateBalanceInState } from '../utils/storeHelpers'
import { validateBalance, validateWalletParams } from '../utils/validation'

// Constants
const NATIVE_TOKEN_KEY = 'native'

/**
 * Balance Service
 * 
 * Provides methods for managing wallet balances.
 */
export class BalanceService {
  /**
   * Validate wallet parameters and balance (if provided)
   * Helper to reduce repetitive validation calls
   */
  private static validateBalanceParams(
    network: string,
    accountIndex: number,
    tokenAddress?: string | null,
    balance?: string
  ): void {
    validateWalletParams(network, accountIndex, tokenAddress)
    if (balance !== undefined) {
      validateBalance(balance)
    }
  }

  /**
   * Get token key from token address (native or token address)
   */
  private static getTokenKey(tokenAddress: string | null): string {
    return tokenAddress || NATIVE_TOKEN_KEY
  }
  /**
   * Update balance for a specific wallet, network, and token
   */
  static updateBalance(
    accountIndex: number,
    network: string,
    tokenAddress: string | null,
    balance: string
  ): void {
    this.validateBalanceParams(network, accountIndex, tokenAddress, balance)

    const walletStore = getWalletStore()
    const tokenKey = this.getTokenKey(tokenAddress)
    
    walletStore.setState((prev) => ({
      ...updateBalanceInState(prev, network, accountIndex, tokenKey, balance),
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
    this.validateBalanceParams(network, accountIndex, tokenAddress)

    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    const tokenKey = this.getTokenKey(tokenAddress)
    
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
    validateWalletParams(network, accountIndex)

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
    this.validateBalanceParams(network, accountIndex, tokenAddress)

    const walletStore = getWalletStore()
    const tokenKey = this.getTokenKey(tokenAddress)
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
    this.validateBalanceParams(network, accountIndex, tokenAddress)

    const walletStore = getWalletStore()
    const walletState = walletStore.getState()
    const tokenKey = this.getTokenKey(tokenAddress)
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
    validateWalletParams(network, accountIndex)

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
    validateWalletParams(network, accountIndex)

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


