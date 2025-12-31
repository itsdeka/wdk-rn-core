import { useEffect, useState } from 'react'
import { defaultNetworkConfigs } from '@/config/walletConfig'
import { createLogger } from '@/utils/logger'

const walletInitLogger = createLogger('useWalletInitialization')

/**
 * Manages wallet initialization state and automatically fetches addresses and balances.
 */
export function useWalletInitialization(
  hasWallet: () => Promise<boolean>,
  isInitialized: boolean,
  walletInitialized: boolean,
  addresses: Record<string, Record<number, string>>,
  getAddress: (network: string, accountIndex: number) => Promise<string>,
) {
  const [walletExists, setWalletExists] = useState<boolean | null>(null)
  const [addressesFetched, setAddressesFetched] = useState(false)
  const [balancesFetched, setBalancesFetched] = useState(false)

  useEffect(() => {
    hasWallet().then(setWalletExists).catch(() => setWalletExists(false))
  }, [hasWallet])

  useEffect(() => {
    walletInitLogger.debug('useEffect triggered', {
      isInitialized,
      walletInitialized,
      addressesFetched,
      hasAddresses: Object.keys(addresses).length > 0
    });
    
    if (isInitialized && walletInitialized && !addressesFetched) {
      walletInitLogger.debug('Conditions met - starting address fetch');
      setAddressesFetched(true)
      const networks = Object.keys(defaultNetworkConfigs)
      walletInitLogger.debug('Networks to fetch', { networks });

      const fetchAddressesSequentially = async () => {
        walletInitLogger.debug('fetchAddressesSequentially START');
        
        for (const network of networks) {
          if (!addresses[network]?.[0]) {
            try {
              walletInitLogger.debug('Fetching address', { network });
              await getAddress(network, 0)
              walletInitLogger.debug('Successfully fetched address', { network });
            } catch (err) {
              walletInitLogger.error('Failed to fetch address', { network, error: err });
            }
          } else {
            walletInitLogger.debug('Address already cached, skipping', { network });
          }
        }

        // Fetch required address types for each wallet
        const requiredAddresses = ['lightning', 'spark', 'sparkStaticDeposit'];
        walletInitLogger.debug('Fetching required addresses', { requiredAddresses });
        for (const addressType of requiredAddresses) {
          if (!addresses[addressType]?.[0]) {
            try {
              walletInitLogger.debug('Fetching required address', { addressType });
              await getAddress(addressType, 0)
              walletInitLogger.debug('Successfully fetched required address', { addressType });
            } catch (err) {
              walletInitLogger.error('Failed to fetch required address', { addressType, error: err });
            }
          } else {
            walletInitLogger.debug('Required address already cached, skipping', { addressType });
          }
        }
        walletInitLogger.debug('fetchAddressesSequentially END');
      }

      fetchAddressesSequentially()
    }
    if (!isInitialized || !walletInitialized) {
      walletInitLogger.debug('Wallet not initialized, resetting addressesFetched');
      setAddressesFetched(false)
    }
  }, [isInitialized, walletInitialized, addresses, getAddress, addressesFetched])

  return {
    walletExists,
    addressesFetched
  }
}

