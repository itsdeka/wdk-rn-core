/**
 * Error utility functions for consistent error handling
 */

/**
 * Normalize error to Error instance
 * Converts any error-like value to a proper Error object
 */
export function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error
  }

  if (typeof error === 'string') {
    return new Error(error)
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message))
  }

  return new Error(String(error))
}

/**
 * Get error message from any error-like value
 */
export function getErrorMessage(error: unknown): string {
  return normalizeError(error).message
}

/**
 * Check if error is a specific type
 */
export function isErrorType(error: unknown, typeName: string): boolean {
  return error instanceof Error && error.name === typeName
}

/**
 * Create a standardized error with context
 */
export function createContextualError(
  message: string,
  context?: Record<string, unknown>
): Error {
  const error = new Error(message)
  if (context) {
    Object.assign(error, { context })
  }
  return error
}

