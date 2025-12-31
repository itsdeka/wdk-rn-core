/**
 * @file useNotificationSetup.ts
 * @description Hook for setting up push notifications
 * @pattern Custom Hook for side effects
 *
 * Setup push notifications on mount
 *
 * This hook handles:
 * - Checking notification permissions
 * - Initializing notification service
 * - Storing FCM token in authStore
 *
 * @example
 * function AppLayout() {
 *   useNotificationSetup();
 *   // ... rest of initialization
 * }
 */

import { useEffect } from 'react';

import { useAuthStore } from '@/stores/authStore';
import { useNotifications } from './useNotifications';
import { createLogger } from '@/utils/logger';

const logger = createLogger('notifications/setup');

/**
 * Setup push notifications on mount
 *
 * This hook handles:
 * - Checking notification permissions
 * - Initializing notification service
 * - Storing FCM token in authStore
 */
export function useNotificationSetup(): void {
	const { checkPermission, initAfterPermission } = useNotifications();
	const setFcmToken = useAuthStore(state => state.setFcmToken);

	useEffect(() => {
		const setupNotifications = async () => {
			try {
				const notificationPermissionGranted = await checkPermission();
				if (notificationPermissionGranted) {
					const token = await initAfterPermission();
					if (token) {
						setFcmToken(token);
						logger.info('Notifications setup complete');
					}
				} else {
					logger.info('Notification permission not granted');
				}
			} catch (error) {
				logger.error('Failed to setup notifications', error);
				// Don't block app startup
			}
		};

		setupNotifications();
	}, [checkPermission, initAfterPermission, setFcmToken]);
}


