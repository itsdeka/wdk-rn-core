/**
 * useTransactionMonitoring Hook
 * 
 * Monitors pending transactions by polling getTransactionReceipt at regular intervals.
 * Only runs when app is active and there are pending transactions.
 */

import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { checkPendingTransactions } from '@/services/transactions/transactionMonitoringService';
import { getPendingTransactions } from '@/services/transactions/ongoingTransactionsStorage';
import { createLogger } from '@/utils/logger';

const monitoringHookLogger = createLogger('useTransactionMonitoring');

/**
 * Polling interval in milliseconds (30 seconds)
 */
const POLLING_INTERVAL = 30 * 1000;

/**
 * Hook to monitor pending transactions
 * Sets up polling when app is active and there are pending transactions
 */
export function useTransactionMonitoring(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // Function to check if we should be polling
    const shouldPoll = (): boolean => {
      const pendingCount = getPendingTransactions().length;
      const isActive = appStateRef.current === 'active';
      return pendingCount > 0 && isActive;
    };

    // Function to perform a check
    const performCheck = async (): Promise<void> => {
      if (!shouldPoll()) {
        return;
      }

      try {
        await checkPendingTransactions();
      } catch (error) {
        monitoringHookLogger.error('Error in transaction monitoring check', error);
      }
    };

    // Function to start polling
    const startPolling = (): void => {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }

      // Only start if there are pending transactions
      if (!shouldPoll()) {
        return;
      }

      // Perform initial check
      performCheck();

      // Set up interval
      intervalRef.current = setInterval(() => {
        if (shouldPoll()) {
          performCheck();
        } else {
          // Stop polling if no pending transactions or app not active
          stopPolling();
        }
      }, POLLING_INTERVAL);

      monitoringHookLogger.debug('Started transaction monitoring polling');
    };

    // Function to stop polling
    const stopPolling = (): void => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        monitoringHookLogger.debug('Stopped transaction monitoring polling');
      }
    };

    // Handle app state changes
    const handleAppStateChange = (nextAppState: AppStateStatus): void => {
      const wasActive = appStateRef.current === 'active';
      const isActive = nextAppState === 'active';
      
      appStateRef.current = nextAppState;

      if (isActive && !wasActive) {
        // App became active - immediately check pending transactions and start polling
        monitoringHookLogger.debug('App became active, checking pending transactions immediately');
        performCheck().then(() => {
          // After immediate check, start polling if still needed
          startPolling();
        });
      } else if (!isActive && wasActive) {
        // App went to background - stop polling
        monitoringHookLogger.debug('App went to background, stopping polling');
        stopPolling();
      }
    };

    // Set initial app state
    appStateRef.current = AppState.currentState;

    // Start polling if app is active and there are pending transactions
    if (shouldPoll()) {
      startPolling();
    }

    // Listen to app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Cleanup on unmount
    return () => {
      subscription.remove();
      stopPolling();
    };
  }, []); // Empty deps - only run once on mount
}

