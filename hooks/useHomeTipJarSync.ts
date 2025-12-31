/**
 * useHomeTipJarSync Hook
 * 
 * Handles syncing tip jars with channels from the backend.
 * Ensures all channels have corresponding tip jars and removes tip jars for deleted channels.
 * Extracted from HomeContainer to improve maintainability.
 */

import { useEffect } from 'react';
import type { RumbleChannel } from '@/api/types/channels';
import { useRumbleStore } from '@/stores/rumbleStore';
import { createLogger } from '@/utils/logger';

const tipJarSyncLogger = createLogger('useHomeTipJarSync');

interface UseHomeTipJarSyncParams {
  channels: RumbleChannel[];
  walletInitialized: boolean;
}

/**
 * Hook to sync tip jars with channels
 */
export function useHomeTipJarSync({
  channels,
  walletInitialized,
}: UseHomeTipJarSyncParams): void {
  const rumbleStore = useRumbleStore();

  useEffect(() => {
    if (channels && channels.length > 0 && walletInitialized) {
      const tipJars = rumbleStore.getAllTipJars();

      tipJarSyncLogger.debug('Ensuring all channels have tip jars', {
        channelsCount: channels.length,
        tipJarsCount: tipJars.length,
      });

      channels.forEach((channel: RumbleChannel) => {
        // Check if tip jar already exists for this channel
        const existingTipJar = tipJars.find((jar) => jar.identifier === channel.id);

        if (!existingTipJar) {
          // Create tip jar for this channel
          const tipJarName = channel.title || channel.name;
          tipJarSyncLogger.debug('Creating tip jar for channel', {
            channelId: channel.id,
            tipJarName,
          });

          try {
            const accountIndex = rumbleStore.createTipJar(channel.id, tipJarName);
            tipJarSyncLogger.info('Created tip jar', {
              accountIndex,
              identifier: channel.id,
              name: tipJarName,
            });
          } catch (error) {
            tipJarSyncLogger.error('Failed to create tip jar for channel', { channelId: channel.id, error });
          }
        } else {
          // Update name if needed
          const expectedName = channel.title || channel.name;
          if (expectedName && existingTipJar.name !== expectedName) {
            tipJarSyncLogger.debug('Updating existing tip jar name', {
              accountIndex: existingTipJar.accountIndex,
              identifier: existingTipJar.identifier,
              oldName: existingTipJar.name,
              newName: expectedName,
            });
            rumbleStore.updateWalletName(existingTipJar.accountIndex, expectedName);
          }
        }
      });

      // Clean up tip jars that no longer have corresponding channels
      // Don't delete unrelated wallets (type='unrelated') - they don't need channels
      tipJars.forEach((tipJar) => {
        // Skip unrelated wallets - they don't need to match channels
        if (tipJar.type === 'unrelated') {
          return;
        }
        
        const hasChannel = channels.some((channel: RumbleChannel) => channel.id === tipJar.identifier);
        if (!hasChannel) {
          tipJarSyncLogger.debug('Removing tip jar for deleted channel', {
            accountIndex: tipJar.accountIndex,
            identifier: tipJar.identifier,
            name: tipJar.name,
          });
          rumbleStore.deleteTipJar(tipJar.accountIndex);
        }
      });
    }
  }, [channels, walletInitialized, rumbleStore]); // eslint-disable-line react-hooks/exhaustive-deps
}


