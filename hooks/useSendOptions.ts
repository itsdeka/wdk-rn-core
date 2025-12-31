/**
 * Hook for getting all valid token/network combinations for sending
 * 
 * Provides all combinations of assets and valid chains with balance information,
 * sorted by balance value when available, otherwise by priority weight.
 * Includes special networks like 'sparkStaticDeposit' and 'lightning' for BTC.
 * 
 * Example usage:
 * ```tsx
 * import { useSendOptions } from '@/hooks/useSendOptions'
 * 
 * const options = useSendOptions('wallet-identifier')
 * // Returns: [
 * //   { tokenSymbol: 'USDT', network: 'polygon', balanceValue: 1000, balanceAmount: 1000, decimals: 6 },
 * //   { tokenSymbol: 'BTC', network: 'lightning', balanceValue: 500, balanceAmount: 0.01, decimals: 8 },
 * //   ...
 * // ]
 * ```
 */

import { useMemo } from 'react'
import { tokenConfigs } from '@/config/tokens'
import { getNetworksForToken, getPriorityWeight } from '@/utils/network/networks'
import { useAggregatedBalances } from './useAggregatedBalances'

export interface SendOption {
  tokenSymbol: string
  network: string
  balanceValue: number  // USD value
  balanceAmount: number  // Token amount
  decimals: number
}

/**
 * Hook that provides all valid token/network combinations for sending with balance information
 * 
 * @param walletIdentifier - Optional wallet identifier. If provided, uses that wallet's balances. Otherwise uses total balances.
 * @returns Array of token/network combinations with balance data, sorted by balance value or priority
 */
export function useSendOptions(walletIdentifier?: string): SendOption[] {
  const aggregatedBalances = useAggregatedBalances()
  
  const options = useMemo(() => {
    const result: SendOption[] = []
    const seenTokens = new Set<string>()

    // Collect all unique tokens from token configs
    Object.values(tokenConfigs).forEach((networkConfig) => {
      // Add native token
      if (networkConfig.native?.symbol) {
        seenTokens.add(networkConfig.native.symbol)
      }
      
      // Add ERC20 tokens
      networkConfig.tokens?.forEach((token) => {
        if (token.symbol) {
          seenTokens.add(token.symbol)
        }
      })
    })

    // Get balances to use (specific wallet or total)
    const balancesToUse = walletIdentifier
      ? aggregatedBalances.wallets[walletIdentifier] || {}
      : aggregatedBalances.total

    // Helper function to map abstract networks to underlying network for balance lookup
    // For BTC, "bitcoin" and "lightning" are abstractions that use the "spark" network balance
    const mapNetworkForBalanceLookup = (network: string, tokenSymbol: string): string => {
      // For BTC token, map abstract networks to underlying spark network
      if (tokenSymbol === 'BTC') {
        if (network === 'bitcoin' || network === 'lightning') {
          return 'spark'
        }
      }
      // For other tokens or networks, return as-is
      return network
    }

    // Generate combinations for each token
    seenTokens.forEach((tokenSymbol) => {
      // Get networks for this token using the utility function
      const networks = getNetworksForToken(tokenSymbol)
      
      // Add all network combinations, but filter out networks with priority 0
      networks.forEach((network) => {
        const priority = getPriorityWeight(tokenSymbol, network)
        // Only include networks with priority > 0
        if (priority <= 0) {
          return
        }

        // Map the network to the underlying network for balance lookup
        const balanceLookupNetwork = mapNetworkForBalanceLookup(network, tokenSymbol)

        // Get balance for this token/network combination using the mapped network
        // Network-specific caching is already applied in the aggregation service
        const tokenBalances = balancesToUse[tokenSymbol]
        const balance = tokenBalances?.[balanceLookupNetwork] || { amount: 0, value: 0 }
        
        // Get token config for decimals
        const networkConfig = tokenConfigs[network as keyof typeof tokenConfigs]
        let decimals = 8 // Default
        
        if (networkConfig) {
          // Check if it's the native token
          if (networkConfig.native.symbol === tokenSymbol) {
            decimals = networkConfig.native.decimals
          } else {
            // Check ERC20 tokens
            const erc20Token = networkConfig.tokens?.find((t) => t.symbol === tokenSymbol)
            if (erc20Token) {
              decimals = erc20Token.decimals
            }
          }
        }

        result.push({
          tokenSymbol,
          network,
          balanceValue: balance.value || 0,
          balanceAmount: balance.amount || 0,
          decimals,
        })
      })
    })

    // Sort: items with balance first (by value), then items without balance (by priority)
    return result.sort((a, b) => {
      const aHasBalance = a.balanceValue > 0
      const bHasBalance = b.balanceValue > 0

      // If both have balance, sort by balance value (descending)
      if (aHasBalance && bHasBalance) {
        return b.balanceValue - a.balanceValue
      }

      // If only one has balance, it comes first
      if (aHasBalance && !bHasBalance) {
        return -1
      }
      if (!aHasBalance && bHasBalance) {
        return 1
      }

      // If neither has balance, sort by priority weight (descending)
      const priorityA = getPriorityWeight(a.tokenSymbol, a.network)
      const priorityB = getPriorityWeight(b.tokenSymbol, b.network)
      return priorityB - priorityA
    })
  }, [aggregatedBalances, walletIdentifier])

  return options
}

