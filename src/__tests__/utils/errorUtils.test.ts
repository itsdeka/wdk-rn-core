/**
 * Tests for error utility functions
 */

import { normalizeError, getErrorMessage, isErrorType, createContextualError } from '../../utils/errorUtils'

describe('normalizeError', () => {
  it('should return Error instance as-is', () => {
    const error = new Error('test error')
    expect(normalizeError(error)).toBe(error)
  })

  it('should convert string to Error', () => {
    const error = normalizeError('string error')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('string error')
  })

  it('should convert object with message to Error', () => {
    const error = normalizeError({ message: 'object error' })
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('object error')
  })

  it('should convert unknown types to Error', () => {
    const error = normalizeError(123)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('123')
  })
})

describe('getErrorMessage', () => {
  it('should extract message from Error', () => {
    expect(getErrorMessage(new Error('test'))).toBe('test')
  })

  it('should extract message from string', () => {
    expect(getErrorMessage('string error')).toBe('string error')
  })

  it('should handle unknown types', () => {
    expect(getErrorMessage(123)).toBe('123')
  })
})

describe('isErrorType', () => {
  it('should return true for matching error type', () => {
    const error = new TypeError('test')
    expect(isErrorType(error, 'TypeError')).toBe(true)
  })

  it('should return false for non-matching error type', () => {
    const error = new Error('test')
    expect(isErrorType(error, 'TypeError')).toBe(false)
  })

  it('should return false for non-Error values', () => {
    expect(isErrorType('string', 'Error')).toBe(false)
  })
})

describe('createContextualError', () => {
  it('should create error with message', () => {
    const error = createContextualError('test error')
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('test error')
  })

  it('should create error with context', () => {
    const error = createContextualError('test error', { key: 'value' })
    expect(error).toBeInstanceOf(Error)
    expect((error as Error & { context?: Record<string, unknown> }).context).toEqual({ key: 'value' })
  })
})

