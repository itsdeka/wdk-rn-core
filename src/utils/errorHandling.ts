/**
 * Error handling utilities for services
 * 
 * Provides consistent error handling patterns across all services
 * to reduce code duplication and improve maintainability.
 */

import { normalizeError } from './errorUtils'
import { logError } from './logger'

/**
 * Handle service errors with consistent normalization and logging
 * 
 * @param error - Error to handle
 * @param component - Component/service name where error occurred
 * @param operation - Operation name that failed
 * @param context - Additional context for error
 * @throws Normalized error
 * 
 * @example
 * ```typescript
 * try {
 *   await someOperation()
 * } catch (error) {
 *   handleServiceError(error, 'AddressService', 'getAddress', { network, accountIndex })
 * }
 * ```
 */
export function handleServiceError(
  error: unknown,
  component: string,
  operation: string,
  context?: Record<string, unknown>
): never {
  const normalized = normalizeError(error, false, { component, operation, ...context })
  logError(`[${component}] ${operation} failed:`, normalized)
  throw normalized
}

