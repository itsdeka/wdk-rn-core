/**
 * @tetherto/wdk-rn-core
 * 
 * Core functionality for React Native wallets
 * Provides wallet management, balance fetching, and worklet operations
 */

// Core Types (Network, Token, and Wallet types)
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

// HRPC Type Extensions (for extending HRPC functionality)
export type { ExtendedHRPC } from './types/hrpc'
export { isExtendedHRPC, asExtendedHRPC } from './types/hrpc'

// Provider (main entry point)
export { WdkAppProvider } from './provider/WdkAppProvider'
export type { WdkAppProviderProps, WdkAppContextValue } from './provider/WdkAppProvider'

// Hooks (public API)
export { useWorklet } from './hooks/useWorklet'
export { useWallet } from './hooks/useWallet'
export { useWalletSetup } from './hooks/useWalletSetup'
export { useWdkApp } from './hooks/useWdkApp'
export { useBalanceFetcher } from './hooks/useBalanceFetcher'

// Validation Utilities (for validating configs before use)
export { 
  validateNetworkConfigs, 
  validateTokenConfigs, 
  validateBalanceRefreshInterval,
  validateAccountIndex,
  validateTokenAddress,
} from './utils/validation'

// Type Guards (for runtime type checking)
export { 
  isNetworkConfigs, 
  isTokenConfigs,
  isEthereumAddress,
  isValidAccountIndex,
  isValidNetworkName,
} from './utils/typeGuards'

// Utility Functions
export { validateMnemonic } from './utils/mnemonicUtils'
export { convertBalanceToString, formatBalance } from './utils/balanceUtils'
export { normalizeError, getErrorMessage, isErrorType, createContextualError } from './utils/errorUtils'

// Result Type (for error handling patterns)
export type { Result } from './utils/result'
export { ok, err, toResult, toResultSync } from './utils/result'

