// React hooks
import { useState, useCallback } from 'react'

// Internal modules
import type { SecureStorage } from '@tetherto/wdk-rn-secure-storage'

// Local imports
import { WalletSetupService } from '../services/walletSetupService'
import type { NetworkConfigs } from '../types'
import { logError } from '../utils/logger'

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
 *   networkConfigs
 * )
 * 
 * // Create new wallet
 * await initializeWallet({ createNew: true })
 * 
 * // Load existing wallet (requires biometric authentication)
 * await initializeWallet({ createNew: false })
 * ```
 */
export function useWalletSetup(
  secureStorage: SecureStorage,
  networkConfigs: NetworkConfigs
) {
  const [isInitializing, setIsInitializing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Initialize wallet - either create new or load existing
   */
  const initializeWallet = useCallback(
    async (options: { createNew?: boolean } = {}) => {
      setIsInitializing(true)
      setError(null)

      try {
        await WalletSetupService.initializeWallet(
          secureStorage,
          networkConfigs,
          options
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
    [secureStorage, networkConfigs]
  )

  /**
   * Check if wallet exists
   */
  const hasWallet = useCallback(async (): Promise<boolean> => {
    return WalletSetupService.hasWallet(secureStorage)
  }, [secureStorage])

  /**
   * Initialize wallet from mnemonic seedphrase
   */
  const initializeFromMnemonic = useCallback(
    async (mnemonic: string) => {
      setIsInitializing(true)
      setError(null)

      try {
        await WalletSetupService.initializeFromMnemonic(
          secureStorage,
          networkConfigs,
          mnemonic
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
    [secureStorage, networkConfigs]
  )

  /**
   * Delete wallet
   */
  const deleteWallet = useCallback(async () => {
    setIsInitializing(true)
    setError(null)

      try {
        await WalletSetupService.deleteWallet(secureStorage)
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : String(err)
      logError('Failed to delete wallet:', err)
      setError(errorMessage)
      throw err
    } finally {
      setIsInitializing(false)
    }
  }, [secureStorage])

  return {
    initializeWallet,
    initializeFromMnemonic,
    hasWallet,
    deleteWallet,
    isInitializing,
    error,
  }
}

