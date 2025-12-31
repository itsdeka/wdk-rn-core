/**
 * useTipJarSelection Hook
 *
 * Custom hook to encapsulate tip jar selection logic.
 * Maps channels to tip jar items with enabled/disabled state.
 * Handles toggle operations and loading states.
 */

import { useMemo, useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useChannels } from '@/queries/channels';
import { useWallets, useToggleJarActivation } from '@/queries/wallet';
import { useRumbleWallet } from '@/hooks/useRumbleWallet';
import type { RumbleChannel } from '@/api/types/channels';
import type { TipJarItem } from '@/app/sections/wallet';

export interface UseTipJarSelectionReturn {
  /** Tip jar items with state for each channel */
  tipJarItems: TipJarItem[];
  /** Handler for toggling a tip jar */
  handleToggle: (channelId: string) => void;
  /** Whether wallets are loading */
  isLoadingWallets: boolean;
  /** Refetch wallets */
  refetchWallets: () => void;
}

/**
 * useTipJarSelection Hook
 *
 * Encapsulates the logic for:
 * - Mapping channels to tip jars
 * - Determining enabled/disabled state
 * - Handling toggle operations
 * - Managing loading states
 */
export function useTipJarSelection(): UseTipJarSelectionReturn {
  const { data: channelsQuery = [], isLoading: isLoadingChannels } = useChannels();
  const { data: backendWallets = [], isLoading: isLoadingWallets, refetch: refetchWallets } = useWallets();
  const { getAllTipJars } = useRumbleWallet();
  const { mutate: toggleJarActivation, isPending: isTogglingJar } = useToggleJarActivation();

  const [togglingJarId, setTogglingJarId] = useState<string | null>(null);

  const allTipJars = getAllTipJars();

  // Map channels to tip jar items
  // Include all channels, even if they don't have tip jars yet
  const tipJarItems = useMemo(() => {
    return channelsQuery
      .map((channel: RumbleChannel) => {
        const tipJar = allTipJars.find((jar) => jar.identifier === channel.id);
        
        // If no tip jar exists, show channel as disabled
        if (!tipJar) {
          return {
            id: channel.id,
            name: channel.title || channel.name,
            isVerified: true,
            followerCount: channel.follower_count || 0,
            isChannelDeleted: channel.isDeleted || false,
            isEnabled: false,
            isDisabled: true, // Disabled because no tip jar exists
            isLoading: false,
          };
        }

        // For tip jars (type === 'channel'), match only by channelId
        // Backend wallets for channels don't have accountIndex - they're identified by channelId only
        const backendWallet = backendWallets.find(
          (w) => w.type === 'channel' && w.channelId === channel.id
        );

        const walletId = backendWallet?.id;
        const isEnabled = backendWallet?.enabled ?? true;

        return {
          id: channel.id,
          name: channel.title || channel.name,
          isVerified: true,
          followerCount: channel.follower_count || 0,
          isChannelDeleted: channel.isDeleted || false,
          isEnabled: walletId ? isEnabled : false,
          isDisabled: !walletId,
          isLoading: togglingJarId === channel.id && isTogglingJar,
        };
      });
  }, [channelsQuery, allTipJars, backendWallets, togglingJarId, isTogglingJar]);

  const handleToggle = useCallback(
    (channelId: string) => {
      const tipJarItem = tipJarItems.find((item) => item.id === channelId);
      if (!tipJarItem) {
        Alert.alert('Error', 'Tip jar not found. Please try refreshing the page.');
        return;
      }

      // Find the corresponding tip jar and backend wallet
      const channel = channelsQuery.find((c) => c.id === channelId);
      if (!channel) {
        Alert.alert('Error', 'Channel not found.');
        return;
      }

      const tipJar = allTipJars.find((jar) => jar.identifier === channelId);
      if (!tipJar) {
        Alert.alert('Error', 'Tip jar not found.');
        return;
      }

      const backendWallet = backendWallets.find(
        (w) => w.channelId === channelId && w.accountIndex === tipJar.accountIndex
      );

      if (!backendWallet?.id) {
        if (!isLoadingWallets) {
          refetchWallets();
        }
        
        Alert.alert(
          'Error',
          'Unable to toggle this tip jar. The wallet may not be synced with the backend yet. Please try again in a moment.',
          [{ text: 'OK' }]
        );
        return;
      }

      setTogglingJarId(channelId);

      toggleJarActivation(
        {
          walletId: backendWallet.id,
          enabled: !tipJarItem.isEnabled,
        },
        {
          onSuccess: () => {
            setTogglingJarId(null);
          },
          onError: (error) => {
            // Error is already logged by the mutation
            Alert.alert('Error', 'Failed to toggle tip jar. Please try again.');
            setTogglingJarId(null);
          },
        }
      );
    },
    [tipJarItems, channelsQuery, allTipJars, backendWallets, isLoadingWallets, refetchWallets, toggleJarActivation]
  );

  return {
    tipJarItems,
    handleToggle,
    isLoadingWallets,
    refetchWallets,
  };
}

