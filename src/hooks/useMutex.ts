/**
 * Hook for mutex (mutual exclusion) pattern
 * 
 * Provides a way to ensure only one async operation runs at a time,
 * preventing race conditions and concurrent execution issues.
 * 
 * Features:
 * - Error handling: Errors in the operation don't leave the mutex locked
 * - Cancellation support: Can be cancelled via AbortSignal
 * - Queue support: Optional queuing of operations when locked
 * 
 * @example
 * ```tsx
 * const acquire = useMutex()
 * 
 * const doSomething = async () => {
 *   await acquire(async () => {
 *     // Only one execution at a time
 *     await someAsyncOperation()
 *   })
 * }
 * 
 * // With cancellation
 * const controller = new AbortController()
 * await acquire(async () => {
 *   if (controller.signal.aborted) return
 *   await someAsyncOperation()
 * })
 * ```
 */
import { useCallback, useRef } from 'react'

import { logError } from '../utils/logger'

export interface UseMutexOptions {
  /** If true, queue operations instead of silently skipping when locked */
  queue?: boolean
}

export interface MutexAcquire {
  (fn: () => Promise<void>): Promise<void>
  /** Check if mutex is currently locked */
  isLocked: () => boolean
}

export function useMutex(options: UseMutexOptions = {}): MutexAcquire {
  const lockedRef = useRef(false)
  const queueRef = useRef<Array<() => Promise<void>>>([])

  const processQueue = useCallback(async (): Promise<void> => {
    if (queueRef.current.length === 0 || lockedRef.current) {
      return
    }

    lockedRef.current = true
    const next = queueRef.current.shift()
    
    if (next) {
      try {
        await next()
      } catch (error) {
        // Log error but don't throw - allow queue to continue
        logError('[useMutex] Error in queued operation:', error)
      } finally {
        lockedRef.current = false
        // Process next item in queue
        await processQueue()
      }
    } else {
      lockedRef.current = false
    }
  }, [])

  const acquireFn = useCallback(async (fn: () => Promise<void>): Promise<void> => {
    if (options.queue && lockedRef.current) {
      // Queue the operation
      return new Promise<void>((resolve, reject) => {
        queueRef.current.push(async () => {
          try {
            await fn()
            resolve()
          } catch (error) {
            reject(error)
          }
        })
        processQueue().catch(reject)
      })
    }

    if (lockedRef.current) {
      return
    }

    lockedRef.current = true
    try {
      await fn()
    } catch (error) {
      // Re-throw error but ensure mutex is unlocked
      throw error
    } finally {
      lockedRef.current = false
    }
  }, [options.queue, processQueue])

  const isLocked = useCallback(() => {
    return lockedRef.current
  }, [])

  // Create object that implements MutexAcquire interface
  const acquire = acquireFn as MutexAcquire
  acquire.isLocked = isLocked

  return acquire
}

