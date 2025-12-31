/**
 * useHomeStoreSync Hook
 * 
 * Handles syncing query data to rumbleStore.
 * Syncs currentUser and channels to rumbleStore when data changes.
 * Uses refs to prevent unnecessary syncing.
 * Extracted from HomeContainer to improve maintainability.
 */

import { useEffect, useRef } from 'react';
import type { RumbleChannel, RumbleUser } from '@/api/types/channels';
import { useRumbleStore } from '@/stores/rumbleStore';
import { createLogger } from '@/utils/logger';

const storeSyncLogger = createLogger('useHomeStoreSync');

interface UseHomeStoreSyncParams {
  currentUser?: RumbleUser;
  channels?: RumbleChannel[];
}

/**
 * Hook to sync currentUser and channels to rumbleStore
 */
export function useHomeStoreSync({
  currentUser,
  channels,
}: UseHomeStoreSyncParams): void {
  const rumbleStore = useRumbleStore();

  // Track previous values to avoid unnecessary syncing
  const prevCurrentUserRef = useRef<string | null>(null);
  const prevChannelsRef = useRef<string[]>([]);

  // Sync currentUser to rumbleStore when query data is available and changed
  useEffect(() => {
    if (currentUser && currentUser.id !== prevCurrentUserRef.current) {
      storeSyncLogger.debug('Syncing currentUser to rumbleStore', { userId: currentUser.id });
      rumbleStore.setCurrentUser(currentUser);
      prevCurrentUserRef.current = currentUser.id;
    }
  }, [currentUser, rumbleStore]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync channels to rumbleStore when query data is available and changed
  useEffect(() => {
    // Only sync if channels is defined and different from previous value
    if (channels) {
      // Compare by IDs to avoid syncing same data
      const currentIds = channels.map((c: RumbleChannel) => c.id).sort().join(',');
      const prevIds = prevChannelsRef.current.map((c: string) => c).sort().join(',');

      if (currentIds !== prevIds) {
        storeSyncLogger.debug('Syncing channels to rumbleStore', { channelCount: channels.length });
        rumbleStore.setChannels(channels);
        prevChannelsRef.current = channels.map((c: RumbleChannel) => c.id);
      }
    }
  }, [channels, rumbleStore]); // eslint-disable-line react-hooks/exhaustive-deps
}


