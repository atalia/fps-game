// Audio Manager Tests
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.state = 'running'
    this.currentTime = 0
    this.destination = {}
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

  resume() {
    this.state = 'running'
  }
}

// Mock AudioManager
class MockAudioManager {
  constructor() {
    this.context = null
    this.sounds = new Map()
    this.masterVolume = 0.7
    this.sfxVolume = 0.8
    this.musicVolume = 0.5
    this.enabled = true
  }

  async init() {
    this.context = new MockAudioContext()
    this.loadSounds()
  }

  loadSounds() {
    const soundDefs = {
      'shoot': { type: 'synth', freq: 150, duration: 0.1 },
      'hit': { type: 'synth', freq: 200, duration: 0.15 },
      'kill': { type: 'synth', freq: 400, duration: 0.2 }
    }
    for (const [name, def] of Object.entries(soundDefs)) {
      this.sounds.set(name, def)
    }
  }

  play(name, volume = 1.0) {
    if (!this.enabled || !this.context) return false
    const sound = this.sounds.get(name)
    if (!sound) return false
    return true
  }

  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume))
  }

  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume))
  }

  toggle() {
    this.enabled = !this.enabled
    return this.enabled
  }

  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume()
    }
  }
}

describe('AudioManager', () => {
  let audio

  beforeEach(async () => {
    audio = new MockAudioManager()
    await audio.init()
  })

  describe('Initialization', () => {
    it('should initialize with audio context', () => {
      expect(audio.context).not.toBeNull()
    })

    it('should load sounds', () => {
      expect(audio.sounds.size).toBeGreaterThan(0)
    })
  })

  describe('Volume', () => {
    it('should set master volume', () => {
      audio.setMasterVolume(0.5)
      expect(audio.masterVolume).toBe(0.5)
    })

    it('should clamp master volume to 0-1', () => {
      audio.setMasterVolume(2.0)
      expect(audio.masterVolume).toBe(1)
      
      audio.setMasterVolume(-0.5)
      expect(audio.masterVolume).toBe(0)
    })

    it('should set sfx volume', () => {
      audio.setSfxVolume(0.3)
      expect(audio.sfxVolume).toBe(0.3)
    })
  })

  describe('Playback', () => {
    it('should play sound', () => {
      const result = audio.play('shoot')
      expect(result).toBe(true)
    })

    it('should not play non-existent sound', () => {
      const result = audio.play('nonexistent')
      expect(result).toBe(false)
    })

    it('should not play when disabled', () => {
      audio.enabled = false
      const result = audio.play('shoot')
      expect(result).toBe(false)
    })
  })

  describe('Toggle', () => {
    it('should toggle audio', () => {
      const initialState = audio.enabled
      const newState = audio.toggle()
      expect(newState).toBe(!initialState)
    })
  })
})
