/**
 * useHomeData Hook
 * 
 * Handles all data fetching for home screen.
 */

import { useMemo } from 'react';
import { useCurrentUser, useCheckVerification } from '@/queries/auth';
import { useAddressBook } from '@/queries/addressBook';
import { useChannels } from '@/queries/channels';
import { useBackendOnline } from '@/queries/wallet';
import { useRumbleStore } from '@/stores/rumbleStore';
import { prepareCreatorsData } from '@/utils/formatting/homeDataFormatter';

/**
 * Hook for fetching and preparing home screen data
 */
export function useHomeData() {
  // Fetch current user data
  const { data: currentUserQuery } = useCurrentUser();

  // Fetch channels
  const { data: channelsQuery = [] } = useChannels();

  // Fetch address book (creators)
  const { data: addressBook = [] } = useAddressBook(1);

  // Fetch verification status (KYC)
  const { data: verificationResponse } = useCheckVerification();

  // Check backend online status
  const { data: isBackendOnline = true } = useBackendOnline();

  // Get Rumble store
  const rumbleStore = useRumbleStore();

  // Use stored data as fallback when query data isn't available yet
  const currentUser = useMemo(
    () => currentUserQuery || rumbleStore.currentUser,
    [currentUserQuery, rumbleStore.currentUser]
  );

  const channels = useMemo(
    () => (channelsQuery.length > 0 ? channelsQuery : rumbleStore.channels),
    [channelsQuery, rumbleStore.channels]
  );

  // Prepare creators data
  const creators = useMemo(
    () => prepareCreatorsData(addressBook),
    [addressBook]
  );

  return {
    currentUser,
    channels,
    addressBook,
    creators,
    verificationResponse,
    isBackendOnline,
  };
}

