/**
 * Application constants
 * 
 * Centralized location for magic numbers and configuration values
 * to improve maintainability and documentation.
 */

/**
 * Default balance refresh interval in milliseconds
 * 
 * How often to automatically refresh wallet balances when auto-fetch is enabled.
 * 30 seconds provides a good balance between freshness and performance.
 */
export const DEFAULT_BALANCE_REFRESH_INTERVAL_MS = 30000

/**
 * Valid mnemonic word counts
 * 
 * BIP-39 standard supports 12-word (128 bits) and 24-word (256 bits) mnemonics.
 */
export const MNEMONIC_WORD_COUNTS = {
  /** 12-word mnemonic (128 bits of entropy) */
  TWELVE: 12,
  /** 24-word mnemonic (256 bits of entropy) */
  TWENTY_FOUR: 24,
} as const

/**
 * Default mnemonic word count
 * 
 * 12 words is the most common choice, providing 128 bits of entropy
 * which is sufficient for most use cases.
 */
export const DEFAULT_MNEMONIC_WORD_COUNT = MNEMONIC_WORD_COUNTS.TWELVE


