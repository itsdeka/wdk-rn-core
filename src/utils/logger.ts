/**
 * Logger utility for development and production
 * 
 * Provides controlled logging that can be disabled in production
 * to improve performance and prevent information leakage.
 */

/**
 * Check if we're in development mode
 * React Native sets __DEV__ to true in development builds
 */
const isDevelopment = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production'

/**
 * Log a message (only in development)
 * 
 * @param message - Message to log
 * @param args - Additional arguments to log
 */
export function log(...args: unknown[]): void {
  if (isDevelopment) {
    console.log(...args)
  }
}

/**
 * Log an error (always logged, but sanitized in production)
 * 
 * @param message - Error message
 * @param error - Error object or additional data
 */
export function logError(message: string, error?: unknown): void {
  if (isDevelopment) {
    console.error(message, error)
  } else {
    // In production, log sanitized errors only
    // This prevents information leakage while still allowing error tracking
    console.error(message)
  }
}

/**
 * Log a warning (only in development)
 * 
 * @param message - Warning message
 * @param args - Additional arguments to log
 */
export function logWarn(...args: unknown[]): void {
  if (isDevelopment) {
    console.warn(...args)
  }
}


