/**
 * useChannelSync Hook
 * 
 * Handles syncing channels to tip jars in the wallet store
 */

import { useEffect, useRef } from 'react';
import { useWallet } from '@tetherto/wdk-rn-core';
import { useRumbleStore } from '@/stores/rumbleStore';
import { syncChannelsAsTipJars } from '@/services/wallet/walletSyncService';
import type { RumbleChannel } from '@/api/types/channels';
import { createLogger } from '@/utils/logger';

const logger = createLogger('hooks/useChannelSync');

/**
 * Sync channels to tip jars when channels data changes
 */
export function useChannelSync(
  channels: RumbleChannel[] | undefined,
  walletInitialized: boolean
): void {
  const rumbleStore = useRumbleStore();
  const { addresses } = useWallet();
  const prevChannelsRef = useRef<RumbleChannel[]>([]);

  useEffect(() => {
    if (!channels || !walletInitialized) {
      return;
    }

    // Compare by IDs to avoid syncing same data
    const currentIds = channels.map(c => c.id).sort().join(',');
    const prevIds = prevChannelsRef.current.map(c => c.id).sort().join(',');

    if (currentIds !== prevIds) {
      logger.debug('Channels changed, syncing to tip jars', {
        channelCount: channels.length,
        channelIds: channels.map(c => c.id),
      });

      syncChannelsAsTipJars(addresses).catch((error) => {
        logger.error('Failed to sync channels to tip jars', error);
      });

      prevChannelsRef.current = channels;
    }
  }, [channels, walletInitialized, rumbleStore, addresses]);
}

