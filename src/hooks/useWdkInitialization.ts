/**
 * Hook for managing WDK initialization flow
 * 
 * Handles:
 * - Worklet startup
 * - Wallet existence checking
 * - Wallet initialization (new or existing)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { SecureStorage } from '@tetherto/wdk-rn-secure-storage'
import { AuthenticationError } from '@tetherto/wdk-rn-secure-storage'
import type { NetworkConfigs } from '../types'
import { useWorklet } from './useWorklet'
import { useWalletSetup } from './useWalletSetup'
import { useWallet } from './useWallet'
import { normalizeError } from '../utils/errorUtils'
import { log, logError } from '../utils/logger'

export interface UseWdkInitializationResult {
  /** Whether wallet exists in secure storage (null = checking) */
  walletExists: boolean | null
  /** Whether initialization is in progress */
  isInitializing: boolean
  /** Initialization error if any */
  error: Error | null
  /** Retry initialization after an error */
  retry: () => void
  /** Whether worklet is started */
  isWorkletStarted: boolean
  /** Whether wallet is initialized */
  walletInitialized: boolean
}

export function useWdkInitialization(
  secureStorage: SecureStorage,
  networkConfigs: NetworkConfigs,
  abortController: AbortController | null,
  identifier?: string
): UseWdkInitializationResult {
  const [hasWalletChecked, setHasWalletChecked] = useState(false)
  const [walletExists, setWalletExists] = useState<boolean | null>(null)
  const [initializationError, setInitializationError] = useState<Error | null>(null)
  const [walletInitError, setWalletInitError] = useState<Error | null>(null)

  const hasAttemptedWorkletInitialization = useRef(false)
  const hasAttemptedWalletInitialization = useRef(false)
  // Track operation IDs to prevent race conditions
  const walletInitOperationId = useRef(0)
  const isMountedRef = useRef(true)
  // Track if authentication error occurred to prevent automatic retries
  const authenticationErrorOccurredRef = useRef(false)

  const {
    isWorkletStarted,
    isInitialized: isWorkletInitialized,
    isLoading: isWorkletLoading,
    startWorklet,
  } = useWorklet()

  const {
    initializeWallet,
    hasWallet,
    isInitializing: isWalletInitializing,
  } = useWalletSetup(networkConfigs, identifier)

  const { isInitialized: walletInitialized } = useWallet()

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Initialize worklet immediately when component mounts
  useEffect(() => {
    if (isWorkletInitialized || isWorkletLoading || hasAttemptedWorkletInitialization.current) {
      return
    }

    if (abortController?.signal.aborted) {
      return
    }

    const initializeWorklet = async () => {
      if (abortController?.signal.aborted) {
        return
      }

      try {
        log('[useWdkInitialization] Starting worklet initialization...')
        setInitializationError(null)
        hasAttemptedWorkletInitialization.current = true

        await startWorklet(networkConfigs)
        
        if (abortController?.signal.aborted) {
          return
        }
        
        log('[useWdkInitialization] Worklet started successfully')
      } catch (error) {
        if (abortController?.signal.aborted) {
          return
        }
        
        const err = normalizeError(error, true, { 
          component: 'useWdkInitialization', 
          operation: 'workletInitialization' 
        })
        logError('[useWdkInitialization] Failed to initialize worklet:', error)
        setInitializationError(err)
      }
    }

    initializeWorklet()
  }, [isWorkletInitialized, isWorkletLoading, networkConfigs, startWorklet, abortController])

  // Check if wallet exists when worklet is started
  useEffect(() => {
    if (!isWorkletStarted || hasWalletChecked) {
      return
    }

    let cancelled = false

    const checkWallet = async () => {
      try {
        log('[useWdkInitialization] Checking if wallet exists...')
        const walletExistsResult = await hasWallet(identifier)
        log('[useWdkInitialization] Wallet check result:', walletExistsResult)
        if (!cancelled) {
          setHasWalletChecked(true)
          setWalletExists(walletExistsResult)
        }
      } catch (error) {
        logError('[useWdkInitialization] Failed to check wallet:', error)
        if (!cancelled) {
          setHasWalletChecked(true)
          setWalletExists(false)
        }
      }
    }

    checkWallet()

    return () => {
      cancelled = true
    }
  }, [isWorkletStarted, hasWalletChecked, hasWallet, identifier])

  // Shared wallet initialization logic
  const performWalletInitialization = useCallback(async (signal?: AbortSignal, operationId?: number) => {
    if (signal?.aborted) {
      throw new Error('Wallet initialization cancelled')
    }

    // Check if this operation is still current
    if (operationId !== undefined && operationId !== walletInitOperationId.current) {
      throw new Error('Wallet initialization superseded by newer operation')
    }

    try {
      log('[useWdkInitialization] Starting wallet initialization...')
      if (isMountedRef.current) {
        setWalletInitError(null)
      }

      if (walletExists) {
        log('[useWdkInitialization] Loading existing wallet from secure storage...')
        await initializeWallet({ createNew: false, identifier })

        // read mnemonic
        
        if (signal?.aborted || (operationId !== undefined && operationId !== walletInitOperationId.current)) {
          throw new Error('Wallet initialization cancelled')
        }
        
        if (isMountedRef.current) {
          log('[useWdkInitialization] Existing wallet loaded successfully')
        }
      } else {
        log('[useWdkInitialization] Creating new wallet...')
        await initializeWallet({ createNew: true, identifier })
        
        if (signal?.aborted || (operationId !== undefined && operationId !== walletInitOperationId.current)) {
          throw new Error('Wallet initialization cancelled')
        }
        
        if (isMountedRef.current) {
          log('[useWdkInitialization] New wallet created successfully')
        }
      }

      if (isMountedRef.current) {
        log('[useWdkInitialization] Wallet initialized successfully')
      }
    } catch (error) {
      if (signal?.aborted || (operationId !== undefined && operationId !== walletInitOperationId.current)) {
        throw error
      }
      
      // Check if this is an AuthenticationError to prevent automatic retries
      const isAuthenticationError = 
        error instanceof AuthenticationError ||
        (error instanceof Error && error.name === 'AuthenticationError') ||
        (error instanceof Error && (
          error.message.toLowerCase().includes('authentication') ||
          error.message.toLowerCase().includes('biometric') ||
          error.message.toLowerCase().includes('authentication required but failed')
        ))
      
      if (isAuthenticationError) {
        log('[useWdkInitialization] Authentication error detected - preventing automatic retry')
        authenticationErrorOccurredRef.current = true
      }
      
      const err = normalizeError(error, true, { 
        component: 'useWdkInitialization', 
        operation: 'walletInitialization' 
      })
      logError('[useWdkInitialization] Failed to initialize wallet:', error)
      if (isMountedRef.current) {
        setWalletInitError(err)
      }
      throw err
    }
  }, [walletExists, initializeWallet, identifier])

  // Initialize wallet when worklet is started and wallet check is complete
  useEffect(() => {
    if (!hasWalletChecked || !isWorkletStarted) {
      return
    }

    // Don't initialize if wallet is already initialized
    if (walletInitialized) {
      return
    }

    // Don't automatically retry if authentication error occurred - wait for user to click retry
    // This check must be early and persistent to prevent any automatic retries
    if (authenticationErrorOccurredRef.current) {
      log('[useWdkInitialization] Skipping automatic initialization due to authentication error - waiting for user retry')
      return
    }

    // Don't attempt if already attempting or currently initializing
    if (hasAttemptedWalletInitialization.current || isWalletInitializing) {
      return
    }

    if (abortController?.signal.aborted) {
      return
    }

    // Generate new operation ID for this initialization attempt
    const currentOperationId = ++walletInitOperationId.current
    hasAttemptedWalletInitialization.current = true

    const initializeWalletFlow = async () => {
      if (abortController?.signal.aborted || !isMountedRef.current) {
        return
      }

      // Verify this operation is still current
      if (currentOperationId !== walletInitOperationId.current) {
        log('[useWdkInitialization] Initialization superseded by newer operation')
        return
      }
      
      try {
        await performWalletInitialization(abortController?.signal, currentOperationId)
      } catch (error) {
        // Check if this is an authentication error - if so, don't reset flags to prevent retry
        // Check both the original error and normalized error properties
        const isAuthenticationError = 
          error instanceof AuthenticationError ||
          (error instanceof Error && (
            error.name === 'AuthenticationError' ||
            error.message.toLowerCase().includes('authentication') ||
            error.message.toLowerCase().includes('biometric') ||
            error.message.toLowerCase().includes('authentication required but failed')
          ))
        
        if (isAuthenticationError) {
          log('[useWdkInitialization] Authentication error in initializeWalletFlow - keeping flags set to prevent retry')
          // Ensure the flag is set (in case it wasn't set in performWalletInitialization)
          authenticationErrorOccurredRef.current = true
          // Ensure error is set in state (it should already be set in performWalletInitialization, but ensure it)
          if (isMountedRef.current && error instanceof Error) {
            const err = normalizeError(error, true, { 
              component: 'useWdkInitialization', 
              operation: 'walletInitialization' 
            })
            setWalletInitError(err)
          }
          // Keep hasAttemptedWalletInitialization.current = true to prevent automatic retry
          return // Exit early, don't reset any flags
        }
        
        // Only reset flag if this operation was cancelled or superseded AND it's not an auth error
        if (abortController?.signal.aborted || currentOperationId !== walletInitOperationId.current) {
          // Only reset if no newer operation has started
          if (currentOperationId === walletInitOperationId.current) {
            hasAttemptedWalletInitialization.current = false
          }
        }
      }
    }

    initializeWalletFlow()
    
    return () => {
      // Only cancel if this is still the current operation
      if (currentOperationId === walletInitOperationId.current) {
        // Don't reset flags if authentication error occurred - we want to prevent automatic retry
        if (!authenticationErrorOccurredRef.current) {
          // Increment operation ID to invalidate this operation
          walletInitOperationId.current++
          if (abortController && !abortController.signal.aborted) {
            abortController.abort()
          }
          hasAttemptedWalletInitialization.current = false
        }
      }
    }
  }, [
    hasWalletChecked,
    walletExists,
    isWorkletStarted,
    isWalletInitializing,
    walletInitialized,
    performWalletInitialization,
    abortController,
  ])

  const retry = useCallback(async () => {
    if (!isMountedRef.current) {
      return
    }

    log('[useWdkInitialization] Retrying initialization...')
    setWalletInitError(null)
    setInitializationError(null)
    
    // Reset authentication error flag to allow retry
    authenticationErrorOccurredRef.current = false
    
    // Generate new operation ID for retry
    const retryOperationId = ++walletInitOperationId.current
    hasAttemptedWalletInitialization.current = false

    if (!hasWalletChecked || !isWorkletStarted) {
      log('[useWdkInitialization] Cannot retry: prerequisite conditions not met')
      return
    }

    if (abortController?.signal.aborted) {
      return
    }

    hasAttemptedWalletInitialization.current = true

    try {
      log('[useWdkInitialization] Retrying wallet initialization...')
      await performWalletInitialization(abortController?.signal, retryOperationId)
    } catch (error) {
      // Only reset flag if this operation was cancelled or superseded
      if (abortController?.signal.aborted || retryOperationId !== walletInitOperationId.current) {
        if (retryOperationId === walletInitOperationId.current) {
          hasAttemptedWalletInitialization.current = false
        }
      }
    }
  }, [hasWalletChecked, isWorkletStarted, performWalletInitialization, abortController])

  const isInitializing = isWorkletLoading || isWalletInitializing || (!hasWalletChecked && isWorkletStarted)

  return {
    walletExists,
    isInitializing,
    error: walletInitError || initializationError,
    retry,
    isWorkletStarted,
    walletInitialized,
  }
}
