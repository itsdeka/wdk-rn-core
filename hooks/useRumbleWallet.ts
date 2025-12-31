/**
 * Rumble Wallet Hook
 * 
 * Integrates the Rumble wallet store (metadata) with the wallet store (addresses and balances).
 * This hook provides a unified interface for managing Rumble wallets (main wallet + tip jars).
 * 
 * Returns complete RumbleWallet objects that merge:
 * - Rumble-specific metadata from rumbleStore (type, identifier, name, accountIndex, etc.)
 * - Addresses from walletStore (by network and accountIndex)
 * - Balance data from walletStore (balances, lastBalanceUpdate, balanceLoading by network and accountIndex)
 * 
 * Each wallet has an identifier:
 * - Main wallet: Rumble username
 * - Tip jars: Channel identifier/name
 * 
 */
// React hooks
import { useCallback, useMemo } from 'react'

// Internal modules
import { useWallet, type Wallet } from '@tetherto/wdk-rn-core'

// Local imports
import { useRumbleStore } from '../stores/rumbleStore'
import type { RumbleWallet } from '../stores/rumbleStore'
import { createLogger } from '../utils/logger'
import { 
  getAddressesForWallet,
  getBalancesForWallet,
  getLastBalanceUpdateForWallet
} from '@/utils/wallet/addressUtils'

const rumbleWalletLogger = createLogger('useRumbleWallet')

// Flattens from { "network-accountIndex-tokenAddress": boolean } to { "network-tokenAddress": boolean }
const getBalanceLoadingForWallet = (
  accountIndex: number,
  balanceLoading: Record<string, boolean>
): Record<string, boolean> => {
  const result: Record<string, boolean> = {}
  
  Object.entries(balanceLoading).forEach(([key, loading]) => {
    // Key format: "network-accountIndex-tokenAddress"
    const parts = key.split('-')
    if (parts.length >= 3) {
      const keyAccountIndex = parseInt(parts[1], 10)
      if (keyAccountIndex === accountIndex) {
        // Reconstruct key without accountIndex: "network-tokenAddress"
        const network = parts[0]
        const tokenAddress = parts.slice(2).join('-') // Handle token addresses that might contain dashes
        const flattenedKey = `${network}-${tokenAddress}`
        result[flattenedKey] = loading
      }
    }
  })
  
  return result
}

export function useRumbleWallet() {
  const rumbleStore = useRumbleStore()
  const { 
    addresses, 
    isInitialized, 
    getAddress: useWalletGetAddress,
    callAccountMethod: useWalletCallAccountMethod,
    balances: walletStoreBalances,
    lastBalanceUpdate: walletStoreLastBalanceUpdate,
    balanceLoading: walletStoreBalanceLoading
  } = useWallet()
  
  // Handles Rumble-level network abstractions (e.g., bitcoin-spark)
  const getAddress = useCallback(
    async (network: string, accountIndex: number = 0) => {
      // Handle bitcoin-spark abstraction - map to sparkStaticDeposit
      if (network === 'bitcoin') {
        return useWalletCallAccountMethod<string>(
          'spark',
          accountIndex,
          'getStaticDepositAddress'
        )
      }
      
      if (network === 'sparkStaticDeposit') {
        return useWalletCallAccountMethod<string>(
          'spark',
          accountIndex,
          'getStaticDepositAddress'
        )
      }
      
      if (network === 'lightning') {
        const invoice = await useWalletCallAccountMethod<any>(
          'spark',
          accountIndex,
          'createLightningInvoice',
          {amountSats: 0}
        );
        return invoice.invoice.encodedInvoice;
      }
      
      return useWalletGetAddress(network, accountIndex)
    },
    [useWalletCallAccountMethod, useWalletGetAddress]
  )

  const getWalletAddress = useCallback(
    async (accountIndex: number, network: string) => {
      const cachedAddress = addresses[network]?.[accountIndex]
      if (cachedAddress) {
        return cachedAddress
      }

      if (isInitialized) {
        const address = await getAddress(network, accountIndex)
        return address
      }

      return null
    },
    [getAddress, isInitialized, addresses]
  )

  const getWalletAddressByIdentifier = useCallback(
    async (identifier: string, network: string) => {
      const wallet = rumbleStore.getWalletByIdentifier(identifier)
      if (!wallet) {
        return null
      }

      return getWalletAddress(wallet.accountIndex, network)
    },
    [getWalletAddress, rumbleStore]
  )

  const syncAddresses = useCallback(
    async (networks: string[]) => {
      if (!isInitialized) return

      const allWallets = rumbleStore.getAllWallets()
      
      await Promise.all(
        allWallets.flatMap((wallet: Wallet) =>
          networks.map(async (network) => {
            try {
              await getAddress(network, wallet.accountIndex)
            } catch (error) {
              rumbleWalletLogger.error('Failed to fetch address for wallet', {
                accountIndex: wallet.accountIndex,
                network,
                error,
              })
            }
          })
        )
      )
    },
    [getAddress, isInitialized, rumbleStore]
  )

  const createTipJarWithAddresses = useCallback(
    async (identifier: string, name: string, networks?: string[]) => {
      const accountIndex = rumbleStore.createTipJar(identifier, name)
      
      if (networks && networks.length > 0 && isInitialized) {
        await Promise.all(
          networks.map(async (network) => {
            try {
              await getAddress(network, accountIndex)
            } catch (error) {
              rumbleWalletLogger.error('Failed to get address for new tip jar', {
                accountIndex,
                network,
                error,
              })
            }
          })
        )
      }
      
      return accountIndex
    },
    [getAddress, isInitialized, rumbleStore]
  )

  const getWallet = useCallback(
    (accountIndex: number): RumbleWallet | null => {
      const wallet = rumbleStore.getWallet(accountIndex)
      if (!wallet) return null
      
      const walletAddresses = getAddressesForWallet(addresses, accountIndex)
      const walletBalances = getBalancesForWallet(walletStoreBalances, accountIndex)
      const walletLastBalanceUpdate = getLastBalanceUpdateForWallet(walletStoreLastBalanceUpdate, accountIndex)
      const walletBalanceLoading = getBalanceLoadingForWallet(accountIndex, walletStoreBalanceLoading || {})
      
      return {
        ...wallet,
        addresses: walletAddresses,
        balances: walletBalances,
        lastBalanceUpdate: walletLastBalanceUpdate,
        balanceLoading: walletBalanceLoading,
      }
    },
    [rumbleStore, addresses, walletStoreBalances, walletStoreLastBalanceUpdate, walletStoreBalanceLoading]
  )

  const getMainWallet = useCallback((): RumbleWallet | null => {
    const wallet = rumbleStore.getMainWallet()
    if (!wallet) return null
    
    const walletAddresses = getAddressesForWallet(addresses, 0)
    const walletBalances = getBalancesForWallet(walletStoreBalances, 0)
    const walletLastBalanceUpdate = getLastBalanceUpdateForWallet(walletStoreLastBalanceUpdate, 0)
    const walletBalanceLoading = getBalanceLoadingForWallet(0, walletStoreBalanceLoading || {})
    
    return {
      ...wallet,
      addresses: walletAddresses,
      balances: walletBalances,
      lastBalanceUpdate: walletLastBalanceUpdate,
      balanceLoading: walletBalanceLoading,
    }
  }, [rumbleStore, addresses, walletStoreBalances, walletStoreLastBalanceUpdate, walletStoreBalanceLoading])

  const getTipJar = useCallback(
    (accountIndex: number): RumbleWallet | null => {
      const wallet = rumbleStore.getTipJar(accountIndex)
      if (!wallet) return null
      
      const walletAddresses = getAddressesForWallet(addresses, accountIndex)
      const walletBalances = getBalancesForWallet(walletStoreBalances, accountIndex)
      const walletLastBalanceUpdate = getLastBalanceUpdateForWallet(walletStoreLastBalanceUpdate, accountIndex)
      const walletBalanceLoading = getBalanceLoadingForWallet(accountIndex, walletStoreBalanceLoading || {})
      
      return {
        ...wallet,
        addresses: walletAddresses,
        balances: walletBalances,
        lastBalanceUpdate: walletLastBalanceUpdate,
        balanceLoading: walletBalanceLoading,
      }
    },
    [rumbleStore, addresses, walletStoreBalances, walletStoreLastBalanceUpdate, walletStoreBalanceLoading]
  )

  const getTipJarByIdentifier = useCallback(
    (identifier: string): RumbleWallet | null => {
      const wallet = rumbleStore.getTipJarByIdentifier(identifier)
      if (!wallet) return null
      
      const walletAddresses = getAddressesForWallet(addresses, wallet.accountIndex)
      const walletBalances = getBalancesForWallet(walletStoreBalances, wallet.accountIndex)
      const walletLastBalanceUpdate = getLastBalanceUpdateForWallet(walletStoreLastBalanceUpdate, wallet.accountIndex)
      const walletBalanceLoading = getBalanceLoadingForWallet(wallet.accountIndex, walletStoreBalanceLoading || {})
      
      return {
        ...wallet,
        addresses: walletAddresses,
        balances: walletBalances,
        lastBalanceUpdate: walletLastBalanceUpdate,
        balanceLoading: walletBalanceLoading,
      }
    },
    [rumbleStore, addresses, walletStoreBalances, walletStoreLastBalanceUpdate, walletStoreBalanceLoading]
  )

  const getWalletByIdentifier = useCallback(
    (identifier: string): RumbleWallet | null => {
      const wallet = rumbleStore.getWalletByIdentifier(identifier)
      if (!wallet) return null
      
      const walletAddresses = getAddressesForWallet(addresses, wallet.accountIndex)
      const walletBalances = getBalancesForWallet(walletStoreBalances, wallet.accountIndex)
      const walletLastBalanceUpdate = getLastBalanceUpdateForWallet(walletStoreLastBalanceUpdate, wallet.accountIndex)
      const walletBalanceLoading = getBalanceLoadingForWallet(wallet.accountIndex, walletStoreBalanceLoading || {})
      
      return {
        ...wallet,
        addresses: walletAddresses,
        balances: walletBalances,
        lastBalanceUpdate: walletLastBalanceUpdate,
        balanceLoading: walletBalanceLoading,
      }
    },
    [rumbleStore, addresses, walletStoreBalances, walletStoreLastBalanceUpdate, walletStoreBalanceLoading]
  )

  const getAllTipJars = useCallback((): RumbleWallet[] => {
    return rumbleStore.getAllTipJars().map((tipJar: RumbleWallet) => {
      const walletAddresses = getAddressesForWallet(addresses, tipJar.accountIndex)
      const walletBalances = getBalancesForWallet(walletStoreBalances, tipJar.accountIndex)
      const walletLastBalanceUpdate = getLastBalanceUpdateForWallet(walletStoreLastBalanceUpdate, tipJar.accountIndex)
      const walletBalanceLoading = getBalanceLoadingForWallet(tipJar.accountIndex, walletStoreBalanceLoading || {})
      
      return {
        ...tipJar,
        addresses: walletAddresses,
        balances: walletBalances,
        lastBalanceUpdate: walletLastBalanceUpdate,
        balanceLoading: walletBalanceLoading,
      }
    })
  }, [rumbleStore, addresses, walletStoreBalances, walletStoreLastBalanceUpdate, walletStoreBalanceLoading])

  const allWallets = useMemo(() => {
    const wallets = rumbleStore.getAllWallets()
    return wallets.map((wallet: Wallet) => {
      const walletAddresses = getAddressesForWallet(addresses, wallet.accountIndex)
      const walletBalances = getBalancesForWallet(walletStoreBalances, wallet.accountIndex)
      const walletLastBalanceUpdate = getLastBalanceUpdateForWallet(walletStoreLastBalanceUpdate, wallet.accountIndex)
      const walletBalanceLoading = getBalanceLoadingForWallet(wallet.accountIndex, walletStoreBalanceLoading || {})
      
      return {
        ...wallet,
        addresses: walletAddresses,
        balances: walletBalances,
        lastBalanceUpdate: walletLastBalanceUpdate,
        balanceLoading: walletBalanceLoading,
      }
    })
  }, [rumbleStore.mainWallet, rumbleStore.tipJars, addresses, walletStoreBalances, walletStoreLastBalanceUpdate, walletStoreBalanceLoading])

  return {
    mainWallet: rumbleStore.mainWallet,
    tipJars: rumbleStore.tipJars,
    allWallets,
    initializeMainWallet: rumbleStore.initializeMainWallet,
    createTipJar: rumbleStore.createTipJar,
    createTipJarWithAddresses,
    updateWalletName: rumbleStore.updateWalletName,
    getWallet,
    getMainWallet,
    getTipJar,
    getTipJarByIdentifier,
    getWalletByIdentifier,
    getAllTipJars,
    deleteTipJar: rumbleStore.deleteTipJar,
    addresses,
    getAddress,
    getWalletAddress,
    getWalletAddressByIdentifier,
    syncAddresses,
    isInitialized,
    callAccountMethod: useWalletCallAccountMethod,
  }
}

