// Network Tests
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Network class
class Network {
  constructor() {
    this.ws = null
    this.playerId = null
    this.connected = false
    this.messageHandlers = {}
  }

  connect(url) {
    return new Promise((resolve, reject) => {
      // Mock WebSocket
      this.ws = {
        readyState: 1, // OPEN
        send: vi.fn(),
        close: vi.fn(),
        onopen: null,
        onclose: null,
        onerror: null,
        onmessage: null
      }

      // Simulate connection
      setTimeout(() => {
        this.connected = true
        this.playerId = 'test-player-id'
        this.ws.onopen?.()
        resolve()
      }, 10)
    })
  }

  disconnect() {
    if (this.ws) {
      this.ws.close()
      this.ws = null
      this.connected = false
    }
  }

  send(type, data = {}) {
    if (!this.connected) return
    const message = JSON.stringify({ type, data })
    this.ws?.send(message)
  }

  handleMessage(message) {
    const { type, data } = message
    if (this.messageHandlers[type]) {
      this.messageHandlers[type](data)
    }
  }

  on(type, handler) {
    this.messageHandlers[type] = handler
  }

  updateConnectionStatus(connected) {
    this.connected = connected
  }
}

describe('Network', () => {
  let network

  beforeEach(() => {
    network = new Network()
  })

  describe('Connection', () => {
    it('should connect successfully', async () => {
      await network.connect('ws://localhost:8080')
      expect(network.connected).toBe(true)
      expect(network.playerId).toBe('test-player-id')
    })

    it('should disconnect properly', async () => {
      await network.connect('ws://localhost:8080')
      network.disconnect()
      expect(network.connected).toBe(false)
      expect(network.ws).toBeNull()
    })
  })

  describe('Messaging', () => {
    beforeEach(async () => {
      await network.connect('ws://localhost:8080')
    })

    it('should send message', () => {
      network.send('test', { value: 1 })
      expect(network.ws.send).toHaveBeenCalledWith(JSON.stringify({ type: 'test', data: { value: 1 } }))
    })

    it('should not send when disconnected', () => {
      network.connected = false
      network.send('test', { value: 1 })
      expect(network.ws.send).not.toHaveBeenCalled()
    })
  })

  describe('Message Handlers', () => {
    it('should register handler', () => {
      const handler = vi.fn()
      network.on('test', handler)
      expect(network.messageHandlers['test']).toBe(handler)
    })

    it('should handle message', () => {
      const handler = vi.fn()
      network.on('test', handler)
      network.handleMessage({ type: 'test', data: { value: 1 } })
      expect(handler).toHaveBeenCalledWith({ value: 1 })
    })

    it('should not throw for unhandled message type', () => {
      expect(() => {
        network.handleMessage({ type: 'unknown', data: {} })
      }).not.toThrow()
    })
  })

  describe('Connection Status', () => {
    it('should update connection status', () => {
      network.updateConnectionStatus(true)
      expect(network.connected).toBe(true)
      
      network.updateConnectionStatus(false)
      expect(network.connected).toBe(false)
    })
  })
})
