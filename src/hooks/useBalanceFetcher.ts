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

import { useCallback, useMemo } from 'react'

import { AccountService } from '../services/accountService'
import { AddressService } from '../services/addressService'
import { BalanceService } from '../services/balanceService'
import { getWalletStore } from '../store/walletStore'
import { getWorkletStore } from '../store/workletStore'
import type {
  BalanceFetchResult,
  TokenConfig,
  TokenConfigs,
  TokenConfigProvider,
  TokenHelpers,
  Wallet,
} from '../types'
import { convertBalanceToString } from '../utils/balanceUtils'
import { log, logError, logWarn } from '../utils/logger'

// Constants
const ACCOUNT_METHOD_GET_BALANCE = 'getBalance'
const ACCOUNT_METHOD_GET_TOKEN_BALANCE = 'getTokenBalance'
const WALLET_IDENTIFIER_PREFIX = 'wallet-'
const MAIN_WALLET_NAME = 'Main Wallet'
const WALLET_NAME_PREFIX = 'Wallet '

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
      identifier: `${WALLET_IDENTIFIER_PREFIX}${accountIndex}`,
      name: accountIndex === 0 ? MAIN_WALLET_NAME : `${WALLET_NAME_PREFIX}${accountIndex}`,
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
export interface UseBalanceFetcherResult {
  // Individual fetch methods
  fetchBalance: (network: string, accountIndex: number, tokenAddress: string | null) => Promise<BalanceFetchResult>
  // Batch fetch methods
  fetchAllBalances: () => Promise<BalanceFetchResult[]>
  fetchAllBalancesForWallet: (accountIndex: number) => Promise<BalanceFetchResult[]>
  fetchBalancesForNetwork: (network: string) => Promise<BalanceFetchResult[]>
  fetchBalancesForWalletAndNetwork: (accountIndex: number, network: string) => Promise<BalanceFetchResult[]>
}

export function useBalanceFetcher(options: {
  walletStore: ReturnType<typeof getWalletStore>
  tokenConfigs: TokenConfigProvider
}): UseBalanceFetcherResult {
  const { walletStore, tokenConfigs: tokenConfigProvider } = options

  // Validate configuration
  if (!walletStore) {
    throw new Error(
      '[useBalanceFetcher] walletStore is required'
    )
  }
  
  // Validate walletStore has required Zustand methods
  // Note: getAllWallets, callAccountMethod, and isWalletInitialized are not methods on walletStore
  // They are provided by helper functions and services (getAllWalletsFromWalletStore, AddressService)
  if (typeof walletStore.getState !== 'function') {
    throw new Error(
      '[useBalanceFetcher] walletStore must be a valid Zustand store with getState method'
    )
  }
  
  // Validate tokenConfigs
  if (!tokenConfigProvider) {
    throw new Error(
      '[useBalanceFetcher] tokenConfigs is required'
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
   * Internal function to fetch balance (native or token)
   * Handles both native and ERC20 token balances with shared logic
   */
  const fetchBalanceInternal = useCallback(
    async (
      network: string,
      accountIndex: number,
      tokenAddress: string | null
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

      BalanceService.setBalanceLoading(network, accountIndex, tokenAddress, true)

      try {
        const isNative = tokenAddress === null
        const methodName = isNative ? ACCOUNT_METHOD_GET_BALANCE : ACCOUNT_METHOD_GET_TOKEN_BALANCE
        const methodArg = isNative ? null : tokenAddress

        if (isNative) {
          log(`[BalanceFetcher] Calling ${ACCOUNT_METHOD_GET_BALANCE} for ${network}:${accountIndex}...`)
        }

        const balanceResult = await AccountService.callAccountMethod<string>(
          network,
          accountIndex,
          methodName,
          methodArg
        )

        if (isNative) {
          log(`[BalanceFetcher] ${ACCOUNT_METHOD_GET_BALANCE} result for ${network}:${accountIndex}:`, balanceResult)
        }

        // Convert to string (handles BigInt values)
        const balance = convertBalanceToString(balanceResult)

        // Update store with fetched balance
        BalanceService.updateBalance(accountIndex, network, tokenAddress, balance)
        BalanceService.updateLastBalanceUpdate(network, accountIndex)
        BalanceService.setBalanceLoading(network, accountIndex, tokenAddress, false)

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
        const tokenInfo = tokenAddress ? `:${tokenAddress}` : ''
        const balanceType = tokenAddress ? 'token' : 'native'
        logError(
          `Failed to fetch ${balanceType} balance for ${network}:${accountIndex}${tokenInfo}:`,
          error
        )
        BalanceService.setBalanceLoading(network, accountIndex, tokenAddress, false)

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
   * Pass null as tokenAddress for native token balance
   */
  const fetchBalance = useCallback(
    async (
      network: string,
      accountIndex: number,
      tokenAddress: string | null
    ): Promise<BalanceFetchResult> => {
      return fetchBalanceInternal(network, accountIndex, tokenAddress)
    },
    [fetchBalanceInternal]
  )

  /**
   * Fetch all balances for a specific wallet across all networks and tokens
   */
  const fetchAllBalancesForWallet = useCallback(
    async (accountIndex: number): Promise<BalanceFetchResult[]> => {
      if (!getIsInitialized()) {
        log(`[BalanceFetcher] Wallet not initialized, skipping wallet ${accountIndex}`)
        return []
      }

      const networks = tokenHelpers.getSupportedNetworks()
      log(`[BalanceFetcher] Fetching balances for wallet ${accountIndex} across ${networks.length} network(s): ${networks.join(', ')}`)
      
      // Collect all fetch promises and their metadata
      const fetchPromises: Array<Promise<BalanceFetchResult>> = []
      const tokenMetadata: Array<{ network: string; token: TokenConfig }> = []

      networks.forEach((network) => {
        const tokens = tokenHelpers.getTokensForNetwork(network)
        tokens.forEach((token) => {
          fetchPromises.push(fetchBalance(network, accountIndex, token.address))
          tokenMetadata.push({ network, token })
        })
      })

      // Execute all fetches in parallel
      const results = await Promise.all(fetchPromises)

      // Log results
      results.forEach((result, index) => {
        const metadata = tokenMetadata[index]
        if (!metadata) {
          logWarn(`[BalanceFetcher] Missing token metadata for result at index ${index}`)
          return
        }
        const { network, token } = metadata
        if (result.success) {
          log(`[BalanceFetcher] ✓ ${network}:${accountIndex}:${token.symbol} = ${result.balance}`)
        } else {
          logWarn(`[BalanceFetcher] ✗ ${network}:${accountIndex}:${token.symbol}: ${result.error}`)
        }
      })

      log(`[BalanceFetcher] Completed fetching balances for wallet ${accountIndex}: ${results.length} result(s)`)
      return results
    },
    [fetchBalance, tokenHelpers, getIsInitialized]
  )

  /**
   * Fetch all balances for all wallets across all networks and tokens
   */
  const fetchAllBalances = useCallback(async (): Promise<BalanceFetchResult[]> => {
    if (!getIsInitialized()) {
      log('[BalanceFetcher] Wallet not initialized, skipping balance fetch')
      return []
    }

    const allWallets = getAllWallets()
    log(`[BalanceFetcher] Starting to fetch balances for ${allWallets.length} wallet(s)`)
    const results: BalanceFetchResult[] = []

    try {
      // Process wallets sequentially
      for (const wallet of allWallets) {
        try {
          log(`[BalanceFetcher] Processing wallet ${wallet.accountIndex}...`)
          const walletResults = await fetchAllBalancesForWallet(
            wallet.accountIndex
          )
          results.push(...walletResults)
          log(`[BalanceFetcher] Completed wallet ${wallet.accountIndex}: ${walletResults.length} balance(s)`)
        } catch (error) {
          logError(`[BalanceFetcher] Error processing wallet ${wallet.accountIndex}:`, error)
        }
      }

      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      log(`[BalanceFetcher] ✅ Completed fetching all balances: ${successCount} success, ${failCount} failed, ${results.length} total`)
    } catch (error) {
      logError('[BalanceFetcher] Fatal error in fetchAllBalances:', error)
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

      // Fetch balances for all wallets and tokens in parallel
      const fetchPromises = allWallets.flatMap((wallet: Wallet) =>
        tokens.map((token) =>
          fetchBalance(network, wallet.accountIndex, token.address)
        )
      )

      return Promise.all(fetchPromises)
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

      // Fetch balances for all tokens in parallel
      const fetchPromises = tokens.map((token) =>
        fetchBalance(network, accountIndex, token.address)
      )

      return Promise.all(fetchPromises)
    },
    [fetchBalance, tokenHelpers, getIsInitialized]
  )

  return {
    // Individual fetch methods
    fetchBalance,

    // Batch fetch methods
    fetchAllBalances,
    fetchAllBalancesForWallet,
    fetchBalancesForNetwork,
    fetchBalancesForWalletAndNetwork,
  }
}
