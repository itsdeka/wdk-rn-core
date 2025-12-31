/**
 * useHomeAddressSync Hook
 * 
 * Handles fetching wallet addresses for all networks when wallet is initialized.
 * Extracted from HomeContainer to improve maintainability.
 */

import { useEffect } from 'react';
import { useWallet } from '@tetherto/wdk-rn-core';
import { defaultNetworkConfigs } from '@/config/networks';
import { useAuthStore } from '@/stores/authStore';
import { createLogger } from '@/utils/logger';

const addressSyncLogger = createLogger('useHomeAddressSync');

interface UseHomeAddressSyncParams {
  walletInitialized: boolean;
  addresses: Record<string, Record<number, string>>;
  getAddress: (network: string, accountIndex: number) => Promise<string>;
}

/**
 * Hook to sync wallet addresses for all networks
 */
export function useHomeAddressSync({
  walletInitialized,
  addresses,
  getAddress,
}: UseHomeAddressSyncParams): void {
  const authStore = useAuthStore();
  const { addresses: walletAddresses } = useWallet();

  useEffect(() => {
    addressSyncLogger.debug('useEffect triggered for address fetch', {
      isAuthenticated: authStore.isAuthenticated(),
      walletInitialized,
      hasAddresses: Object.keys(addresses).length > 0
    });
    
    // Don't fetch addresses if user is not authenticated or wallet is not initialized
    if (!authStore.isAuthenticated() || !walletInitialized) {
      addressSyncLogger.debug('Skipping address fetch - not authenticated or wallet not initialized');
      return;
    }

    addressSyncLogger.debug('Starting address fetch process');
    let cancelled = false;

    const fetchAddresses = async () => {
      addressSyncLogger.debug('fetchAddresses START');
      
      if (cancelled || !authStore.isAuthenticated() || !walletInitialized) {
        addressSyncLogger.debug('Cancelled or not valid, returning');
        return;
      }
      
      const networks = Object.keys(defaultNetworkConfigs);
      addressSyncLogger.debug('Fetching addresses for networks', { networks });
      addressSyncLogger.debug('Current addresses state', { networkCount: Object.keys(addresses).length });

      for (const network of networks) {
        // Check again before each network fetch - user might have logged out
        if (cancelled || !authStore.isAuthenticated() || !walletInitialized) {
          addressSyncLogger.debug('Cancelling address fetch - user logged out or wallet not initialized');
          return;
        }

        if (!addresses[network]?.[0]) {
          try {
            addressSyncLogger.debug(`Requesting address for ${network}...`);
            const address = await getAddress(network, 0);
            addressSyncLogger.debug(`Fetched address for ${network}`, { hasAddress: !!address });
          } catch (err) {
            // Only log errors if we're still authenticated and initialized
            // This prevents logging errors after logout
            if (authStore.isAuthenticated() && walletInitialized) {
              addressSyncLogger.error(`Failed to fetch address for ${network}`, err);
            }
          }
        } else {
          addressSyncLogger.debug(`Address for ${network} already cached, skipping`);
        }
      }

      // Only log final state if we're still authenticated
      if (!cancelled && authStore.isAuthenticated() && walletInitialized) {
        addressSyncLogger.debug('Final addresses after fetch', { networkCount: Object.keys(walletAddresses).length });
      }
      addressSyncLogger.debug('fetchAddresses END');
    };

    fetchAddresses();

    // Cleanup function to cancel pending operations
    return () => {
      cancelled = true;
    };
  }, [walletInitialized, getAddress, authStore, addresses, walletAddresses]);
}

