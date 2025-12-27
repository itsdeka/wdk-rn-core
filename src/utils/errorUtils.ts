/**
 * Error utility functions for consistent error handling
 */

/**
 * Context-aware sensitive patterns
 * More specific patterns to avoid false positives while catching real sensitive data
 */
const SENSITIVE_PATTERNS = [
  // Cryptographic keys and secrets (more specific)
  /\b(encryption[_-]?key|encryptionKey|encrypted[_-]?seed|encryptedSeed|secret[_-]?key|private[_-]?key)\s*[:=]\s*([a-f0-9]{32,}|[A-Za-z0-9+/]{40,})/gi,
  // Mnemonic phrases (12 or 24 words) - allow alphanumeric words
  /\b(mnemonic|seed[_-]?phrase|recovery[_-]?phrase)\s*[:=]\s*([a-zA-Z0-9]+\s+){11,23}[a-zA-Z0-9]+/gi,
  // Base64 encoded keys (long base64 strings)
  /[A-Za-z0-9+/]{40,}={0,2}/g,
  // Hex strings that look like keys (32+ chars, even length)
  /\b0x?[a-f0-9]{32,}\b/gi,
  // File paths with sensitive names
  /file:\/\/[^\s]*(key|secret|password|credential|seed|mnemonic|private)[^\s]*/gi,
  // Paths containing sensitive directories
  /\/(?:private|secret|keys|credentials|seeds|mnemonics)\/[^\s]+/gi,
  // API tokens and keys in various formats
  /\b(api[_-]?key|access[_-]?token|bearer[_-]?token|auth[_-]?token)\s*[:=]\s*[^\s]{20,}/gi,
  // Passwords (but not "password" as a word)
  /\bpassword\s*[:=]\s*[^\s]{8,}/gi,
]

/**
 * Whitelist of safe patterns that should NOT be sanitized
 * These are common non-sensitive terms that might match sensitive patterns
 */
const SAFE_PATTERNS = [
  /\b(public[_-]?key|publicKey)\b/gi, // Public keys are safe
  /\b(error|Error|ERROR)\b/g, // Error messages themselves
  /\b(function|Function|const|let|var)\b/g, // Code keywords
  /\b(undefined|null|true|false)\b/g, // JavaScript literals
]

/**
 * Check if a string matches a safe pattern (should not be sanitized)
 */
function isSafePattern(text: string): boolean {
  return SAFE_PATTERNS.some(pattern => pattern.test(text))
}

/**
 * Sanitize error message to prevent information leakage
 * Removes or masks sensitive information while preserving useful debugging info
 * 
 * @param message - Error message to sanitize
 * @param isDevelopment - Whether we're in development mode (less sanitization)
 * @param context - Optional context about where the error occurred (for better sanitization)
 * @returns Sanitized error message
 */
export function sanitizeErrorMessage(
  message: string,
  isDevelopment = false,
  context?: { operation?: string; component?: string }
): string {
  if (isDevelopment) {
    // In development, allow more detailed messages but still sanitize obvious secrets
    let sanitized = message
    
    // Mask long hex strings that might be keys (but preserve some info for debugging)
    sanitized = sanitized.replace(/\b0x?[a-f0-9]{32,}\b/gi, (match) => {
      if (match.length <= 20) return match // Short hex strings are probably not keys
      return `${match.substring(0, 8)}...${match.substring(match.length - 4)}`
    })
    
    // Mask base64 strings that look like keys
    sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, (match) => {
      return `${match.substring(0, 8)}...${match.substring(match.length - 4)}`
    })
    
    return sanitized
  }

  // In production, be more aggressive with sanitization
  let sanitized = message

  // Remove file paths (but preserve error type information)
  sanitized = sanitized.replace(/file:\/\/[^\s]+/gi, '[file path]')
  sanitized = sanitized.replace(/\/[^\s]+\/[^\s]+/g, '[path]')

  // Context-aware sanitization: check if this is a known safe context
  const isKnownSafeContext = context?.operation === 'validation' || 
                            context?.component === 'ErrorBoundary'

  // Apply sensitive pattern sanitization
  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, (match, ...groups) => {
      // Skip if this matches a safe pattern
      if (isSafePattern(match)) {
        return match
      }
      
      // Determine replacement based on what was matched
      const lowerMatch = match.toLowerCase()
      if (lowerMatch.includes('encryption') || lowerMatch.includes('encrypted')) {
        return '[encryption data]'
      }
      if (lowerMatch.includes('mnemonic') || lowerMatch.includes('seed phrase')) {
        return '[mnemonic phrase]'
      }
      if (lowerMatch.includes('key') && !lowerMatch.includes('public')) {
        return '[key]'
      }
      if (lowerMatch.includes('token')) {
        return '[token]'
      }
      if (lowerMatch.includes('password')) {
        return '[password]'
      }
      if (lowerMatch.includes('secret')) {
        return '[secret]'
      }
      // For hex/base64 strings, mask them
      if (/[a-f0-9]{32,}/i.test(match) || /[A-Za-z0-9+/]{40,}/.test(match)) {
        return '[sensitive data]'
      }
      return '[sensitive]'
    })
  }

  // Additional cleanup: remove any remaining long hex/base64 strings
  sanitized = sanitized.replace(/\b0x?[a-f0-9]{32,}\b/gi, '[hex string]')
  sanitized = sanitized.replace(/\b[A-Za-z0-9+/]{40,}={0,2}\b/g, '[base64 string]')

  return sanitized
}

/**
 * Normalize error to Error instance
 * Converts any error-like value to a proper Error object
 * Optionally sanitizes the error message to prevent information leakage
 * 
 * @param error - Error to normalize
 * @param sanitize - Whether to sanitize the error message (default: true in production)
 * @param context - Optional context about where the error occurred
 * @returns Normalized Error instance
 */
export function normalizeError(
  error: unknown,
  sanitize = process.env.NODE_ENV === 'production',
  context?: { operation?: string; component?: string }
): Error {
  let errorMessage: string

  if (error instanceof Error) {
    errorMessage = error.message
  } else if (typeof error === 'string') {
    errorMessage = error
  } else if (error && typeof error === 'object' && 'message' in error) {
    errorMessage = String(error.message)
  } else {
    errorMessage = String(error)
  }

  // Sanitize error message if requested
  if (sanitize) {
    errorMessage = sanitizeErrorMessage(
      errorMessage,
      process.env.NODE_ENV === 'development',
      context
    )
  }

  const normalizedError = new Error(errorMessage)
  
  // Preserve error name and stack if available
  if (error instanceof Error) {
    normalizedError.name = error.name
    // Sanitize stack trace in production
    if (error.stack) {
      if (sanitize) {
        // Mask file paths and sensitive data in stack traces
        normalizedError.stack = sanitizeErrorMessage(error.stack, false, context)
      } else {
        normalizedError.stack = error.stack
      }
    }
  }

  return normalizedError
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

