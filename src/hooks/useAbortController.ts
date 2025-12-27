/**
 * Hook for managing AbortController lifecycle
 * 
 * Provides a stable AbortController that is automatically cleaned up on unmount
 * and can be replaced when needed.
 */

import { useRef, useEffect } from 'react'

/**
 * Hook that manages an AbortController instance
 * Automatically aborts on unmount and provides a method to create a new controller
 * 
 * @returns Object with current controller and method to create a new one
 */
export function useAbortController() {
  const abortControllerRef = useRef<AbortController | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
        abortControllerRef.current = null
      }
    }
  }, [])

  /**
   * Create a new AbortController, aborting the previous one if it exists
   */
  const createController = () => {
    // Abort previous controller if it exists and is still active
    if (abortControllerRef.current && !abortControllerRef.current.signal.aborted) {
      abortControllerRef.current.abort()
    }
    const controller = new AbortController()
    abortControllerRef.current = controller
    return controller
  }

  /**
   * Get the current AbortController (creates one if none exists)
   */
  const getController = () => {
    if (!abortControllerRef.current || abortControllerRef.current.signal.aborted) {
      return createController()
    }
    return abortControllerRef.current
  }

  return {
    createController,
    getController,
    current: abortControllerRef.current,
  }
}


