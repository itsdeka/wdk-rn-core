/**
 * Mnemonic utility functions
 */

/**
 * Validate a mnemonic phrase
 * 
 * @param mnemonic - The mnemonic phrase to validate
 * @returns true if the mnemonic is valid (12 or 24 words, all non-empty)
 * 
 * @example
 * ```ts
 * validateMnemonic("word1 word2 ... word12") // true
 * validateMnemonic("word1 word2 ... word24") // true
 * validateMnemonic("word1 word2") // false (too few words)
 * ```
 */
export function validateMnemonic(mnemonic: string): boolean {
  const words = mnemonic.trim().split(/\s+/)
  const validLengths = [12, 24]
  return validLengths.includes(words.length) && words.every(word => word.length > 0)
}




