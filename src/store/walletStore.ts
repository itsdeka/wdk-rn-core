/**
 * Wallet Store - Source of Truth for Wallet Data
 * 
 * IMPORTANT: This is the ONLY place where addresses and balances are actually stored.
 * 
 * - walletStore.ts: Stores addresses and balances
 *   - Addresses: { [network]: { [accountIndex]: address } }
 *   - Balances: { [network]: { [accountIndex]: { [tokenAddress]: balance } } }
 * - types.ts: All type definitions (network, token, and wallet types)
 * - utils/walletUtils.ts: Helper functions to retrieve data from walletStore
 * - services/addressService.ts: Address operations (getAddress, callAccountMethod)
 * - services/balanceService.ts: Balance operations (updateBalance, getBalance, etc.)
 * 
 * Addresses and balances are persisted here and retrieved by wallet stores on-the-fly.
 * All operations are handled by focused services (AddressService, BalanceService), not the store itself.
 */

// External packages
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

// Local imports
import type {
  WalletAddresses,
  WalletBalances,
  BalanceLoadingStates,
} from '../types'
import { createMMKVStorageAdapter } from '../storage/mmkvStorage'
import { log } from '../utils/logger'

export interface WalletLoadingStates {
  [key: string]: boolean
}

export interface WalletState {
  // SOURCE OF TRUTH - addresses stored ONLY here
  addresses: WalletAddresses
  walletLoading: WalletLoadingStates
  // SOURCE OF TRUTH - balances stored ONLY here
  balances: WalletBalances
  // Maps "network-accountIndex-tokenAddress" -> boolean
  balanceLoading: BalanceLoadingStates
  lastBalanceUpdate: Record<string, Record<number, number>>
}

export type WalletStore = WalletState

type WalletStoreInstance = ReturnType<ReturnType<typeof create<WalletStore>>>

const initialState: WalletState = {
  addresses: {},
  walletLoading: {},
  balances: {},
  balanceLoading: {},
  lastBalanceUpdate: {},
}

const defaultStorageAdapter = createMMKVStorageAdapter()

let walletStoreInstance: WalletStoreInstance | null = null

/**
 * Creates singleton wallet store instance.
 * All operations are handled by focused services (AddressService, BalanceService), not the store itself.
 */
export function createWalletStore(): WalletStoreInstance {
  if (walletStoreInstance) {
    return walletStoreInstance
  }

  const store = create<WalletStore>()(
    persist(
      () => ({
        ...initialState,
      }),
      {
        name: 'wallet-storage',
        storage: createJSONStorage(() => defaultStorageAdapter),
        partialize: (state) => ({
          addresses: state.addresses,
          balances: state.balances,
          balanceLoading: {},
          lastBalanceUpdate: state.lastBalanceUpdate,
        }),
        onRehydrateStorage: () => {
          return (state) => {
            if (state) {
              log('🔄 Rehydrating wallet state - resetting loading states')
              state.walletLoading = {}
              state.balanceLoading = {}
            }
          }
        },
      }
    )
  )

  walletStoreInstance = store
  return store
}

export function getWalletStore() {
  return createWalletStore()
}

