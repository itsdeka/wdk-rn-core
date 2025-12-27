/**
 * Tests for workletStore
 */

import { createWorkletStore, getWorkletStore, resetWorkletStore, clearSensitiveData } from '../../store/workletStore'

describe('workletStore', () => {
  beforeEach(() => {
    resetWorkletStore()
    jest.clearAllMocks()
  })

  afterEach(() => {
    resetWorkletStore()
  })

  describe('createWorkletStore', () => {
    it('should create a worklet store instance', () => {
      const store = createWorkletStore()
      expect(store).toBeDefined()
      expect(typeof store.getState).toBe('function')
    })

    it('should return the same instance on subsequent calls', () => {
      const store1 = createWorkletStore()
      const store2 = createWorkletStore()
      expect(store1).toBe(store2)
    })

    it('should initialize with default state', () => {
      const store = createWorkletStore()
      const state = store.getState()
      
      expect(state.worklet).toBe(null)
      expect(state.hrpc).toBe(null)
      expect(state.ipc).toBe(null)
      expect(state.isWorkletStarted).toBe(false)
      expect(state.isInitialized).toBe(false)
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe(null)
      expect(state.encryptedSeed).toBe(null)
      expect(state.encryptionKey).toBe(null)
      expect(state.networkConfigs).toBe(null)
      expect(state.workletStartResult).toBe(null)
      expect(state.wdkInitResult).toBe(null)
    })
  })

  describe('getWorkletStore', () => {
    it('should return a worklet store instance', () => {
      const store = getWorkletStore()
      expect(store).toBeDefined()
      expect(typeof store.getState).toBe('function')
    })

    it('should return the same instance as createWorkletStore', () => {
      const store1 = createWorkletStore()
      const store2 = getWorkletStore()
      expect(store1).toBe(store2)
    })
  })

  describe('resetWorkletStore', () => {
    it('should reset the store instance', () => {
      const store1 = createWorkletStore()
      resetWorkletStore()
      const store2 = createWorkletStore()
      
      // After reset, a new instance should be created
      expect(store1).not.toBe(store2)
    })
  })

  describe('clearSensitiveData', () => {
    it('should clear encrypted seed and encryption key', () => {
      const store = createWorkletStore()
      
      store.setState({
        encryptedSeed: 'encrypted-seed',
        encryptionKey: 'encryption-key',
      })

      clearSensitiveData()

      const state = store.getState()
      expect(state.encryptedSeed).toBe(null)
      expect(state.encryptionKey).toBe(null)
    })

    it('should not affect other state', () => {
      const store = createWorkletStore()
      
      store.setState({
        isWorkletStarted: true,
        encryptedSeed: 'encrypted-seed',
        encryptionKey: 'encryption-key',
      })

      clearSensitiveData()

      const state = store.getState()
      expect(state.isWorkletStarted).toBe(true)
      expect(state.encryptedSeed).toBe(null)
      expect(state.encryptionKey).toBe(null)
    })
  })

  describe('store state management', () => {
    it('should allow state updates', () => {
      const store = createWorkletStore()
      
      store.setState({
        isWorkletStarted: true,
        isLoading: true,
      })

      const state = store.getState()
      expect(state.isWorkletStarted).toBe(true)
      expect(state.isLoading).toBe(true)
    })
  })
})

