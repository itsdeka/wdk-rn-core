/**
 * All Types
 * 
 * Network, token, and wallet type definitions.
 */

import type { WorkletStore } from './store/workletStore'

/**
 * Network configuration types
 */

export interface NetworkConfig {
  chainId: number
  blockchain: string
  provider?: string
  bundlerUrl?: string
  paymasterUrl?: string
  paymasterAddress?: string
  entryPointAddress?: string
  safeModulesVersion?: string
  paymasterToken?: {
    address: string
  }
  transferMaxFee?: number
  network?: string // For Spark network type (MAINNET, TESTNET)
}

export type NetworkConfigs = Record<string, NetworkConfig>

/**
 * Token configuration types
 */

export interface TokenConfig {
  // Token address (null for native token)
  address: string | null
  // Token symbol (e.g., 'ETH', 'USDT')
  symbol: string
  // Token name (e.g., 'Ethereum', 'Tether USD')
  name: string
  // Token decimals (18 for most tokens, 6 for USDT)
  decimals: number
  // Optional: Token logo URI
  logoURI?: string
  // Optional: Coingecko ID for price fetching
  coingeckoId?: string
}

export interface NetworkTokens {
  // Native token (always present)
  native: TokenConfig
  // ERC20 tokens supported on this network
  tokens: TokenConfig[]
}

export type TokenConfigs = Record<string, NetworkTokens>

/**
 * Wallet Types
 * 
 * Defines types and interfaces that wallet stores should implement.
 * 
 * IMPORTANT: These are TYPE definitions only - they do NOT store data.
 * - store/walletStore.ts: Actual storage of addresses and balances (the source of truth)
 * - utils/walletUtils.ts: Helper functions for working with wallets
 * - rumbleStore.ts, etc.: App-specific stores that implement the WalletStore interface
 */

/**
 * Wallet address data structure
 * Maps network -> accountIndex -> address
 * Used to store addresses for all wallets across all networks
 */
export interface WalletAddresses {
  [network: string]: {
    [accountIndex: number]: string
  }
}

/**
 * Balance data structure
 * Maps network -> accountIndex -> tokenAddress (null for native) -> balance (as string to handle big numbers)
 * 
 * This is the standard structure for storing balances across all wallet apps.
 * Apps can extend this but should maintain compatibility with this structure.
 */
export interface WalletBalances {
  [network: string]: {
    [accountIndex: number]: {
      [tokenAddress: string | 'native']: string // Balance as string to handle big numbers
    }
  }
}

/**
 * Balance loading states
 * Maps "network-accountIndex-tokenAddress" -> boolean
 * 
 * Used to track which balances are currently being fetched.
 */
export interface BalanceLoadingStates {
  [key: string]: boolean
}

/**
 * Base Wallet Interface
 * 
 * Common wallet structure for all wallet apps.
 * Apps can extend this interface to add app-specific fields.
 */
export interface Wallet {
  /**
   * Account index (0 for main wallet, >0 for additional wallets)
   */
  accountIndex: number

  /**
   * Unique identifier for the wallet (e.g., username, channel ID, etc.)
   * This is app-specific but required for all wallets
   */
  identifier: string

  /**
   * Display name for the wallet
   */
  name: string

  /**
   * Addresses per chain (network -> address)
   * Maps network name to wallet address on that network
   * 
   * NOTE: Addresses are stored ONLY in walletStore (the source of truth).
   * This field is optional - stores can retrieve addresses from walletStore on-the-fly
   * rather than storing them separately to avoid duplication and sync issues.
   * 
   * The walletStore stores addresses as: { [network]: { [accountIndex]: address } }
   * This field is the flattened view: { [network]: address } for a specific wallet.
   */
  addresses?: Record<string, string>

  /**
   * Timestamp when wallet was created (milliseconds since epoch)
   */
  createdAt: number

  /**
   * Timestamp when wallet was last updated (milliseconds since epoch)
   */
  updatedAt: number

  /**
   * Balances per network and token
   * Maps network name to token balances (tokenAddress -> balance)
   * tokenAddress is null for native tokens, use 'native' as key
   * Balance is stored as string to handle big numbers
   * 
   * NOTE: Balances are stored ONLY in walletStore (the source of truth).
   * This field is optional - stores can retrieve balances from walletStore on-the-fly
   * rather than storing them separately to avoid duplication and sync issues.
   * 
   * The walletStore stores balances as: { [network]: { [accountIndex]: { [tokenAddress]: balance } } }
   * This field is the flattened view: { [network]: { [tokenAddress]: balance } } for a specific wallet.
   */
  balances?: Record<string, Record<string, string>>

  /**
   * Last balance update timestamp per network
   * Maps network name to timestamp (milliseconds since epoch)
   * Used to track when balances were last fetched for each network
   * 
   * NOTE: This is stored in walletStore. This field is optional and computed from walletStore.
   */
  lastBalanceUpdate?: Record<string, number>

  /**
   * Balance loading states per network and token
   * Maps "network-tokenAddress" to loading state (true = loading, false/undefined = not loading)
   * Used to track which balances are currently being fetched
   * Note: tokenAddress is null for native tokens, use 'native' as key
   * 
   * NOTE: This is stored in walletStore. This field is optional and computed from walletStore.
   */
  balanceLoading?: Record<string, boolean>
}

/**
 * Wallet Store Interface
 *
 * Defines the interface that wallet stores should implement.
 * This allows wdk-rn-balance-fetcher to work with any store that implements this interface.
 *
 * Stores that implement this interface can be used with:
 * - Balance fetching (wdk-rn-balance-fetcher)
 * - Wallet management utilities
 *
 * NOTE: Balance management is worklet-level, not store-level.
 * Use WorkletService or useWallet hook for balance operations.
 *
 * Apps can extend this interface with app-specific methods.
 */
export interface WalletStore {
  /**
   * Get all wallets managed by this store
   */
  getAllWallets: () => Wallet[]

  /**
   * Call a method on a wallet account (worklet operation)
   * This allows balance fetching and other operations to interact with the worklet
   *
   * @param network - Network name (e.g., 'ethereum')
   * @param accountIndex - Account index
   * @param methodName - Method name to call (e.g., 'getBalance', 'getTokenBalance')
   * @param args - Optional arguments for the method (supports multiple arguments)
   * @returns Promise with the method result
   */
  callAccountMethod: <T = unknown>(
    network: string,
    accountIndex: number,
    methodName: string,
    ...args: unknown[]
  ) => Promise<T>

  /**
   * Check if the wallet is initialized (worklet is ready)
   */
  isWalletInitialized: () => boolean

  /**
   * Get a wallet by account index
   */
  getWallet?: (accountIndex: number) => Wallet | null

  /**
   * Update wallet address for a specific network
   */
  updateWalletAddress?: (accountIndex: number, network: string, address: string) => void

  /**
   * Index signature for compatibility with Record<string, unknown>
   */
  [key: string]: unknown
}

/**
 * Balance Fetching Types
 */

/**
 * Balance fetch result
 */
export interface BalanceFetchResult {
  success: boolean
  network: string
  accountIndex: number
  tokenAddress: string | null
  balance: string | null
  error?: string
}

/**
 * Token config provider
 * Apps can provide token configs directly or through a function
 */
export type TokenConfigProvider = TokenConfigs | (() => TokenConfigs)

/**
 * Token helper functions
 * Apps can provide custom implementations or use the default
 */
export interface TokenHelpers {
  /**
   * Get all tokens for a specific network (native + ERC20)
   */
  getTokensForNetwork: (network: string) => TokenConfig[]

  /**
   * Get all supported networks
   */
  getSupportedNetworks: () => string[]
}
