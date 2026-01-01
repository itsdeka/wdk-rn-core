import { useEffect, useState } from 'react'

import { WalletSetupService } from '../services/walletSetupService'
import { logError } from '../utils/logger'

export interface UseMnemonicReturn {
  mnemonic: string | null
  isLoading: boolean
  error: Error | null
}

/**
 * Hook for retrieving mnemonic phrase from wallet
 * Only requires the user identifier (email) - handles secureStorage internally
 * 
 * @param identifier - Optional identifier for multi-wallet support (typically user email)
 * @returns Object with mnemonic, loading state, and error state
 * 
 * @example
 * ```tsx
 * const { mnemonic, isLoading, error } = useMnemonic(userEmail)
 * 
 * if (isLoading) return <Loading />
 * if (error) return <Error message={error.message} />
 * if (mnemonic) return <MnemonicDisplay words={mnemonic.split(' ')} />
 * ```
 */
export function useMnemonic(identifier?: string): UseMnemonicReturn {
  const [mnemonic, setMnemonic] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    const fetchMnemonic = async () => {
      if (!identifier) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // secureStorage is optional and will be created internally if not provided
        const result = await WalletSetupService.getMnemonic(identifier)
        setMnemonic(result)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        logError('Failed to fetch mnemonic:', err)
        setError(error)
        setMnemonic(null)
      } finally {
        setIsLoading(false)
      }
    }

    fetchMnemonic()
  }, [identifier])

  return { mnemonic, isLoading, error }
}

