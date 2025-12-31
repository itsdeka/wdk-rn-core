/**
 * useHomeState Hook
 * 
 * Manages all state for home screen.
 */

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { hasLocalWallet } from '@/services/wallet/walletInitializationService';
import { createLogger } from '@/utils/logger';
import type { TransactionSubmittedData } from '@/app/sections/wallet';

const homeStateLogger = createLogger('useHomeState');

/**
 * Hook for managing home screen state
 */
export function useHomeState() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedBalanceView, setSelectedBalanceView] = useState<string>('total');
  const [isReceiveFlowVisible, setIsReceiveFlowVisible] = useState(false);
  const [isSendFlowVisible, setIsSendFlowVisible] = useState(false);
  const [isKYCModalVisible, setIsKYCModalVisible] = useState(false);
  const [isTipJarSelectionModalVisible, setIsTipJarSelectionModalVisible] = useState(false);
  const [hasLocalWalletInMemory, setHasLocalWalletInMemory] = useState(false);
  const [transactionSubmittedData, setTransactionSubmittedData] = useState<TransactionSubmittedData | null>(null);
  const [isTransactionSubmittedVisible, setIsTransactionSubmittedVisible] = useState(false);

  const authStore = useAuthStore();

  // Check for local wallet and determine recovery mode
  useEffect(() => {
    const checkRecoveryMode = async () => {
      try {
        const hasWallet = await hasLocalWallet();
        setHasLocalWalletInMemory(hasWallet);
      } catch (error) {
        homeStateLogger.error('Failed to check for local wallet', error);
        setHasLocalWalletInMemory(false);
      }
    };

    checkRecoveryMode();
  }, []);

  // Determine if in recovery mode or backend is offline
  const isRecoveryMode = hasLocalWalletInMemory && !authStore.isAuthenticated();

  return {
    isRefreshing,
    setIsRefreshing,
    selectedBalanceView,
    setSelectedBalanceView,
    isReceiveFlowVisible,
    setIsReceiveFlowVisible,
    isSendFlowVisible,
    setIsSendFlowVisible,
    isKYCModalVisible,
    setIsKYCModalVisible,
    isTipJarSelectionModalVisible,
    setIsTipJarSelectionModalVisible,
    transactionSubmittedData,
    setTransactionSubmittedData,
    isTransactionSubmittedVisible,
    setIsTransactionSubmittedVisible,
    isRecoveryMode,
  };
}

