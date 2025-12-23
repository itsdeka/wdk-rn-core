/**
 * @tetherto/wdk-rn-worklet
 * 
 * Worklet functionality for React Native wallets
 * Provides worklet store, hooks, and services for wallet operations
 */

// Types (Network, Token, and Wallet types)
export type {
  NetworkConfig,
  NetworkConfigs,
  TokenConfig,
  NetworkTokens,
  TokenConfigs,
  Wallet,
  WalletAddresses,
  WalletBalances,
  BalanceLoadingStates,
  BalanceFetchResult,
  TokenConfigProvider,
  TokenHelpers,
} from './types'

// Storage (for Zustand persistence - non-sensitive data)
export type { StorageAdapter } from './storage/mmkvStorage'
export { createMMKVStorage, createMMKVStorageAdapter } from './storage/mmkvStorage'

// Store
export { createWorkletStore, getWorkletStore } from './store/workletStore'
export type {
  WorkletStore,
  WorkletState,
} from './store/workletStore'
export { createWalletStore, getWalletStore } from './store/walletStore'
export type {
  WalletStore,
  WalletState,
  WalletLoadingStates,
} from './store/walletStore'

// Services
export { WorkletService } from './services/workletService'
export { WalletSetupService } from './services/walletSetupService'

// Wallet Utils
export { createBaseWalletStore } from './utils/walletUtils'

// Hooks
export { useWorklet } from './hooks/useWorklet'
export { useWallet } from './hooks/useWallet'
export { useWalletSetup } from './hooks/useWalletSetup'
export { useWdkApp } from './hooks/useWdkApp'
export { useBalanceFetcher } from './hooks/useBalanceFetcher'

// Provider
export { WdkAppProvider } from './provider/WdkAppProvider'
export type { WdkAppProviderProps, WdkAppContextValue } from './provider/WdkAppProvider'

// Utils
export { validateMnemonic } from './utils/mnemonicUtils'
export { convertBalanceToString, formatBalance } from './utils/balanceUtils'

