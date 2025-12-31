/**
 * useTipJarManagement Hook
 * 
 * Handles tip jar activation/deactivation and syncing with backend
 */

import { useCallback } from 'react';
import { useRumbleStore } from '@/stores/rumbleStore';
import { useToggleJarActivation } from '@/queries/wallet';
import { syncWalletsWithBackend } from '@/services/wallet/walletSyncService';
import { createLogger } from '@/utils/logger';
import type { Wallet } from '@/api/types/wallet';

const logger = createLogger('hooks/useTipJarManagement');

export interface UseTipJarManagementParams {
  backendWallets: Wallet[];
  isLoadingWallets: boolean;
  refetchWallets: () => void;
}

export function useTipJarManagement(params: UseTipJarManagementParams) {
  const { backendWallets, isLoadingWallets, refetchWallets } = params;
  const rumbleStore = useRumbleStore();
  const { mutate: toggleJarActivation, isPending: isTogglingJar } = useToggleJarActivation();

  /**
   * Sync tip jars with backend wallets
   */
  const syncTipJars = useCallback(async () => {
    if (isLoadingWallets || !backendWallets.length) {
      return;
    }

    try {
      await syncWalletsWithBackend('none');
      logger.debug('Tip jars synced with backend');
    } catch (error) {
      logger.error('Failed to sync tip jars with backend', error);
    }
  }, [isLoadingWallets]);

  /**
   * Toggle tip jar activation
   */
  const toggleJar = useCallback((walletId: string, enabled: boolean) => {
    toggleJarActivation(
      { walletId, enabled },
      {
        onSuccess: () => {
          logger.info('Tip jar activation toggled', { walletId, enabled });
          refetchWallets();
        },
        onError: (error) => {
          logger.error('Failed to toggle tip jar activation', error);
        },
      }
    );
  }, [toggleJarActivation, refetchWallets]);

  return {
    syncTipJars,
    toggleJar,
    isTogglingJar,
  };
}

