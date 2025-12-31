/**
 * useHomeCallbacks Hook
 * 
 * Handles all callback functions for the home screen.
 * Navigation callbacks, modal handlers, and refresh logic.
 * Extracted from HomeContainer to improve maintainability.
 */

import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { RumbleAddressBook } from '@/api/types/channels';
import { NavigationBarItemType } from '@/app/sections/wallet/components';
import { refreshPrices } from '@/services/wallet/balanceAggregationService';
import { createLogger } from '@/utils/logger';

const callbacksLogger = createLogger('useHomeCallbacks');

interface UseHomeCallbacksParams {
  walletInitialized: boolean;
  setIsRefreshing: (isRefreshing: boolean) => void;
  setIsReceiveFlowVisible: (visible: boolean) => void;
  setIsSendFlowVisible: (visible: boolean) => void;
  setIsKYCModalVisible: (visible: boolean) => void;
  setIsTipJarSelectionModalVisible: (visible: boolean) => void;
  setIsQRScannerVisible?: (visible: boolean) => void;
}

interface UseHomeCallbacksReturn {
  handleRefresh: () => Promise<void>;
  handleWalletPress: (id?: string) => void;
  handleSendTip: (item: RumbleAddressBook) => void;
  handleNavigationItemPress: (item: NavigationBarItemType) => void;
  handleWalletSelectorPress: () => void;
  handleAnalyticsPress: () => void;
  handleAvatarPress: () => void;
  handleActiveTipJarsPress: () => void;
  handleKYCModalSuccess: () => void;
}

/**
 * Hook to provide all callback handlers for home screen
 */
export function useHomeCallbacks({
  walletInitialized,
  setIsRefreshing,
  setIsReceiveFlowVisible,
  setIsSendFlowVisible,
  setIsKYCModalVisible,
  setIsTipJarSelectionModalVisible,
  setIsQRScannerVisible,
}: UseHomeCallbacksParams): UseHomeCallbacksReturn {
  const router = useRouter();

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      if (walletInitialized) {
        // Refresh prices from Bitfinex
        await refreshPrices();
      }
    } catch (error) {
      callbacksLogger.error('Failed to refresh balances', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [walletInitialized, setIsRefreshing]);

  // Navigation callbacks
  const handleWalletPress = useCallback(
    (id?: string) => {
      // Navigate to wallet/analytics screen
      callbacksLogger.debug('Navigate to wallet', { walletId: id });
    },
    []
  );

  const handleSendTip = useCallback((item: RumbleAddressBook) => {
    // Navigate to send tip screen
    callbacksLogger.debug('Send tip', { itemId: item.id });
    // router.push('/sections/(authenticated)/send');
  }, []);

  const handleNavigationItemPress = useCallback(
    (item: NavigationBarItemType) => {
      // Handle navigation bar item press
      callbacksLogger.debug('Navigation item pressed', { item });
      
      if (item === 'receive') {
        setIsReceiveFlowVisible(true);
        return;
      }
      
      if (item === 'send') {
        setIsSendFlowVisible(true);
        return;
      }
      
      if (item === 'scan') {
        if (setIsQRScannerVisible) {
          setIsQRScannerVisible(true);
        } else {
          // Fallback: navigate to send screen which has QR scanner
          router.push('/sections/(authenticated)/send');
        }
        return;
      }
      
      // Handle other navigation items
      // router.push(`/sections/(authenticated)/${item}`);
    },
    [setIsReceiveFlowVisible, setIsSendFlowVisible, setIsQRScannerVisible, router]
  );

  const handleWalletSelectorPress = useCallback(() => {
    // Open balance view selection bottom sheet
    callbacksLogger.debug('Open wallet selector');
  }, []);

  const handleAnalyticsPress = useCallback(() => {
    // Navigate to analytics screen
    callbacksLogger.debug('Navigate to analytics');
  }, []);

  const handleAvatarPress = useCallback(() => {
    // Navigate to profile screen
    router.push('/sections/(authenticated)/profile');
  }, [router]);

  const handleActiveTipJarsPress = useCallback(() => {
    // Open KYC verification modal
    setIsKYCModalVisible(true);
  }, [setIsKYCModalVisible]);

  const handleKYCModalSuccess = useCallback(() => {
    // Refetch verification status after successful submission
    // The query will automatically refetch due to invalidation in useSubmitVerification
    callbacksLogger.info('KYC verification successful');
    // Open tip jar selection modal after KYC is complete
    setIsTipJarSelectionModalVisible(true);
  }, [setIsTipJarSelectionModalVisible]);

  return {
    handleRefresh,
    handleWalletPress,
    handleSendTip,
    handleNavigationItemPress,
    handleWalletSelectorPress,
    handleAnalyticsPress,
    handleAvatarPress,
    handleActiveTipJarsPress,
    handleKYCModalSuccess,
  };
}

