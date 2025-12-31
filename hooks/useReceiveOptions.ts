/**
 * Hook for getting all valid token/network combinations for receiving
 * 
 * Provides all combinations of assets and valid chains, including special
 * networks like 'sparkStaticDeposit' and 'lightning' for BTC.
 * 
 * Example usage:
 * ```tsx
 * import { useReceiveOptions } from '@/hooks/useReceiveOptions'
 * 
 * const options = useReceiveOptions()
 * // Returns: [
 * //   { tokenSymbol: 'BTC', network: 'lightning' },
 * //   { tokenSymbol: 'BTC', network: 'spark' },
 * //   { tokenSymbol: 'BTC', network: 'sparkStaticDeposit' },
 * //   { tokenSymbol: 'USDT', network: 'polygon' },
 * //   { tokenSymbol: 'USDT', network: 'ethereum' },
 * //   ...
 * // ]
 * ```
 */

import { useMemo } from 'react'
import { tokenConfigs } from '@/config/tokens'
import { getNetworksForToken, getPriorityWeight } from '@/utils/network/networks'

export interface ReceiveOption {
  tokenSymbol: string
  network: string
}

/**
 * Hook that provides all valid token/network combinations for receiving
 * 
 * @returns Array of token/network combinations
 */
export function useReceiveOptions(): ReceiveOption[] {
  const options = useMemo(() => {
    const result: ReceiveOption[] = []
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

    // Generate combinations for each token
    seenTokens.forEach((tokenSymbol) => {
      // Get networks for this token using the utility function
      const networks = getNetworksForToken(tokenSymbol)
      
      // Add all network combinations, but filter out networks with priority 0
      networks.forEach((network) => {
        const priority = getPriorityWeight(tokenSymbol, network)
        // Only include networks with priority > 0
        if (priority > 0) {
          result.push({
            tokenSymbol,
            network,
          })
        }
      })
    })

    return result
  }, [])

  return options
}

