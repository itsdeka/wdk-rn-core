/**
 * @fileoverview useNotifications — Expo Notifications + React Native Firebase (Messaging)
 *
 * What this hook provides:
 * - Consent-first flow (no auto-init on mount)
 * - Permission check/request (Android 13+ runtime & iOS)
 * - One-time init after consent (foreground handler, Android channel, FCM token, listeners)
 * - Foreground push -> local notification
 * - Notification tap handling (foreground & background)
 * - Token refresh awareness
 * - Open OS notification settings
 *
 * @example
 * const { fcmToken, checkPermission, requestPermission, initAfterPermission, openSettings, sendLocalNotification } = useNotifications();
 *
 * // On CTA:
 * const granted = (await checkPermission()) || (await requestPermission());
 * if (granted) {
 *   const token = await initAfterPermission();
 *   console.log('FCM token:', token ?? fcmToken);
 * } else {
 *   await openSettings();
 * }
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, PermissionsAndroid, Platform } from 'react-native';

import {
	FirebaseMessagingTypes,
	getMessaging,
	getToken,
	onMessage,
	onTokenRefresh,
} from '@react-native-firebase/messaging';
import * as Notifications from 'expo-notifications';

import { createLogger } from '@/utils/logger';

const logger = createLogger('notifications');

/** Optional payload for deep-link/navigation */
export type NotificationData = {
	screen?: string;
	params?: Record<string, unknown>;
};

/** Public API shape returned by the hook */
type UseNotificationsReturn = {
	/** Last known FCM token (null until first fetch/refresh completes) */
	fcmToken: string | null;

	/** Checks current permission (no prompt) */
	checkPermission: () => Promise<boolean>;

	/** Requests permission (Android 13+ / iOS) */
	requestPermission: () => Promise<boolean>;

	/**
	 * Initializes after consent (idempotent):
	 * - Expo foreground behavior
	 * - Android "default" channel
	 * - Initial token fetch + token refresh listener
	 * - Foreground onMessage -> local notification
	 * - Tap listener (foreground & background)
	 * Returns token if immediately available; otherwise null (fcmToken will update soon after)
	 */
	initAfterPermission: () => Promise<string | null>;

	/** Opens the OS notification settings for this app */
	openSettings: () => Promise<void>;

	/** Shows a local notification immediately (used for foreground push UX) */
	sendLocalNotification: (title: string, body: string, data?: NotificationData) => Promise<void>;

	/** Sets the app badge count (iOS only) */
	setBadgeCount: (count: number) => Promise<void>;

	/** Clears the app badge count (iOS only) */
	clearBadgeCount: () => Promise<void>;
};

export const useNotifications = (): UseNotificationsReturn => {
	const [fcmToken, setFcmToken] = useState<string | null>(null);

	// Guards to ensure single, idempotent init
	const initializedRef = useRef(false);
	const tapListenerAddedRef = useRef(false);
	
	// Store unsubscribe functions for cleanup
	const tokenRefreshUnsubscribeRef = useRef<(() => void) | null>(null);
	const messageUnsubscribeRef = useRef<(() => void) | null>(null);
	const tapListenerUnsubscribeRef = useRef<Notifications.EventSubscription | null>(null);

	/** checks current permission without prompting the user */
	const checkPermission = useCallback(async (): Promise<boolean> => {
		if (Platform.OS === 'android' && Platform.Version >= 33) {
			return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
		}
		const { status } = await Notifications.getPermissionsAsync();
		return status === 'granted';
	}, []);

	/** requests permission from the user (Android 13+ / iOS) */
	const requestPermission = useCallback(async (): Promise<boolean> => {
		try {
			if (Platform.OS === 'android') {
				if (Platform.Version >= 33) {
					const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
					if (res !== PermissionsAndroid.RESULTS.GRANTED) return false;
				}
				return true;
			} else {
				const { status: current } = await Notifications.getPermissionsAsync();
				if (current === 'granted') return true;
				const { status } = await Notifications.requestPermissionsAsync();
				return status === 'granted';
			}
		} catch (err) {
			logger.error('Permission request error', err);
			return false;
		}
	}, []);

	/** opens the OS notification settings for this app */
	const openSettings = useCallback(async (): Promise<void> => {
		try {
			await Linking.openSettings();
		} catch (err) {
			logger.error('Open settings error', err);
		}
	}, []);

	/** sets the app badge count (iOS only) */
	const setBadgeCount = useCallback(async (count: number) => {
		if (Platform.OS === 'ios') {
			await Notifications.setBadgeCountAsync(count);
		}
	}, []);

	/** clears the app badge count (iOS only) */
	const clearBadgeCount = useCallback(async () => {
		if (Platform.OS === 'ios') {
			await Notifications.setBadgeCountAsync(0);
		}
	}, []);

	/** shows a local notification immediately (used for foreground push) */
	const sendLocalNotification = useCallback(async (title: string, body: string, data: NotificationData = {}) => {
		// Handle badge count for local notifications
		// If no badge count provided, increment current count
		const currentBadge = await Notifications.getBadgeCountAsync();
		const finalBadgeCount = currentBadge + 1;
		await Notifications.setBadgeCountAsync(finalBadgeCount);

		const notificationContent = {
			title,
			body,
			data,
			sound: 'default',
			...(Platform.OS === 'ios' ? { badge: finalBadgeCount } : {}),
		};

		await Notifications.scheduleNotificationAsync({
			content: notificationContent,
			trigger: null,
		});
	}, []);

	/**
	 * single entry to initialize after consent:
	 * - sets Expo foreground behavior (+ banner/list for current types)
	 * - creates Android "default" channel
	 * - fetches initial token (single try); token refresh keeps it updated
	 * - listens for foreground messages and shows local notifications
	 * - installs one-time tap listener for deep links
	 */
	const initAfterPermission = useCallback(async (): Promise<string | null> => {
		if (initializedRef.current) {
			try {
				const currentToken = await getToken(getMessaging());
				if (currentToken && currentToken === fcmToken) return fcmToken;
				// Token has changed or is invalid, force re-initialization
				initializedRef.current = false;
			} catch {
				// Token is invalid, force re-initialization
				initializedRef.current = false;
			}
		}

		// Foreground presentation behavior (include banner/list to satisfy current types)
		Notifications.setNotificationHandler({
			handleNotification: async () => ({
				shouldShowAlert: true,
				shouldPlaySound: true,
				shouldSetBadge: true,
				shouldShowBanner: true,
				shouldShowList: true,
			}),
		});

		// Android: ensure high-importance channel for trigger:null
		if (Platform.OS === 'android') {
			try {
				await Notifications.setNotificationChannelAsync('default', {
					name: 'Default',
					importance: Notifications.AndroidImportance.MAX,
					sound: 'default',
					enableVibrate: true,
				});
			} catch (err) {
				logger.error('Android channel error', err);
			}
		}

		// Initial token (single attempt; late availability handled by token refresh)
		let firstToken: string | null = null;
		try {
			firstToken = await getToken(getMessaging());
			if (firstToken) setFcmToken(firstToken);
		} catch {
			logger.warn('Initial token not ready yet');
		}

		// Keep token updated - store unsubscribe for cleanup
		const tokenUnsubscribe = onTokenRefresh(getMessaging(), newToken => {
			setFcmToken(newToken);
		});
		tokenRefreshUnsubscribeRef.current = tokenUnsubscribe;

		// Foreground push -> local notification - store unsubscribe for cleanup
		const messageUnsubscribe = onMessage(getMessaging(), async (rm: FirebaseMessagingTypes.RemoteMessage) => {
			const title = rm.notification?.title || '';
			const body = rm.notification?.body || '';
			await sendLocalNotification(title, body, rm.data as NotificationData);
		});
		messageUnsubscribeRef.current = messageUnsubscribe;

		// One-time tap listener (foreground & background)
		if (!tapListenerAddedRef.current) {
			tapListenerAddedRef.current = true;
			const tapUnsubscribe = Notifications.addNotificationResponseReceivedListener(() => {
				// Plug navigation here if desired:
				// if (payload?.screen) Navigation.navigate(payload.screen as never, payload.params as never);
			});
			tapListenerUnsubscribeRef.current = tapUnsubscribe;
		}

		initializedRef.current = true;
		return firstToken ?? fcmToken;
	}, [fcmToken, sendLocalNotification]);

	// Cleanup listeners on unmount
	useEffect(() => {
		return () => {
			if (tokenRefreshUnsubscribeRef.current) {
				tokenRefreshUnsubscribeRef.current();
				tokenRefreshUnsubscribeRef.current = null;
			}
			if (messageUnsubscribeRef.current) {
				messageUnsubscribeRef.current();
				messageUnsubscribeRef.current = null;
			}
			if (tapListenerUnsubscribeRef.current) {
				tapListenerUnsubscribeRef.current.remove();
				tapListenerUnsubscribeRef.current = null;
			}
			// Reset initialization flags
			initializedRef.current = false;
			tapListenerAddedRef.current = false;
		};
	}, []);

	return {
		fcmToken,
		checkPermission,
		requestPermission,
		initAfterPermission,
		openSettings,
		sendLocalNotification,
		setBadgeCount,
		clearBadgeCount,
	};
};

