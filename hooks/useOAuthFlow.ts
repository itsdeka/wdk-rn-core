/**
 * useOAuthFlow - Complete OAuth authentication flow
 *
 * Handles:
 * 1. PKCE generation
 * 2. Rumble app → browser fallback
 * 3. Deep link code processing (expo-router)
 * 4. Code deduplication
 */

import { useEffect, useState, useRef } from 'react';
import { Linking, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import {
  RUMBLE_APP_SCHEME,
  RUMBLE_COM_BASE_URL,
  RUMBLE_OAUTH_CLIENT_ID,
  RUMBLE_OAUTH_REDIRECT_URI,
  RUMBLE_OAUTH_SCOPES,
} from '@/config/rumble';

import { buildOAuthUrl } from '@/utils/auth/oauth-url';
import { generatePKCEChallenge } from '@/utils/auth/pkce';
import { createLogger } from '@/utils/logger';

interface UseOAuthFlowParams {
  /** Callback when OAuth code is received (browser or deep link) */
  onCodeReceived: (code: string, codeVerifier: string) => void;
}

export function useOAuthFlow({ onCodeReceived }: UseOAuthFlowParams) {
  const params = useLocalSearchParams<{ code?: string }>();
  const [codeVerifier, setCodeVerifier] = useState<string | null>(null);
  const processedCodesRef = useRef(new Set<string>());
  const logger = createLogger('auth/useOAuthFlow');

  /**
   * Start OAuth flow
   * Tries Rumble app → fallback to browser
   */
  const startOAuth = async (): Promise<void> => {
    try {
      // Generate PKCE
      const pkce = await generatePKCEChallenge();
      setCodeVerifier(pkce.codeVerifier);

      // Check if Rumble app is installed (check scheme only, not full URL)
      // Wrap in try-catch because canOpenURL throws if scheme isn't in LSApplicationQueriesSchemes
      let canOpen = false;
      try {
        canOpen = await Linking.canOpenURL(RUMBLE_APP_SCHEME);
        logger.debug('Rumble app availability check', {
          scheme: RUMBLE_APP_SCHEME,
          canOpen,
        });
      } catch (error) {
        // Scheme not in LSApplicationQueriesSchemes or other error
        logger.warn('Cannot check Rumble app availability, falling back to browser', {
          error: error instanceof Error ? error.message : String(error),
          scheme: RUMBLE_APP_SCHEME,
        });
        canOpen = false;
      }

      if (canOpen) {
        try {
          // Build full OAuth URL for Rumble app
          const appUrl = buildOAuthUrl({
            clientId: RUMBLE_OAUTH_CLIENT_ID,
            codeChallenge: pkce.codeChallenge,
            appScheme: RUMBLE_APP_SCHEME,
          });

          logger.info('Opening Rumble app', { appUrl });
          await Linking.openURL(appUrl);
          return; // Code will come via deep link
        } catch (error) {
          // If opening app fails, fall through to browser
          logger.warn('Failed to open Rumble app, falling back to browser', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logger.info('Rumble app not available, using browser', {
        platform: Platform.OS,
        redirectUri: RUMBLE_OAUTH_REDIRECT_URI,
      });

      // Fallback to browser
      const browserParams = new URLSearchParams({
        client_id: RUMBLE_OAUTH_CLIENT_ID,
        redirect_uri: RUMBLE_OAUTH_REDIRECT_URI,
        response_type: 'code',
        scope: RUMBLE_OAUTH_SCOPES,
        code_challenge: pkce.codeChallenge,
        code_challenge_method: 'S256',
        logout: 'true',
      });

      const browserUrl = `${RUMBLE_COM_BASE_URL}/sso/auth/consent?${browserParams.toString()}`;

      if (Platform.OS === 'ios') {
        WebBrowser.dismissAuthSession();
      }
      
      const result = await WebBrowser.openAuthSessionAsync(browserUrl, RUMBLE_OAUTH_REDIRECT_URI, {
        preferEphemeralSession: true,
      });
      
      logger.debug('Browser result', { type: result.type });

      if (result.type === 'success' && result.url) {
        const url = new URL(result.url);
        const code = url.searchParams.get('code');

        if (code) {
          logger.info('Browser returned code, calling callback', {
            codePrefix: code.substring(0, 10),
          });
          // Callback handles deduplication
          onCodeReceived(code, pkce.codeVerifier);
        }
      } else if (result.type === 'cancel') {
        logger.info('Browser authentication cancelled by user');
      }
    } catch (error) {
      logger.error('Error opening browser', {
        error: error instanceof Error ? error.message : String(error),
        platform: Platform.OS,
      });
      throw error;
    }
  };

  // Handle deep link with OAuth code (expo-router)
  useEffect(() => {
    const code = params?.code;

    if (!code || !codeVerifier) return;

    // Deduplication: Prevent same code from being processed twice
    if (processedCodesRef.current.has(code)) {
      logger.warn('OAuth code already processed, skipping duplicate', {
        codePrefix: code.substring(0, 10),
      });
      return;
    }

    processedCodesRef.current.add(code);
    logger.info('Deep link code received', { codePrefix: code.substring(0, 10) });

    // Callback handles the actual login
    onCodeReceived(code, codeVerifier);
  }, [params?.code, codeVerifier, onCodeReceived]);

  return {
    startOAuth,
  };
}

