import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalWindow = global.window

class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.currentTime = 0
    this.destination = {}
    this.resume = vi.fn(() => {
      this.state = 'running'
    })
  }

  createOscillator() {
    return {
      type: '',
      frequency: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn()
    }
  }

  createGain() {
    return {
      gain: {
        setValueAtTime: vi.fn(),
        linearRampToValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn()
      },
      connect: vi.fn()
    }
  }
}

async function loadAudioManager() {
  vi.resetModules()
  global.window = {
    AudioContext: MockAudioContext,
    webkitAudioContext: MockAudioContext
  }
  const mod = await import('../js/audio.js')
  return mod.default || window.audioManager.constructor
}

describe('AudioManager', () => {
  let AudioManager
  let audio

  beforeEach(async () => {
    AudioManager = await loadAudioManager()
    audio = new AudioManager()
    await audio.init()
  })

  afterEach(() => {
    global.window = originalWindow
  })

  it('initializes with an audio context and preloads sounds', () => {
    expect(audio.context).toBeInstanceOf(MockAudioContext)
    expect(audio.sounds.size).toBeGreaterThan(0)
    expect(audio.sounds.has('shoot')).toBe(true)
    expect(audio.enabled).toBe(true)
  })

  it('clamps master volume to the 0..1 range', () => {
    audio.setMasterVolume(2)
    expect(audio.masterVolume).toBe(1)

    audio.setMasterVolume(-1)
    expect(audio.masterVolume).toBe(0)
  })

  it('returns without throwing when playing unknown sounds or while disabled', () => {
    expect(() => audio.play('nonexistent')).not.toThrow()
    audio.enabled = false
    expect(() => audio.play('shoot')).not.toThrow()
  })

  it('plays a known sound through the real audio context graph', () => {
    const oscillator = audio.context.createOscillator()
    const gainNode = audio.context.createGain()
    const oscSpy = vi.spyOn(audio.context, 'createOscillator').mockReturnValue(oscillator)
    const gainSpy = vi.spyOn(audio.context, 'createGain').mockReturnValue(gainNode)

    audio.play('shoot', 0.5)

    expect(oscSpy).toHaveBeenCalled()
    expect(gainSpy).toHaveBeenCalled()
    expect(oscillator.connect).toHaveBeenCalledWith(gainNode)
    expect(gainNode.connect).toHaveBeenCalledWith(audio.context.destination)
    expect(oscillator.frequency.setValueAtTime).toHaveBeenCalled()
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalled()
    expect(oscillator.start).toHaveBeenCalled()
    expect(oscillator.stop).toHaveBeenCalled()
  })

  it('resumes a suspended context', () => {
    audio.context.state = 'suspended'
    audio.resume()
    expect(audio.context.resume).toHaveBeenCalled()
  })

  it('toggles enabled state', () => {
    const initial = audio.enabled
    expect(audio.toggle()).toBe(!initial)
  })
})
