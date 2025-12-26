/**
 * Tests for balance utility functions
 */

import { convertBalanceToString, formatBalance } from '../../utils/balanceUtils'

describe('convertBalanceToString', () => {
  it('should convert BigInt to string', () => {
    expect(convertBalanceToString(BigInt('1000000000000000000'))).toBe('1000000000000000000')
  })

  it('should return string as-is', () => {
    expect(convertBalanceToString('1000')).toBe('1000')
  })

  it('should convert number to string', () => {
    expect(convertBalanceToString(1000)).toBe('1000')
  })

  it('should handle other types', () => {
    expect(convertBalanceToString(null)).toBe('null')
    expect(convertBalanceToString(undefined)).toBe('undefined')
  })
})

describe('formatBalance', () => {
  it('should format balance with 18 decimals', () => {
    expect(formatBalance('1500000000000000000', 18)).toBe('1.5')
    expect(formatBalance('1000000000000000000', 18)).toBe('1')
  })

  it('should format balance with 6 decimals', () => {
    expect(formatBalance('1000000', 6)).toBe('1')
    expect(formatBalance('1000001', 6)).toBe('1.000001')
  })

  it('should handle zero balance', () => {
    expect(formatBalance('0', 18)).toBe('0')
    expect(formatBalance(null, 18)).toBe('0')
    expect(formatBalance('null', 18)).toBe('0')
  })

  it('should handle large balances', () => {
    expect(formatBalance('1000000000000000000000', 18)).toBe('1000')
  })

  it('should handle invalid input gracefully', () => {
    // Suppress console.error for this test since we're testing error handling
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    
    // Should return original value on error
    const result = formatBalance('invalid', 18)
    expect(result).toBe('invalid')
    
    // Verify error was logged
    expect(consoleSpy).toHaveBeenCalledWith('Error formatting balance:', expect.any(Error))
    
    consoleSpy.mockRestore()
  })
})

