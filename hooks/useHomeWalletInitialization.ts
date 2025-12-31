/**
 * useHomeWalletInitialization Hook
 * 
 * Handles wallet initialization logic for the home screen.
 * Ensures main wallet exists and updates its name when currentUser data arrives.
 * Extracted from HomeContainer to improve maintainability.
 */

import { useEffect } from 'react';
import type { RumbleUser } from '@/api/types/channels';
import { useRumbleStore } from '@/stores/rumbleStore';
import { createLogger } from '@/utils/logger';

const walletInitLogger = createLogger('useHomeWalletInitialization');

interface UseHomeWalletInitializationParams {
  walletInitialized: boolean;
  currentUser?: RumbleUser;
}

/**
 * Hook to initialize main wallet and update its name
 */
export function useHomeWalletInitialization({
  walletInitialized,
  currentUser,
}: UseHomeWalletInitializationParams): void {
  const rumbleStore = useRumbleStore();

  // Initialize main wallet if it doesn't exist
  useEffect(() => {
    if (!walletInitialized) {
      walletInitLogger.debug('Waiting for wallet to initialize...');
      return;
    }

    const mainWalletExists = rumbleStore.getMainWallet();
    walletInitLogger.debug('Main wallet exists?', { exists: !!mainWalletExists });

    if (!mainWalletExists) {
      walletInitLogger.debug('Initializing main wallet immediately (user may load later)');
      // Initialize immediately - we'll use currentUser data when rendering
      const identifier = currentUser?.id || 'temp-wallet-id';
      const name = currentUser?.name || 'My Wallet';

      rumbleStore.initializeMainWallet(identifier, name);
      walletInitLogger.info('Main wallet initialized', { identifier, name });
    }
  }, [walletInitialized, currentUser, rumbleStore]);

  // Update main wallet name when currentUser data arrives
  useEffect(() => {
    if (currentUser && walletInitialized) {
      const mainWallet = rumbleStore.getMainWallet();
      if (mainWallet) {
        // Prefer title over name, fallback to name
        const newName = currentUser.title || currentUser.name;
        if (newName && mainWallet.name !== newName) {
          walletInitLogger.debug('Updating main wallet name', { newName });
          rumbleStore.updateWalletName(0, newName);
        }
      }
    }
  }, [currentUser, walletInitialized, rumbleStore]); // eslint-disable-line react-hooks/exhaustive-deps
}


