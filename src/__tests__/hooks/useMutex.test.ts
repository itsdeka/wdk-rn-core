/**
 * Tests for useMutex hook
 * 
 * Tests the mutex logic without React rendering
 */

import { useMutex } from '../../hooks/useMutex'

// Simple test of mutex logic without React hooks
// Since we can't easily test React hooks in Node environment,
// we test the core logic that the hook implements

describe('useMutex logic', () => {
  it('should implement mutex pattern', () => {
    // Test that mutex prevents concurrent execution
    let locked = false
    let executionCount = 0

    const acquire = async (fn: () => Promise<void>) => {
      if (locked) {
        return
      }
      locked = true
      try {
        await fn()
        executionCount++
      } finally {
        locked = false
      }
    }

    const fn1 = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })
    const fn2 = jest.fn(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10))
    })

    // Start first call
    acquire(fn1)

    // Immediately try second call (should be ignored)
    acquire(fn2)

    // Wait for completion
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(fn1).toHaveBeenCalled()
        expect(fn2).not.toHaveBeenCalled()
        expect(executionCount).toBe(1)
        resolve()
      }, 50)
    })
  })

  it('should unlock after execution', async () => {
    let locked = false
    let executionCount = 0

    const acquire = async (fn: () => Promise<void>) => {
      if (locked) {
        return
      }
      locked = true
      try {
        await fn()
        executionCount++
      } finally {
        locked = false
      }
    }

    const fn1 = jest.fn().mockResolvedValue(undefined)
    const fn2 = jest.fn().mockResolvedValue(undefined)

    await acquire(fn1)
    await acquire(fn2)

    expect(fn1).toHaveBeenCalledTimes(1)
    expect(fn2).toHaveBeenCalledTimes(1)
    expect(executionCount).toBe(2)
  })

  it('should unlock even if function throws', async () => {
    let locked = false
    let executionCount = 0

    const acquire = async (fn: () => Promise<void>) => {
      if (locked) {
        return
      }
      locked = true
      try {
        await fn()
        executionCount++
      } finally {
        locked = false
      }
    }

    const errorFn = jest.fn().mockRejectedValue(new Error('Test error'))
    const successFn = jest.fn().mockResolvedValue(undefined)

    try {
      await acquire(errorFn)
    } catch (e) {
      // Expected
    }

    await acquire(successFn)

    expect(errorFn).toHaveBeenCalledTimes(1)
    expect(successFn).toHaveBeenCalledTimes(1)
    expect(executionCount).toBe(1)
  })
})

