/**
 * Hook for managing balance fetching and auto-refresh
 * 
 * Handles:
 * - Automatic balance fetching after wallet initialization
 * - Manual balance refresh
 * - Auto-refresh at specified intervals
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import type { TokenConfigs } from '../types'
import { useBalanceFetcher } from './useBalanceFetcher'
import { getWalletStore } from '../store/walletStore'
import { getWorkletStore } from '../store/workletStore'
import { log, logError } from '../utils/logger'

export interface UseWdkBalanceSyncResult {
  /** Balance fetching is in progress */
  isFetchingBalances: boolean
  /** Refresh all balances manually */
  refreshBalances: () => Promise<void>
}

export function useWdkBalanceSync(
  tokenConfigs: TokenConfigs,
  autoFetchBalances: boolean,
  balanceRefreshInterval: number,
  walletInitialized: boolean,
  isReady: boolean
): UseWdkBalanceSyncResult {
  const [isFetchingBalances, setIsFetchingBalances] = useState(false)
  const hasCompletedInitialBalanceFetch = useRef(false)
  const isMountedRef = useRef(true)
  // Mutex lock to prevent concurrent balance fetching
  const isFetchingRef = useRef(false)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const { fetchAllBalances } = useBalanceFetcher({
    walletStore: getWalletStore(),
    tokenConfigs,
  })

  // Safe state setter that checks if component is mounted
  const safeSetIsFetchingBalances = useCallback((value: boolean) => {
    if (isMountedRef.current) {
      setIsFetchingBalances(value)
    }
  }, [])

  const refreshBalances = useCallback(async (): Promise<void> => {
    if (!walletInitialized || isFetchingRef.current) {
      log('[useWdkBalanceSync] Cannot refresh balances: wallet not ready or already fetching')
      return
    }

    // Acquire lock
    isFetchingRef.current = true

    try {
      log('[useWdkBalanceSync] Manually refreshing balances...')
      safeSetIsFetchingBalances(true)
      await fetchAllBalances()
      log('[useWdkBalanceSync] Manual balance refresh completed')
    } catch (error) {
      logError('[useWdkBalanceSync] Failed to refresh balances:', error)
    } finally {
      isFetchingRef.current = false
      safeSetIsFetchingBalances(false)
    }
  }, [walletInitialized, safeSetIsFetchingBalances, fetchAllBalances])

  // Automatic balance fetching after wallet initialization
  useEffect(() => {
    if (!autoFetchBalances || !walletInitialized || !isReady || hasCompletedInitialBalanceFetch.current) {
      return
    }

    const fetchBalances = async () => {
      // Check if already fetching or unmounted
      if (isFetchingRef.current || !isMountedRef.current) {
        return
      }

      // Acquire lock
      isFetchingRef.current = true

      try {
        log('[useWdkBalanceSync] Starting automatic balance fetch...')
        safeSetIsFetchingBalances(true)
        await fetchAllBalances()
        if (isMountedRef.current) {
          log('[useWdkBalanceSync] Automatic balance fetch completed')
          hasCompletedInitialBalanceFetch.current = true
        }
      } catch (error) {
        if (isMountedRef.current) {
          logError('[useWdkBalanceSync] Failed to fetch balances:', error)
        }
      } finally {
        isFetchingRef.current = false
        safeSetIsFetchingBalances(false)
      }
    }

    fetchBalances()
  }, [autoFetchBalances, walletInitialized, isReady, fetchAllBalances, safeSetIsFetchingBalances])

  // Auto-refresh balances at specified interval
  useEffect(() => {
    if (!autoFetchBalances || !balanceRefreshInterval || balanceRefreshInterval <= 0 || !isReady) {
      return
    }

    const interval = setInterval(async () => {
      // Skip if already fetching, unmounted, or worklet not initialized
      if (isFetchingRef.current || !isMountedRef.current) {
        return
      }

      const workletState = getWorkletStore().getState()
      if (!workletState.isInitialized) {
        return
      }

      // Acquire lock
      isFetchingRef.current = true
      
      try {
        log('[useWdkBalanceSync] Auto-refreshing balances...')
        safeSetIsFetchingBalances(true)
        await fetchAllBalances()
        if (isMountedRef.current) {
          log('[useWdkBalanceSync] Balance auto-refresh completed')
        }
      } catch (error) {
        if (isMountedRef.current) {
          logError('[useWdkBalanceSync] Failed to auto-refresh balances:', error)
        }
      } finally {
        isFetchingRef.current = false
        safeSetIsFetchingBalances(false)
      }
    }, balanceRefreshInterval)

    return () => {
      clearInterval(interval)
      // Release lock on cleanup
      isFetchingRef.current = false
    }
  }, [autoFetchBalances, balanceRefreshInterval, isReady, fetchAllBalances, safeSetIsFetchingBalances])

  return {
    isFetchingBalances,
    refreshBalances,
  }
}


