/**
 * useSeedPhrase Hook
 * 
 * Extracted logic for fetching and managing seed phrase display.
 * Handles mnemonic retrieval from worklet using cached encryption key
 * or falling back to secureStorage with biometric authentication.
 */

import { useState, useCallback, useEffect } from 'react'
import { Clipboard } from 'react-native'
import { createLogger } from '@/utils/logger'
import { useMnemonic, WalletSetupService } from '@tetherto/wdk-rn-core'
import { useCurrentUser } from '@/queries/auth'

const logger = createLogger('useSeedPhrase')

export interface UseSeedPhraseReturn {
  /** Array of mnemonic words */
  words: string[]
  /** Whether seed phrase is revealed */
  isRevealed: boolean
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: Error | null
  /** Toggle reveal/hide */
  handleRevealPress: () => void
  /** Copy seed phrase to clipboard */
  handleCopyPress: () => Promise<void>
  /** Handle continue action */
  handleContinue: () => void
}

/**
 * Hook for managing seed phrase display
 * 
 * @param onContinue - Optional callback when continue is pressed, receives seed phrase string
 * @returns Seed phrase state and handlers
 */
export function useSeedPhrase(
  onContinue?: (seedPhrase: string) => void
): UseSeedPhraseReturn {
  const { data: currentUser } = useCurrentUser()
  const [isRevealed, setIsRevealed] = useState(false)
  const [words, setWords] = useState<string[]>([])
  
  // Use the new useMnemonic hook from wdk-rn-core
  const { mnemonic, isLoading: mnemonicLoading, error: mnemonicError } = useMnemonic(currentUser?.email)

  // Update local state based on mnemonic hook results
  useEffect(() => {
    if (mnemonic) {
      const mnemonicWords = mnemonic.trim().split(/\s+/).filter((word: string) => word.length > 0)
      
      if (mnemonicWords.length === 0) {
        logger.error('[useSeedPhrase] Invalid mnemonic: no words found')
        return
      }

      setWords(mnemonicWords)
      logger.info('[useSeedPhrase] Mnemonic fetched successfully', { wordCount: mnemonicWords.length })
    } else if (mnemonicError) {
      logger.error('[useSeedPhrase] Failed to fetch mnemonic', mnemonicError)
    } else if (!mnemonicLoading && !mnemonic) {
      // If not loading and no mnemonic, it means it wasn't found
      logger.warn('[useSeedPhrase] Mnemonic not found')
    }
  }, [mnemonic, mnemonicLoading, mnemonicError])

  // Derive isLoading and error from mnemonic hook
  const isLoading = mnemonicLoading
  const error = mnemonicError || (!mnemonicLoading && !mnemonic && currentUser?.email ? new Error('Mnemonic not found') : null)

  const handleRevealPress = useCallback(() => {
    setIsRevealed((prev) => !prev)
  }, [])

  const handleCopyPress = useCallback(async () => {
    if (words.length === 0) return

    try {
      await Clipboard.setString(words.join(' '))
      logger.info('[useSeedPhrase] Copied to clipboard')
    } catch (error) {
      logger.error('[useSeedPhrase] Failed to copy', error)
    }
  }, [words])

  const handleContinue = useCallback(() => {
    // Don't allow continue if loading, error, or no words
    if (isLoading || error || words.length === 0) {
      logger.warn('[useSeedPhrase] Continue blocked', { isLoading, hasError: !!error, wordCount: words.length })
      return
    }

    logger.info('[useSeedPhrase] Continue pressed')
    const seedPhrase = words.join(' ')
    
    if (onContinue) {
      onContinue(seedPhrase)
    }
  }, [words, isLoading, error, onContinue])

  return {
    words,
    isRevealed,
    isLoading,
    error,
    handleRevealPress,
    handleCopyPress,
    handleContinue,
  }
}

/**
 * Retrieve mnemonic phrase from wallet
 * Convenience function that handles getting entropy and encryption key internally
 * 
 * @param userEmail - Optional user email identifier for multi-wallet support
 *                    If not provided, will need to be obtained from current user context
 * @returns Promise<string> - The mnemonic phrase as a space-separated string
 * @throws Error if user email not available, credentials not found, or decryption fails
 */
export async function getMnemonicPhrase(userEmail?: string): Promise<string> {
  if (!userEmail) {
    throw new Error('User email is required to retrieve mnemonic phrase')
  }

  logger.info('[getMnemonicPhrase] Fetching mnemonic from worklet...')
  
  // Use WalletSetupService.getMnemonic which handles all the internal logic
  // secureStorage is optional and will be created internally if not provided
  const mnemonic = await WalletSetupService.getMnemonic(userEmail)
  
  if (!mnemonic) {
    throw new Error('Mnemonic not found')
  }

  // Return trimmed mnemonic string
  const trimmedMnemonic = mnemonic.trim()
  
  if (!trimmedMnemonic) {
    throw new Error('Invalid mnemonic: empty result')
  }

  logger.info('[getMnemonicPhrase] Mnemonic retrieved successfully')
  return trimmedMnemonic
}

/**
 * Retrieve mnemonic words array from wallet
 * Convenience function that handles getting entropy and encryption key internally
 * 
 * @param userEmail - Optional user email identifier for multi-wallet support
 *                    If not provided, will need to be obtained from current user context
 * @returns Promise<string[]> - The mnemonic phrase as an array of words
 * @throws Error if user email not available, credentials not found, or decryption fails
 */
export async function getMnemonicWords(userEmail?: string): Promise<string[]> {
  const mnemonic = await getMnemonicPhrase(userEmail)
  const words = mnemonic.split(/\s+/).filter(word => word.length > 0)
  
  if (words.length === 0) {
    throw new Error('Invalid mnemonic: no words found')
  }
  
  return words
}

