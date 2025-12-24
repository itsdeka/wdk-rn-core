/**
 * Balance Fetcher Hook
 *
 * Provides functionality to fetch token balances through the worklet
 * and update balances in walletStore for all supported tokens on all chains.
 *
 * Supports:
 * - Native token balances (ETH, MATIC, etc.)
 * - ERC20 token balances (USDT, etc.)
 * - Fetching balances for all wallets, networks, and tokens
 */

// React hooks
import { useCallback, useMemo } from 'react'

// Internal modules
import {
  WorkletService,
  getWorkletStore,
  getWalletStore,
  type TokenConfig,
  type TokenConfigs,
  type Wallet,
  type BalanceFetchResult,
  type TokenConfigProvider,
  type TokenHelpers,
} from '../index'

// Local imports
import { convertBalanceToString } from '../utils/balanceUtils'

/**
 * Create token helpers from token configs
 */
function createTokenHelpers(tokenConfigs: TokenConfigs): TokenHelpers {
  return {
    getTokensForNetwork: (network: string): TokenConfig[] => {
      const networkTokens = tokenConfigs[network]
      if (!networkTokens) {
        return []
      }
      return [networkTokens.native, ...networkTokens.tokens]
    },
    getSupportedNetworks: (): string[] => {
      return Object.keys(tokenConfigs)
    },
  }
}

/**
 * Get all wallets from walletStore by extracting account indices from addresses
 */
function getAllWalletsFromWalletStore(walletStore: ReturnType<typeof getWalletStore>): Wallet[] {
  const state = walletStore.getState()
  const accountIndices = new Set<number>()

  // Collect all account indices from addresses
  Object.values(state.addresses).forEach((networkAddresses) => {
    if (networkAddresses && typeof networkAddresses === 'object') {
      Object.keys(networkAddresses).forEach((key) => {
        const accountIndex = parseInt(key, 10)
        if (!isNaN(accountIndex)) {
          accountIndices.add(accountIndex)
        }
      })
    }
  })

  // Return wallets for all account indices that have addresses
  return Array.from(accountIndices)
    .sort((a, b) => a - b)
    .map((accountIndex) => ({
      accountIndex,
      identifier: `wallet-${accountIndex}`,
      name: accountIndex === 0 ? 'Main Wallet' : `Wallet ${accountIndex}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }))
}

/**
 * Hook to fetch balances through the worklet
 *
 * Works directly with walletStore - no adapter needed.
 *
 * @param options - Configuration options
 * @param options.walletStore - WalletStore instance (from getWalletStore())
 * @param options.tokenConfigs - Token configurations
 *
 * @returns Balance fetcher methods
 *
 * @example
 * ```tsx
 * import { getWalletStore } from '@tetherto/wdk-rn-worklet'
 *
 * const { fetchAllBalances } = useBalanceFetcher({
 *   walletStore: getWalletStore(),
 *   tokenConfigs
 * })
 * ```
 */
export function useBalanceFetcher(options: {
  walletStore: ReturnType<typeof getWalletStore>
  tokenConfigs: TokenConfigProvider
}) {
  const { walletStore, tokenConfigs: tokenConfigProvider } = options

  // Validate configuration
  if (!walletStore) {
    throw new Error(
      '[useBalanceFetcher] walletStore is required'
    )
  }

  // Check initialization state from worklet store (internal check)
  const getIsInitialized = useCallback(() => {
    return getWorkletStore().getState().isInitialized
  }, [])

  // Get all wallets from walletStore
  const getAllWallets = useCallback((): Wallet[] => {
    return getAllWalletsFromWalletStore(walletStore)
  }, [walletStore])

  // Get token helpers from config provider (memoized to prevent recreation)
  const tokenConfigs = useMemo(() =>
    typeof tokenConfigProvider === 'function'
      ? tokenConfigProvider()
      : tokenConfigProvider,
    [tokenConfigProvider]
  )

  const tokenHelpers = useMemo(() =>
    createTokenHelpers(tokenConfigs),
    [tokenConfigs]
  )

  /**
   * Fetch native token balance for a specific wallet and network
   */
  const fetchNativeBalance = useCallback(
    async (
      network: string,
      accountIndex: number
    ): Promise<BalanceFetchResult> => {
      if (!getIsInitialized()) {
        return {
          success: false,
          network,
          accountIndex,
          tokenAddress: null,
          balance: null,
          error: 'Wallet not initialized',
        }
      }

      WorkletService.setBalanceLoading(network, accountIndex, null, true)

      try {
        // Call getBalance method on the account for native token
        const balanceResult = await WorkletService.callAccountMethod<unknown>(
          network,
          accountIndex,
          'getBalance',
          null
        )

        // Convert to string (handles BigInt values)
        const balance = convertBalanceToString(balanceResult)

        // Update store with fetched balance
        WorkletService.updateBalance(accountIndex, network, null, balance)
        WorkletService.updateLastBalanceUpdate(network, accountIndex)
        WorkletService.setBalanceLoading(network, accountIndex, null, false)

        return {
          success: true,
          network,
          accountIndex,
          tokenAddress: null,
          balance,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(
          `Failed to fetch native balance for ${network}:${accountIndex}:`,
          error
        )
        WorkletService.setBalanceLoading(network, accountIndex, null, false)

        return {
          success: false,
          network,
          accountIndex,
          tokenAddress: null,
          balance: null,
          error: errorMessage,
        }
      }
    },
    [getIsInitialized]
  )

  /**
   * Fetch ERC20 token balance for a specific wallet, network, and token
   */
  const fetchTokenBalance = useCallback(
    async (
      network: string,
      accountIndex: number,
      tokenAddress: string
    ): Promise<BalanceFetchResult> => {
      if (!getIsInitialized()) {
        return {
          success: false,
          network,
          accountIndex,
          tokenAddress,
          balance: null,
          error: 'Wallet not initialized',
        }
      }

      WorkletService.setBalanceLoading(network, accountIndex, tokenAddress, true)

      try {
        // Call getTokenBalance method on the account for ERC20 token
        const balanceResult = await WorkletService.callAccountMethod<unknown>(
          network,
          accountIndex,
          'getTokenBalance',
          tokenAddress
        )

        // Convert to string (handles BigInt values)
        const balance = convertBalanceToString(balanceResult)

        // Update store with fetched balance
        WorkletService.updateBalance(accountIndex, network, tokenAddress, balance)
        WorkletService.updateLastBalanceUpdate(network, accountIndex)
        WorkletService.setBalanceLoading(network, accountIndex, tokenAddress, false)

        return {
          success: true,
          network,
          accountIndex,
          tokenAddress,
          balance,
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error)
        console.error(
          `Failed to fetch token balance for ${network}:${accountIndex}:${tokenAddress}:`,
          error
        )
        WorkletService.setBalanceLoading(network, accountIndex, tokenAddress, false)

        return {
          success: false,
          network,
          accountIndex,
          tokenAddress,
          balance: null,
          error: errorMessage,
        }
      }
    },
    [getIsInitialized]
  )

  /**
   * Fetch balance for a specific token (native or ERC20)
   */
  const fetchBalance = useCallback(
    async (
      network: string,
      accountIndex: number,
      tokenAddress: string | null
    ): Promise<BalanceFetchResult> => {
      if (tokenAddress === null) {
        return fetchNativeBalance(network, accountIndex)
      } else {
        return fetchTokenBalance(network, accountIndex, tokenAddress)
      }
    },
    [fetchNativeBalance, fetchTokenBalance]
  )

  /**
   * Fetch all balances for a specific wallet across all networks and tokens
   */
  const fetchAllBalancesForWallet = useCallback(
    async (accountIndex: number): Promise<BalanceFetchResult[]> => {
      if (!getIsInitialized()) {
        return []
      }

      const networks = tokenHelpers.getSupportedNetworks()
      const results: BalanceFetchResult[] = []

      // Fetch balances for all networks and tokens in parallel
      await Promise.all(
        networks.map(async (network) => {
          const tokens = tokenHelpers.getTokensForNetwork(network)

          await Promise.all(
            tokens.map(async (token) => {
              try {
                const result = await fetchBalance(
                  network,
                  accountIndex,
                  token.address
                )
                results.push(result)
              } catch (error) {
                console.error(`[BalanceFetcher] Error fetching ${network}:${accountIndex}:${token.symbol}:`, error)
                results.push({
                  success: false,
                  network,
                  accountIndex,
                  tokenAddress: token.address,
                  balance: null,
                  error: error instanceof Error ? error.message : String(error),
                })
              }
            })
          )
        })
      )

      return results
    },
    [fetchBalance, tokenHelpers, getIsInitialized]
  )

  /**
   * Fetch all balances for all wallets across all networks and tokens
   */
  const fetchAllBalances = useCallback(async (): Promise<BalanceFetchResult[]> => {
    if (!getIsInitialized()) {
      return []
    }

    const allWallets = getAllWallets()
    const results: BalanceFetchResult[] = []

    try {
      // Fetch balances for all wallets in parallel
      await Promise.all(
        allWallets.map(async (wallet: Wallet) => {
          try {
            const walletResults = await fetchAllBalancesForWallet(
              wallet.accountIndex
            )
            results.push(...walletResults)
          } catch (error) {
            console.error(`[BalanceFetcher] Error processing wallet ${wallet.accountIndex}:`, error)
          }
        })
      )
    } catch (error) {
      console.error('[BalanceFetcher] Fatal error in fetchAllBalances:', error)
    }

    return results
  }, [getAllWallets, fetchAllBalancesForWallet, getIsInitialized])

  /**
   * Fetch balances for a specific network across all wallets and tokens
   */
  const fetchBalancesForNetwork = useCallback(
    async (network: string): Promise<BalanceFetchResult[]> => {
      if (!getIsInitialized()) {
        return []
      }

      const allWallets = getAllWallets()
      const tokens = tokenHelpers.getTokensForNetwork(network)
      const results: BalanceFetchResult[] = []

      // Fetch balances for all wallets and tokens in parallel
      await Promise.all(
        allWallets.flatMap((wallet: Wallet) =>
          tokens.map(async (token) => {
            const result = await fetchBalance(
              network,
              wallet.accountIndex,
              token.address
            )
            results.push(result)
          })
        )
      )

      return results
    },
    [getAllWallets, fetchBalance, tokenHelpers, getIsInitialized]
  )

  /**
   * Fetch balances for all tokens on a specific network and wallet
   */
  const fetchBalancesForWalletAndNetwork = useCallback(
    async (
      accountIndex: number,
      network: string
    ): Promise<BalanceFetchResult[]> => {
      if (!getIsInitialized()) {
        return []
      }

      const tokens = tokenHelpers.getTokensForNetwork(network)
      const results: BalanceFetchResult[] = []

      // Fetch balances for all tokens in parallel
      await Promise.all(
        tokens.map(async (token) => {
          const result = await fetchBalance(
            network,
            accountIndex,
            token.address
          )
          results.push(result)
        })
      )

      return results
    },
    [fetchBalance, tokenHelpers, getIsInitialized]
  )

  return {
    // Individual fetch methods
    fetchNativeBalance,
    fetchTokenBalance,
    fetchBalance,

    // Batch fetch methods
    fetchAllBalances,
    fetchAllBalancesForWallet,
    fetchBalancesForNetwork,
    fetchBalancesForWalletAndNetwork,
  }
}
