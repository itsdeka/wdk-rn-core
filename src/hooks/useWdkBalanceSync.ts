/**
 * Hook for managing balance fetching and auto-refresh
 * 
 * Handles:
 * - Automatic balance fetching after wallet initialization
 * - Manual balance refresh
 * - Auto-refresh at specified intervals
 */

import { useCallback, useEffect, useRef, useState } from 'react'

import { getWalletStore } from '../store/walletStore'
import { getWorkletStore } from '../store/workletStore'
import { useBalanceFetcher } from './useBalanceFetcher'
import { useMutex } from './useMutex'
import type { TokenConfigs } from '../types'
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
  const acquire = useMutex()

  const { fetchAllBalances } = useBalanceFetcher({
    walletStore: getWalletStore(),
    tokenConfigs,
  })

  const refreshBalances = useCallback(async (): Promise<void> => {
    if (!walletInitialized) {
      log('[useWdkBalanceSync] Cannot refresh balances: wallet not ready')
      return
    }

    await acquire(async () => {
      try {
        log('[useWdkBalanceSync] Manually refreshing balances...')
        setIsFetchingBalances(true)
        await fetchAllBalances()
        log('[useWdkBalanceSync] Manual balance refresh completed')
      } catch (error) {
        logError('[useWdkBalanceSync] Failed to refresh balances:', error)
      } finally {
        setIsFetchingBalances(false)
      }
    })
  }, [walletInitialized, fetchAllBalances, acquire])

  // Automatic balance fetching after wallet initialization
  useEffect(() => {
    const shouldFetchBalances = autoFetchBalances && walletInitialized && isReady && !hasCompletedInitialBalanceFetch.current
    if (!shouldFetchBalances) {
      return
    }

    let cancelled = false

    const fetchBalances = async () => {
      await acquire(async () => {
        if (cancelled) return

        try {
          log('[useWdkBalanceSync] Starting automatic balance fetch...')
          setIsFetchingBalances(true)
          await fetchAllBalances()
          log('[useWdkBalanceSync] Automatic balance fetch completed')
          hasCompletedInitialBalanceFetch.current = true
        } catch (error) {
          logError('[useWdkBalanceSync] Failed to fetch balances:', error)
        } finally {
          setIsFetchingBalances(false)
        }
      })
    }

    fetchBalances()

    return () => {
      cancelled = true
    }
  }, [autoFetchBalances, walletInitialized, isReady, fetchAllBalances, acquire])

  // Auto-refresh balances at specified interval
  useEffect(() => {
    const shouldAutoRefresh = autoFetchBalances && balanceRefreshInterval && balanceRefreshInterval > 0 && isReady
    if (!shouldAutoRefresh) {
      return
    }

    let cancelled = false

    const interval = setInterval(async () => {
      const workletState = getWorkletStore().getState()
      if (!workletState.isInitialized || cancelled) {
        return
      }

      await acquire(async () => {
        if (cancelled) return

        try {
          log('[useWdkBalanceSync] Auto-refreshing balances...')
          setIsFetchingBalances(true)
          await fetchAllBalances()
          log('[useWdkBalanceSync] Balance auto-refresh completed')
        } catch (error) {
          logError('[useWdkBalanceSync] Failed to auto-refresh balances:', error)
        } finally {
          setIsFetchingBalances(false)
        }
      })
    }, balanceRefreshInterval)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [autoFetchBalances, balanceRefreshInterval, isReady, fetchAllBalances, acquire])

  return {
    isFetchingBalances,
    refreshBalances,
  }
}


