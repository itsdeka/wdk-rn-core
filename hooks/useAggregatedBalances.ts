/**
 * Hook for accessing aggregated balances across all wallets, assets, and chains
 * 
 * Provides reactive access to:
 * - Total balances (across all wallets)
 * - Per-wallet balances
 * 
 * Note: Network keys are lowercase (e.g., 'polygon', 'ethereum', 'arbitrum').
 * Use `getNetworkDisplayName()` from `@/utils/networks` to get display names.
 * 
 * Example usage:
 * ```tsx
 * import { useAggregatedBalances } from '@/hooks/useAggregatedBalances'
 * import { getNetworkDisplayName } from '@/utils/networks'
 * 
 * const { total, wallets } = useAggregatedBalances()
 * 
 * // Access total USDT on Polygon (using lowercase network key)
 * const totalUSDTOnPolygon = total.USDT?.polygon
 * const totalUSDTAmount = totalUSDTOnPolygon?.amount || 0
 * const totalUSDTValue = totalUSDTOnPolygon?.value || 0
 * 
 * // Get display name for network
 * const polygonDisplayName = getNetworkDisplayName('polygon') // Returns 'Polygon'
 * 
 * // Access USDT on Polygon for a specific wallet
 * const walletUSDTOnPolygon = wallets[walletId]?.USDT?.polygon
 * const walletUSDTAmount = walletUSDTOnPolygon?.amount || 0
 * const walletUSDTValue = walletUSDTOnPolygon?.value || 0
 * 
 * // Iterate over all symbols and networks
 * Object.entries(total).forEach(([symbol, networks]) => {
 *   Object.entries(networks).forEach(([network, balance]) => {
 *     console.log(`${symbol} on ${getNetworkDisplayName(network)}: ${balance.amount} tokens = $${balance.value}`)
 *   })
 * })
 * ```
 */

import { useMemo } from 'react'
import { useWallet } from '@tetherto/wdk-rn-core'
import { useRumbleStore } from '../stores/rumbleStore'
import {
  getAggregatedBalances,
  type AggregatedBalances,
  type BalanceEntry,
  type BalanceByNetwork,
  type BalanceBySymbol,
} from '../services/wallet/balanceAggregationService'

// Re-export types for convenience
export type { AggregatedBalances, BalanceEntry, BalanceByNetwork, BalanceBySymbol }

/**
 * Hook that provides aggregated balances across all wallets, assets, and chains
 * 
 * @returns Aggregated balances object with total and per-wallet breakdown
 */
export function useAggregatedBalances(): AggregatedBalances {
  const rumbleStore = useRumbleStore()
  const { balances } = useWallet()
  
  // Memoize the aggregated balances calculation
  // Re-compute when wallets or balances change
  const aggregatedBalances = useMemo(() => {
    return getAggregatedBalances(balances)
  }, [
    rumbleStore.mainWallet,
    rumbleStore.tipJars,
    balances,
  ])
  
  return aggregatedBalances
}

