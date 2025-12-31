/**
 * Hook to prefetch transaction history in the background
 * Similar to useHomeAddressSync, this fetches transactions for main wallet addresses
 */

import { useEffect } from 'react';
import { useRumbleWallet } from './useRumbleWallet';
import { useQueryClient } from '@tanstack/react-query';
import { transactionQueryKeys } from '@/queries/transactions';
import { createLogger } from '@/utils/logger';
import { useAuthStore } from '@/stores/authStore';

const transactionSyncLogger = createLogger('useHomeTransactionSync');

interface UseHomeTransactionSyncParams {
  walletInitialized: boolean;
}

/**
 * Hook to prefetch transaction history for main wallet addresses
 * Fetches USDT transactions for primary networks (ethereum, polygon, arbitrum)
 */
export function useHomeTransactionSync({
  walletInitialized,
}: UseHomeTransactionSyncParams): void {
  const queryClient = useQueryClient();
  const authStore = useAuthStore();
  const rumbleWallet = useRumbleWallet();
  const { getMainWallet, isInitialized } = rumbleWallet;

  useEffect(() => {
    if (!walletInitialized || !isInitialized || !authStore.isAuthenticated()) {
      return;
    }

    const mainWallet = getMainWallet();
    if (!mainWallet?.addresses) {
      return;
    }

    transactionSyncLogger.debug('Prefetching transaction history for main wallet');

    // Prefetch USDT transactions for primary networks
    const networksToFetch = ['ethereum', 'polygon', 'arbitrum'] as const;
    const token = 'usdt';
    const addresses = mainWallet.addresses;

    networksToFetch.forEach((network) => {
      const address = addresses[network];
      if (address) {
        // Prefetch the query (this will cache it for when the holdings page needs it)
        queryClient.prefetchQuery({
          queryKey: transactionQueryKeys.tokenTransfers(network, token, address, { limit: 20 }),
          queryFn: async () => {
            // Import dynamically to avoid circular dependencies
            const { getTokenTransfers } = await import('@/services/transactions/transactionHistoryService');
            return getTokenTransfers(network, token, address, { limit: 20 });
          },
          staleTime: 2 * 60 * 1000, // 2 minutes
        }).catch((error) => {
          // Log but don't throw - this is a background prefetch
          transactionSyncLogger.debug(`Failed to prefetch transactions for ${network}`, { error });
        });
      }
    });
  }, [walletInitialized, isInitialized, getMainWallet, queryClient, authStore]);
}

