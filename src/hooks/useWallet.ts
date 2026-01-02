import { useCallback } from 'react'
import { useShallow } from 'zustand/react/shallow'

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

  // Subscribe to state changes using consolidated selectors to minimize re-renders
  // Use useShallow to prevent infinite loops when selector returns new object
  // useShallow is a hook and must be called at the top level (not inside useMemo)
  const walletSelector = useShallow((state: WalletStore) => ({
    addresses: state.addresses,
    walletLoading: state.walletLoading,
    balances: state.balances,
    balanceLoading: state.balanceLoading,
    lastBalanceUpdate: state.lastBalanceUpdate,
  }))
  const walletState = walletStore(walletSelector)
  const isInitialized = workletStore((state: WorkletStore) => state.isInitialized)

  // Get all addresses for a specific network
  const getNetworkAddresses = (network: string) => {
    return walletState.addresses[network] || {}
  }

  // Check if an address is loading
  const isLoadingAddress = (network: string, accountIndex: number = 0) => {
    return walletState.walletLoading[`${network}-${accountIndex}`] || false
  }

  // Get a specific address (from cache or fetch)
  // Wrapped in useCallback to ensure stable function reference across renders
  const getAddress = useCallback(async (network: string, accountIndex: number = 0) => {
    return AddressService.getAddress(network, accountIndex)
  }, [])

  // Call a method on a wallet account
  // Wrapped in useCallback to ensure stable function reference across renders
  const callAccountMethod = useCallback(async <T = unknown>(
    network: string,
    accountIndex: number,
    methodName: string,
    args?: unknown
  ): Promise<T> => {
    return AccountService.callAccountMethod<T>(network, accountIndex, methodName, args)
  }, [])

  // Balance management methods - direct calls to static service methods
  const updateBalance = (accountIndex: number, network: string, tokenAddress: string | null, balance: string) => {
    BalanceService.updateBalance(accountIndex, network, tokenAddress, balance)
  }

  const getBalance = (accountIndex: number, network: string, tokenAddress: string | null) => {
    return BalanceService.getBalance(accountIndex, network, tokenAddress)
  }

  const getBalancesForWallet = (accountIndex: number, network: string) => {
    return BalanceService.getBalancesForWallet(accountIndex, network)
  }

  const setBalanceLoading = (network: string, accountIndex: number, tokenAddress: string | null, loading: boolean) => {
    BalanceService.setBalanceLoading(network, accountIndex, tokenAddress, loading)
  }

  const isBalanceLoading = (network: string, accountIndex: number, tokenAddress: string | null) => {
    return BalanceService.isBalanceLoading(network, accountIndex, tokenAddress)
  }

  const updateLastBalanceUpdate = (network: string, accountIndex: number) => {
    BalanceService.updateLastBalanceUpdate(network, accountIndex)
  }

  const getLastBalanceUpdate = (network: string, accountIndex: number) => {
    return BalanceService.getLastBalanceUpdate(network, accountIndex)
  }

  const clearBalances = () => {
    BalanceService.clearBalances()
  }
  return {
    // State (reactive)
    addresses: walletState.addresses,
    walletLoading: walletState.walletLoading,
    isInitialized,
    balances: walletState.balances,
    balanceLoading: walletState.balanceLoading,
    lastBalanceUpdate: walletState.lastBalanceUpdate,
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

