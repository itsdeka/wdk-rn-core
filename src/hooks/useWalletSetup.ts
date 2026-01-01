import { useCallback, useMemo, useState } from 'react'

import { WalletSetupService } from '../services/walletSetupService'
import { logError } from '../utils/logger'
import type { NetworkConfigs } from '../types'

/**
 * Hook for wallet initialization and lifecycle management
 * 
 * PURPOSE: Use this hook ONLY for wallet setup/auth flows (creating new wallets,
 * loading existing wallets, checking if wallet exists, deleting wallets).
 * 
 * For wallet operations AFTER initialization (getting addresses, calling account methods),
 * use the `useWallet()` hook instead.
 * 
 * @example
 * ```tsx
 * const secureStorage = createSecureStorage()
 * const networkConfigs = { ethereum: { chainId: 1, blockchain: 'ethereum' } }
 * 
 * const { initializeWallet, hasWallet, deleteWallet, isInitializing, error } = useWalletSetup(
 *   secureStorage,
 *   networkConfigs,
 *   'user@example.com' // optional identifier
 * )
 * 
 * // Create new wallet
 * await initializeWallet({ createNew: true })
 * 
 * // Load existing wallet (requires biometric authentication)
 * await initializeWallet({ createNew: false })
 * 
 * // Delete wallet for specific identifier
 * await deleteWallet('user@example.com')
 * ```
 */
export interface UseWalletSetupResult {
  initializeWallet: (options?: { createNew?: boolean; identifier?: string }) => Promise<void>
  initializeFromMnemonic: (mnemonic: string, walletIdentifier?: string) => Promise<void>
  hasWallet: (walletIdentifier?: string) => Promise<boolean>
  deleteWallet: (walletIdentifier?: string) => Promise<void>
  isInitializing: boolean
  error: string | null
}

export function useWalletSetup(
  networkConfigs: NetworkConfigs,
  identifier?: string
): UseWalletSetupResult {
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initialize wallet - either create new or load existing
   * 
   * @param options - Wallet initialization options
   * @param options.createNew - If true, creates a new wallet; if false, loads existing wallet
   * @param options.identifier - Optional identifier override (defaults to hook's identifier)
   */
  const initializeWallet = useCallback(
    async (options: { createNew?: boolean; identifier?: string } = {}) => {
      setIsInitializing(true)
      setError(null)

      try {
        await WalletSetupService.initializeWallet(
          networkConfigs,
          {
            ...options,
            identifier: options.identifier ?? identifier,
          }
        )
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err)
        logError('Failed to initialize wallet:', err)
        setError(errorMessage)
        throw err
      } finally {
        setIsInitializing(false)
      }
    },
    [networkConfigs, identifier]
  )

  /**
   * Check if wallet exists
   * 
   * @param walletIdentifier - Optional identifier override (defaults to hook's identifier)
   * @returns Promise resolving to true if wallet exists, false otherwise
   */
  const hasWallet = useCallback(
    async (walletIdentifier?: string): Promise<boolean> => {
      return WalletSetupService.hasWallet(walletIdentifier ?? identifier)
    },
    [identifier]
  )

  /**
   * Initialize wallet from mnemonic seedphrase
   * 
   * @param mnemonic - Mnemonic phrase to import
   * @param walletIdentifier - Optional identifier override (defaults to hook's identifier)
   */
  const initializeFromMnemonic = useCallback(
    async (mnemonic: string, walletIdentifier?: string) => {
      setIsInitializing(true)
      setError(null)

      try {
        await WalletSetupService.initializeFromMnemonic(
          networkConfigs,
          mnemonic,
          walletIdentifier ?? identifier
        )
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err)
        logError('Failed to initialize wallet from mnemonic:', err)
        setError(errorMessage)
        throw err
      } finally {
        setIsInitializing(false)
      }
    },
    [networkConfigs, identifier]
  )

  /**
   * Delete wallet
   * 
   * @param walletIdentifier - Optional identifier override (defaults to hook's identifier)
   *                          If not provided, deletes the default wallet
   */
  const deleteWallet = useCallback(
    async (walletIdentifier?: string) => {
      setIsInitializing(true)
      setError(null)

      try {
        await WalletSetupService.deleteWallet(walletIdentifier ?? identifier)
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : String(err)
        logError('Failed to delete wallet:', err)
        setError(errorMessage)
        throw err
      } finally {
        setIsInitializing(false)
      }
    },
    [identifier]
  )

  // Memoize return object to prevent unnecessary re-renders
  return useMemo(
    () => ({
      initializeWallet,
      initializeFromMnemonic,
      hasWallet,
      deleteWallet,
      isInitializing,
      error,
    }),
    [initializeWallet, initializeFromMnemonic, hasWallet, deleteWallet, isInitializing, error]
  )
}

