import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalWindow = global.window
const originalWebSocket = global.WebSocket

class MockWebSocket {
  static instances = []

  constructor(url) {
    this.url = url
    this.send = vi.fn()
    this.close = vi.fn()
    this.onopen = null
    this.onclose = null
    this.onerror = null
    this.onmessage = null
    MockWebSocket.instances.push(this)
  }
}

function loadNetworkClass() {
  vi.resetModules()
  global.window = {}
  global.WebSocket = MockWebSocket
  return import('../js/network.js').then(() => window.Network)
}

describe('Network', () => {
  let Network

  beforeEach(async () => {
    MockWebSocket.instances = []
    vi.useFakeTimers()
    Network = await loadNetworkClass()
  })

  afterEach(() => {
    vi.useRealTimers()
    global.window = originalWindow
    global.WebSocket = originalWebSocket
  })

  it('connects immediately on construction', () => {
    const network = new Network('ws://localhost:8080/ws')
    expect(MockWebSocket.instances).toHaveLength(1)
    expect(MockWebSocket.instances[0].url).toBe('ws://localhost:8080/ws')
    expect(network.connected).toBe(false)
  })

  it('marks connected and starts heartbeat on open', () => {
    const network = new Network('ws://localhost:8080/ws')
    const ws = MockWebSocket.instances[0]

    ws.onopen()
    expect(network.connected).toBe(true)

    network.send = vi.fn()
    vi.advanceTimersByTime(30000)
    expect(network.send).toHaveBeenCalledWith('heartbeat', expect.objectContaining({ time: expect.any(Number) }))
  })

  it('registers handlers and dispatches parsed messages', () => {
    const network = new Network('ws://localhost:8080/ws')
    const handler = vi.fn()
    network.on('player_joined', handler)

    network.handleMessage('{"type":"player_joined","data":{"id":"p1"}}\n')
    expect(handler).toHaveBeenCalledWith({ id: 'p1' })
  })

  it('handles welcome messages by storing player id', () => {
    const network = new Network('ws://localhost:8080/ws')
    network.handleMessage('{"type":"welcome","data":{"player_id":"abc123"}}\n')
    expect(network.playerId).toBe('abc123')
  })

  it('sends serialized messages only when connected', () => {
    const network = new Network('ws://localhost:8080/ws')
    const ws = MockWebSocket.instances[0]

    network.send('move', { x: 1 })
    expect(ws.send).not.toHaveBeenCalled()

    network.connected = true
    network.send('move', { x: 1 })
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"move"'))
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"x":1'))
  })

  it('reconnects after close until max attempts', () => {
    const network = new Network('ws://localhost:8080/ws')
    const firstSocket = MockWebSocket.instances[0]

    firstSocket.onclose({ code: 1006 })
    expect(network.connected).toBe(false)
    expect(network.reconnectAttempts).toBe(1)

    vi.advanceTimersByTime(2000)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('surfaces an error after max reconnect attempts', () => {
    const network = new Network('ws://localhost:8080/ws')
    network.reconnectAttempts = network.maxReconnectAttempts
    network.onError = vi.fn()

    MockWebSocket.instances[0].onclose({ code: 1006 })
    expect(network.onError).toHaveBeenCalled()
  })

  it('cancels pending reconnects when closed manually', () => {
    const network = new Network('ws://localhost:8080/ws')

    MockWebSocket.instances[0].onclose({ code: 1006 })
    expect(network.reconnectAttempts).toBe(1)

    network.close()
    vi.advanceTimersByTime(2000)

    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('continues processing valid messages after a malformed frame in the same batch', () => {
    const network = new Network('ws://localhost:8080/ws')
    const handler = vi.fn()
    network.on('player_joined', handler)

    network.handleMessage('{bad json}\n{"type":"player_joined","data":{"id":"p2"}}\n')

    expect(handler).toHaveBeenCalledWith({ id: 'p2' })
  })
})
