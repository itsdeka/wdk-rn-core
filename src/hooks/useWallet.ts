import { useCallback, useMemo } from 'react'

import { AccountService } from '../services/accountService'
import { AddressService } from '../services/addressService'
import { BalanceService } from '../services/balanceService'
import { getWalletStore } from '../store/walletStore'
import { getWorkletStore } from '../store/workletStore'
import type { WalletStore } from '../store/walletStore'
import type { WorkletStore } from '../store/workletStore'

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
 *   callAccountMethod,
 *   isLoadingAddress,
 *   isInitialized
 * } = useWallet()
 * 
 * useEffect(() => {
 *   if (isInitialized) {
 *     getAddress('ethereum', 0).then(console.log)
 *     const balance = getBalance(0, 'ethereum', null)
 *     // Call account methods
 *     callAccountMethod('ethereum', 0, 'signMessage', { message: 'Hello' })
 *       .then(console.log)
 *   }
 * }, [isInitialized])
 * ```
 */
export interface UseWalletResult {
  // State (reactive)
  addresses: WalletStore['addresses']
  walletLoading: WalletStore['walletLoading']
  isInitialized: boolean
  balances: WalletStore['balances']
  balanceLoading: WalletStore['balanceLoading']
  lastBalanceUpdate: WalletStore['lastBalanceUpdate']
  // Computed helpers
  getNetworkAddresses: (network: string) => Record<number, string>
  isLoadingAddress: (network: string, accountIndex?: number) => boolean
  // Actions
  getAddress: (network: string, accountIndex?: number) => Promise<string>
  callAccountMethod: <T = unknown>(
    network: string,
    accountIndex: number,
    methodName: string,
    args?: unknown
  ) => Promise<T>
  // Balance management
  updateBalance: (accountIndex: number, network: string, tokenAddress: string | null, balance: string) => void
  getBalance: (accountIndex: number, network: string, tokenAddress: string | null) => string | null
  getBalancesForWallet: (accountIndex: number, network: string) => Record<string, string> | null
  setBalanceLoading: (network: string, accountIndex: number, tokenAddress: string | null, loading: boolean) => void
  isBalanceLoading: (network: string, accountIndex: number, tokenAddress: string | null) => boolean
  updateLastBalanceUpdate: (network: string, accountIndex: number) => void
  getLastBalanceUpdate: (network: string, accountIndex: number) => number | null
  clearBalances: () => void
}

export function useWallet(): UseWalletResult {
  const workletStore = getWorkletStore()
  const walletStore = getWalletStore()

  // Subscribe to state changes using Zustand selectors with shallow equality
  // Using specific selectors to minimize re-renders
  const addresses = walletStore((state: WalletStore) => state.addresses)
  const walletLoading = walletStore((state: WalletStore) => state.walletLoading)
  const isInitialized = workletStore((state: WorkletStore) => state.isInitialized)
  const balances = walletStore((state: WalletStore) => state.balances)
  const balanceLoading = walletStore((state: WalletStore) => state.balanceLoading)
  const lastBalanceUpdate = walletStore((state: WalletStore) => state.lastBalanceUpdate)

  // Get all addresses for a specific network (memoized)
  const getNetworkAddresses = useCallback((network: string) => {
    return addresses[network] || {}
  }, [addresses])

  // Check if an address is loading (memoized)
  const isLoadingAddress = useCallback((network: string, accountIndex: number = 0) => {
    return walletLoading[`${network}-${accountIndex}`] || false
  }, [walletLoading])

  // Get a specific address (from cache or fetch) - memoized
  const getAddress = useCallback(async (network: string, accountIndex: number = 0) => {
    return AddressService.getAddress(network, accountIndex)
  }, [])

  // Call a method on a wallet account - memoized
  const callAccountMethod = useCallback(async <T = unknown>(
    network: string,
    accountIndex: number,
    methodName: string,
    args?: unknown
  ): Promise<T> => {
    return AccountService.callAccountMethod<T>(network, accountIndex, methodName, args)
  }, [])

  // Balance management methods - memoized
  const updateBalance = useCallback((accountIndex: number, network: string, tokenAddress: string | null, balance: string) => {
    BalanceService.updateBalance(accountIndex, network, tokenAddress, balance)
  }, [])

  const getBalance = useCallback((accountIndex: number, network: string, tokenAddress: string | null) => {
    return BalanceService.getBalance(accountIndex, network, tokenAddress)
  }, [])

  const getBalancesForWallet = useCallback((accountIndex: number, network: string) => {
    return BalanceService.getBalancesForWallet(accountIndex, network)
  }, [])

  const setBalanceLoading = useCallback((network: string, accountIndex: number, tokenAddress: string | null, loading: boolean) => {
    BalanceService.setBalanceLoading(network, accountIndex, tokenAddress, loading)
  }, [])

  const isBalanceLoading = useCallback((network: string, accountIndex: number, tokenAddress: string | null) => {
    return BalanceService.isBalanceLoading(network, accountIndex, tokenAddress)
  }, [])

  const updateLastBalanceUpdate = useCallback((network: string, accountIndex: number) => {
    BalanceService.updateLastBalanceUpdate(network, accountIndex)
  }, [])

  const getLastBalanceUpdate = useCallback((network: string, accountIndex: number) => {
    return BalanceService.getLastBalanceUpdate(network, accountIndex)
  }, [])

  const clearBalances = useCallback(() => {
    BalanceService.clearBalances()
  }, [])

  // All callbacks are already memoized, so we can return the object directly
  // The object reference will only change when dependencies actually change
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

