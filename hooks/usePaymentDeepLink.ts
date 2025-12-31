/**
 * usePaymentDeepLink Hook
 * 
 * Handles payment deep links from pay.rumble.com.
 * Listens for incoming deep links and parses payment URLs.
 */

import { useEffect, useRef } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/stores/authStore';
import { PaymentLinkParser, type ParsedPaymentLink, type ParsedPaymentLinkParams } from '@/utils/deeplink/paymentLinkParser';
import { createLogger } from '@/utils/logger';

const logger = createLogger('hooks/usePaymentDeepLink');

export interface UsePaymentDeepLinkOptions {
  /** Callback when a valid payment link is received */
  onPaymentLinkReceived?: (parsedLink: ParsedPaymentLink) => void;
  /** Whether to automatically navigate to send screen */
  autoNavigate?: boolean;
}

export function usePaymentDeepLink(options: UsePaymentDeepLinkOptions = {}) {
  const { onPaymentLinkReceived, autoNavigate = true } = options;
  const router = useRouter();
  const authStore = useAuthStore();
  const processedUrlsRef = useRef(new Set<string>());

  /**
   * Handle a payment URL
   */
  const handlePaymentUrl = (url: string) => {
    // Deduplication: Prevent same URL from being processed twice
    if (processedUrlsRef.current.has(url)) {
      logger.warn('Payment URL already processed, skipping duplicate', {
        urlPrefix: url.substring(0, 50),
      });
      return;
    }

    processedUrlsRef.current.add(url);
    logger.info('Processing payment URL', { urlPrefix: url.substring(0, 50) });

    // Parse the payment link
    const parsed = PaymentLinkParser.parsePaymentLink(url);

    if (!parsed.isValid) {
      logger.warn('Invalid payment URL', { error: parsed.error, url });
      return;
    }

    if (!parsed.params) {
      logger.warn('Payment URL parsed but no params', { url });
      return;
    }

    logger.info('Valid payment link received', {
      destinationType: parsed.params.destination_type,
      identifier: parsed.params.identifier,
      hasPayload: !!parsed.params.payload,
    });

    // Call callback if provided
    if (onPaymentLinkReceived) {
      onPaymentLinkReceived(parsed);
    }

    // Auto-navigate if enabled and user is authenticated
    if (autoNavigate && authStore.isAuthenticated()) {
      navigateToSendScreen(parsed.params);
    }
  };

  /**
   * Navigate to send screen with parsed payment params
   */
  const navigateToSendScreen = (params: ParsedPaymentLinkParams) => {
    try {
      // Build navigation params
      const navParams: Record<string, string> = {};

      // Add payload if available
      if (params.payload) {
        navParams.payload = params.payload;
      }

      // Add amount if provided and greater than 0
      if (params.amount_usd && parseFloat(params.amount_usd) > 0) {
        navParams.amountFromQr = params.amount_usd;
      }

      // Add destination type and identifier for creator selection
      navParams.destinationType = params.destination_type;
      navParams.creatorId = params.identifier;

      logger.info('Navigating to send screen', navParams);

      router.push({
        pathname: '/sections/(authenticated)/send',
        params: navParams,
      });
    } catch (error) {
      logger.error('Failed to navigate to send screen', error);
    }
  };

  useEffect(() => {
    // Check for initial URL on app launch
    const checkInitialUrl = async () => {
      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          logger.info('Initial URL found', { url: initialUrl });
          // Check if it's a payment link
          if (initialUrl.includes('pay.rumble.com')) {
            handlePaymentUrl(initialUrl);
          }
        }
      } catch (error) {
        logger.error('Failed to get initial URL', error);
      }
    };

    checkInitialUrl();

    // Listen for deep links when app is open
    const subscription = Linking.addEventListener('url', (event) => {
      const { url } = event;
      logger.info('Deep link received', { url });

      // Check if it's a payment link
      if (url.includes('pay.rumble.com')) {
        handlePaymentUrl(url);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [onPaymentLinkReceived, autoNavigate]);

  return {
    handlePaymentUrl,
  };
}

