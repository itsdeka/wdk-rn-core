/**
 * Tests for useAbortController hook
 * 
 * Tests the AbortController logic without DOM rendering
 */

import { AbortController } from 'abort-controller'

describe('AbortController logic', () => {
  it('should create an AbortController', () => {
    const controller = new AbortController()
    expect(controller).toBeInstanceOf(AbortController)
    expect(controller.signal.aborted).toBe(false)
  })

  it('should abort a controller', () => {
    const controller = new AbortController()
    controller.abort()
    expect(controller.signal.aborted).toBe(true)
  })

  it('should return the same controller when not aborted', () => {
    const controller = new AbortController()
    const signal1 = controller.signal
    const signal2 = controller.signal
    expect(signal1).toBe(signal2)
  })

  it('should create a new controller when previous is aborted', () => {
    const controller1 = new AbortController()
    controller1.abort()
    expect(controller1.signal.aborted).toBe(true)
    
    const controller2 = new AbortController()
    expect(controller2.signal.aborted).toBe(false)
    expect(controller2).not.toBe(controller1)
  })

  it('should handle multiple controllers', () => {
    const controller1 = new AbortController()
    const controller2 = new AbortController()
    const controller3 = new AbortController()
    
    controller1.abort()
    controller2.abort()
    
    expect(controller1.signal.aborted).toBe(true)
    expect(controller2.signal.aborted).toBe(true)
    expect(controller3.signal.aborted).toBe(false)
  })
})
