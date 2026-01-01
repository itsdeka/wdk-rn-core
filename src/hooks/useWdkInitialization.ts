/**
 * Hook for managing WDK initialization flow
 * 
 * Handles:
 * - Worklet startup
 * - Wallet existence checking
 * - Wallet initialization (new or existing)
 * 
 * Uses a state machine pattern to simplify complex initialization logic
 */

import { useCallback, useEffect, useMemo, useRef, useReducer } from 'react'

import type { SecureStorage } from '@tetherto/wdk-rn-secure-storage'

import { useWallet } from './useWallet'
import { useWalletSetup } from './useWalletSetup'
import { useWorklet } from './useWorklet'
import { isAuthenticationError, normalizeError } from '../utils/errorUtils'
import { log, logError } from '../utils/logger'
import type { NetworkConfigs } from '../types'

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

type InitState =
  | { type: 'idle' }
  | { type: 'starting_worklet' }
  | { type: 'checking_wallet' }
  | { type: 'initializing_wallet'; walletExists: boolean }
  | { type: 'ready' }
  | { type: 'error'; error: Error; isAuthError: boolean }

type InitAction =
  | { type: 'START_WORKLET' }
  | { type: 'WORKLET_STARTED' }
  | { type: 'WORKLET_ERROR'; error: Error }
  | { type: 'CHECK_WALLET' }
  | { type: 'WALLET_CHECKED'; exists: boolean }
  | { type: 'WALLET_CHECK_ERROR' }
  | { type: 'INITIALIZE_WALLET'; walletExists: boolean }
  | { type: 'WALLET_INITIALIZED' }
  | { type: 'WALLET_INIT_ERROR'; error: Error }
  | { type: 'RESET' }
  | { type: 'RETRY' }

interface InitStateContext {
  walletExists: boolean | null
  error: Error | null
}

function initReducer(state: InitState, action: InitAction): InitState {
  switch (action.type) {
    case 'START_WORKLET':
      return state.type === 'idle' ? { type: 'starting_worklet' } : state

    case 'WORKLET_STARTED':
      return { type: 'checking_wallet' }

    case 'WORKLET_ERROR':
      return { type: 'error', error: action.error, isAuthError: false }

    case 'CHECK_WALLET':
      return state.type === 'starting_worklet' || state.type === 'checking_wallet'
        ? { type: 'checking_wallet' }
        : state

    case 'WALLET_CHECKED':
      return { type: 'initializing_wallet', walletExists: action.exists }

    case 'WALLET_CHECK_ERROR':
      return { type: 'initializing_wallet', walletExists: false }

    case 'INITIALIZE_WALLET':
      return { type: 'initializing_wallet', walletExists: action.walletExists }

    case 'WALLET_INITIALIZED':
      return { type: 'ready' }

    case 'WALLET_INIT_ERROR':
      return {
        type: 'error',
        error: action.error,
        isAuthError: isAuthenticationError(action.error),
      }

    case 'RESET':
      return { type: 'idle' }

    case 'RETRY':
      return state.type === 'error' ? { type: 'idle' } : state

    default:
      return state
  }
}

function getStateContext(state: InitState): InitStateContext {
  switch (state.type) {
    case 'checking_wallet':
      return { walletExists: null, error: null }
    case 'initializing_wallet':
      return { walletExists: state.walletExists, error: null }
    case 'error':
      return { walletExists: null, error: state.error }
    case 'ready':
      return { walletExists: true, error: null }
    default:
      return { walletExists: null, error: null }
  }
}

export function useWdkInitialization(
  secureStorage: SecureStorage,
  networkConfigs: NetworkConfigs,
  identifier?: string,
  enabled: boolean = true
): UseWdkInitializationResult {
  const [state, dispatch] = useReducer(initReducer, { type: 'idle' })
  const cancelledRef = useRef(false)
  const prevEnabledRef = useRef(enabled)

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

  const stateContext = getStateContext(state)

  // Reset state when enabled changes from false to true
  useEffect(() => {
    if (enabled && !prevEnabledRef.current) {
      log('[useWdkInitialization] Enabled changed to true, resetting state')
      dispatch({ type: 'RESET' })
      cancelledRef.current = false
    }
    prevEnabledRef.current = enabled
  }, [enabled])

  // Initialize worklet when component mounts or when reset
  useEffect(() => {
    if (
      state.type !== 'idle' ||
      isWorkletInitialized ||
      isWorkletLoading ||
      !enabled
    ) {
      return
    }

    cancelledRef.current = false
    dispatch({ type: 'START_WORKLET' })

    const initializeWorklet = async () => {
      try {
        log('[useWdkInitialization] Starting worklet initialization...')
        await startWorklet(networkConfigs)

        if (cancelledRef.current) return
        log('[useWdkInitialization] Worklet started successfully')
        dispatch({ type: 'WORKLET_STARTED' })
      } catch (error) {
        if (cancelledRef.current) return

        const err = normalizeError(error, true, {
          component: 'useWdkInitialization',
          operation: 'workletInitialization',
        })
        logError('[useWdkInitialization] Failed to initialize worklet:', error)
        dispatch({ type: 'WORKLET_ERROR', error: err })
      }
    }

    initializeWorklet()

    return () => {
      cancelledRef.current = true
    }
  }, [state.type, isWorkletInitialized, isWorkletLoading, enabled, networkConfigs, startWorklet])

  // Check wallet existence when worklet is started
  useEffect(() => {
    if (
      state.type !== 'checking_wallet' ||
      !isWorkletStarted ||
      !enabled
    ) {
      return
    }

    cancelledRef.current = false

    const checkWallet = async () => {
      try {
        log('[useWdkInitialization] Checking if wallet exists...')
        const walletExistsResult = await hasWallet(identifier)
        log('[useWdkInitialization] Wallet check result:', walletExistsResult)

        if (cancelledRef.current) return
        dispatch({ type: 'WALLET_CHECKED', exists: walletExistsResult })
      } catch (error) {
        logError('[useWdkInitialization] Failed to check wallet:', error)
        if (cancelledRef.current) return
        dispatch({ type: 'WALLET_CHECK_ERROR' })
      }
    }

    checkWallet()

    return () => {
      cancelledRef.current = true
    }
  }, [state.type, isWorkletStarted, hasWallet, identifier, enabled])

  // Initialize wallet when wallet check is complete
  useEffect(() => {
    if (
      state.type !== 'initializing_wallet' ||
      walletInitialized ||
      !enabled
    ) {
      return
    }

    cancelledRef.current = false

    const performInitialization = async () => {
      try {
        log('[useWdkInitialization] Starting wallet initialization...')
        const walletExists = state.walletExists

        if (walletExists) {
          log('[useWdkInitialization] Loading existing wallet from secure storage...')
          await initializeWallet({ createNew: false, identifier })
        } else {
          log('[useWdkInitialization] Creating new wallet...')
          await initializeWallet({ createNew: true, identifier })
        }

        if (cancelledRef.current) return
        log('[useWdkInitialization] Wallet initialized successfully')
        dispatch({ type: 'WALLET_INITIALIZED' })
      } catch (error) {
        if (cancelledRef.current) return

        const err = normalizeError(error, true, {
          component: 'useWdkInitialization',
          operation: 'walletInitialization',
        })
        logError('[useWdkInitialization] Failed to initialize wallet:', error)
        dispatch({ type: 'WALLET_INIT_ERROR', error: err })
      }
    }

    performInitialization()

    return () => {
      cancelledRef.current = true
    }
  }, [state, walletInitialized, initializeWallet, identifier, enabled])

  // Update state when wallet becomes initialized externally
  useEffect(() => {
    if (walletInitialized && state.type !== 'ready' && state.type !== 'error') {
      dispatch({ type: 'WALLET_INITIALIZED' })
    }
  }, [walletInitialized, state.type])

  const retry = useCallback(async () => {
    log('[useWdkInitialization] Retrying initialization...')
    dispatch({ type: 'RETRY' })
    cancelledRef.current = false

    if (!isWorkletStarted) {
      log('[useWdkInitialization] Cannot retry: worklet not started')
      return
    }

    // If wallet check hasn't happened, trigger it
    if (stateContext.walletExists === null && isWorkletStarted) {
      dispatch({ type: 'CHECK_WALLET' })
    } else if (stateContext.walletExists !== null) {
      // Retry wallet initialization
      dispatch({
        type: 'INITIALIZE_WALLET',
        walletExists: stateContext.walletExists,
      })
    }
  }, [isWorkletStarted, stateContext.walletExists])

  // Calculate isInitializing based on state
  const isInitializing = useMemo(() => {
    if (!enabled) {
      return false
    }

    const isInProgressState =
      state.type === 'starting_worklet' ||
      state.type === 'checking_wallet' ||
      state.type === 'initializing_wallet'

    const isWaitingForWalletCheck =
      !stateContext.walletExists && isWorkletStarted && state.type === 'idle'

    return (
      isInProgressState ||
      isWorkletLoading ||
      isWalletInitializing ||
      isWaitingForWalletCheck
    )
  }, [
    enabled,
    state.type,
    stateContext.walletExists,
    isWorkletStarted,
    isWorkletLoading,
    isWalletInitializing,
  ])

  return {
    walletExists: stateContext.walletExists,
    isInitializing,
    error: stateContext.error,
    retry,
    isWorkletStarted,
    walletInitialized,
  }
}
