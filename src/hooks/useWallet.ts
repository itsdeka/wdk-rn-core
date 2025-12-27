// React hooks
import { useCallback } from 'react'

// Local imports
import { getWorkletStore } from '../store/workletStore'
import { getWalletStore } from '../store/walletStore'
import { AddressService } from '../services/addressService'
import { BalanceService } from '../services/balanceService'
import type { WorkletStore } from '../store/workletStore'
import type { WalletStore } from '../store/walletStore'

/**
 * Hook to interact with wallet data (addresses, balances, accounts)
 * 
 * PURPOSE: Use this hook for wallet operations AFTER the wallet has been initialized.
 * This hook provides access to wallet addresses, balances, account methods, and wallet state.
 * 
 * For wallet initialization/setup (creating, loading, deleting wallets), use
 * the `useWalletSetup()` hook instead.
 * 
 * @example
 * ```tsx
 * const { 
 *   addresses, 
 *   balances,
 *   getAddress, 
 *   getBalance,
 *   isLoadingAddress,
 *   isInitialized
 * } = useWallet()
 * 
 * useEffect(() => {
 *   if (isInitialized) {
 *     getAddress('ethereum', 0).then(console.log)
 *     const balance = getBalance(0, 'ethereum', null)
 *   }
 * }, [isInitialized])
 * ```
 */
export function useWallet() {
  const workletStore = getWorkletStore()
  const walletStore = getWalletStore()

  // Subscribe to state changes using Zustand selectors
  const addresses = walletStore((state: WalletStore) => state.addresses)
  const walletLoading = walletStore((state: WalletStore) => state.walletLoading)
  const isInitialized = workletStore((state: WorkletStore) => state.isInitialized)
  const balances = walletStore((state: WalletStore) => state.balances)
  const balanceLoading = walletStore((state: WalletStore) => state.balanceLoading)
  const lastBalanceUpdate = walletStore((state: WalletStore) => state.lastBalanceUpdate)

  // Get all addresses for a specific network
  const getNetworkAddresses = useCallback(
    (network: string) => {
      return addresses[network] || {}
    },
    [addresses]
  )

  // Check if an address is loading
  const isLoadingAddress = useCallback(
    (network: string, accountIndex: number = 0) => {
      return walletLoading[`${network}-${accountIndex}`] || false
    },
    [walletLoading]
  )

  // Get a specific address (from cache or fetch)
  const getAddress = useCallback(
    async (network: string, accountIndex: number = 0) => {
      // Validation is handled by AddressService
      return AddressService.getAddress(network, accountIndex)
    },
    []
  )

  // Call a method on a wallet account
  const callAccountMethod = useCallback(
    async <T = unknown>(
      network: string,
      accountIndex: number,
      methodName: string,
      args?: unknown
    ): Promise<T> => {
      return AddressService.callAccountMethod<T>(network, accountIndex, methodName, args)
    },
    []
  )

  // Balance management methods
  const updateBalance = useCallback(
    (accountIndex: number, network: string, tokenAddress: string | null, balance: string) => {
      // Validation should be handled by BalanceService if needed
      BalanceService.updateBalance(accountIndex, network, tokenAddress, balance)
    },
    []
  )

  const getBalance = useCallback(
    (accountIndex: number, network: string, tokenAddress: string | null) => {
      // No validation needed - service handles it
      return BalanceService.getBalance(accountIndex, network, tokenAddress)
    },
    []
  )

  const getBalancesForWallet = useCallback(
    (accountIndex: number, network: string) => {
      return BalanceService.getBalancesForWallet(accountIndex, network)
    },
    []
  )

  const setBalanceLoading = useCallback(
    (network: string, accountIndex: number, tokenAddress: string | null, loading: boolean) => {
      BalanceService.setBalanceLoading(network, accountIndex, tokenAddress, loading)
    },
    []
  )

  const isBalanceLoading = useCallback(
    (network: string, accountIndex: number, tokenAddress: string | null) => {
      return BalanceService.isBalanceLoading(network, accountIndex, tokenAddress)
    },
    []
  )

  const updateLastBalanceUpdate = useCallback(
    (network: string, accountIndex: number) => {
      BalanceService.updateLastBalanceUpdate(network, accountIndex)
    },
    []
  )

  const getLastBalanceUpdate = useCallback(
    (network: string, accountIndex: number) => {
      return BalanceService.getLastBalanceUpdate(network, accountIndex)
    },
    []
  )

  const clearBalances = useCallback(() => {
    BalanceService.clearBalances()
  }, [])

  return {
    // State (reactive)
    addresses,
    walletLoading,
    isInitialized,
    balances,
    balanceLoading,
    lastBalanceUpdate,
    // Computed helpers
    getNetworkAddresses,
    isLoadingAddress,
    // Actions
    getAddress,
    callAccountMethod,
    // Balance management
    updateBalance,
    getBalance,
    getBalancesForWallet,
    setBalanceLoading,
    isBalanceLoading,
    updateLastBalanceUpdate,
    getLastBalanceUpdate,
    clearBalances,
  }
}

