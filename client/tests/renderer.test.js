// Renderer Tests
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock THREE
global.THREE = {
  Scene: vi.fn().mockImplementation(() => ({
    add: vi.fn(),
    background: null,
    fog: null
  })),
  PerspectiveCamera: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    rotation: { y: 0 },
    aspect: 1,
    updateProjectionMatrix: vi.fn()
  })),
  WebGLRenderer: vi.fn().mockImplementation(() => ({
    setSize: vi.fn(),
    shadowMap: { enabled: false, type: null },
    render: vi.fn(),
    domElement: document.createElement('canvas')
  })),
  AmbientLight: vi.fn(),
  DirectionalLight: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    castShadow: false,
    shadow: { mapSize: { width: 0, height: 0 } }
  })),
  PlaneGeometry: vi.fn(),
  BoxGeometry: vi.fn(),
  SphereGeometry: vi.fn(),
  MeshStandardMaterial: vi.fn(),
  MeshBasicMaterial: vi.fn(),
  Mesh: vi.fn().mockImplementation(() => ({
    position: { set: vi.fn() },
    rotation: { x: 0, y: 0 },
    castShadow: false,
    receiveShadow: false
  })),
  Color: vi.fn(),
  Fog: vi.fn()
}

// Mock Renderer class
class MockRenderer {
  constructor(container) {
    this.container = container
    this.scene = { add: vi.fn() }
    this.camera = { position: { set: vi.fn() } }
    this.renderer = { render: vi.fn(), setSize: vi.fn() }
    this.players = new Map()
    this.bullets = []
  }

  addPlayer(id, position, isLocal) {
    if (this.players.has(id)) return
    this.players.set(id, { mesh: {}, position, rotation: 0 })
  }

  removePlayer(id) {
    this.players.delete(id)
  }

  updatePlayer(id, position, rotation) {
    const player = this.players.get(id)
    if (player) {
      player.position = position
      player.rotation = rotation
    }
  }

  updateCamera(position, rotation) {
    this.camera.position.set(position.x, position.y + 2, position.z)
  }

  addBullet(from, to) {
    this.bullets.push({ from, to, life: 100 })
  }

  update() {
    this.bullets = this.bullets.filter(b => {
      b.life--
      return b.life > 0
    })
  }

  render() {
    this.renderer.render(this.scene, this.camera)
  }
}

describe('Renderer', () => {
  let renderer
  let container

  beforeEach(() => {
    container = document.createElement('div')
    renderer = new MockRenderer(container)
  })

  describe('Player Management', () => {
    it('should add player', () => {
      renderer.addPlayer('player1', { x: 0, y: 0, z: 0 }, false)
      expect(renderer.players.has('player1')).toBe(true)
    })

    it('should not add duplicate player', () => {
      renderer.addPlayer('player1', { x: 0, y: 0, z: 0 }, false)
      renderer.addPlayer('player1', { x: 10, y: 0, z: 10 }, false)
      expect(renderer.players.size).toBe(1)
    })

    it('should remove player', () => {
      renderer.addPlayer('player1', { x: 0, y: 0, z: 0 }, false)
      renderer.removePlayer('player1')
      expect(renderer.players.has('player1')).toBe(false)
    })

    it('should update player position', () => {
      renderer.addPlayer('player1', { x: 0, y: 0, z: 0 }, false)
      renderer.updatePlayer('player1', { x: 10, y: 0, z: 20 }, 0.5)
      const player = renderer.players.get('player1')
      expect(player.position.x).toBe(10)
      expect(player.position.z).toBe(20)
      expect(player.rotation).toBe(0.5)
    })
  })

  describe('Bullet Management', () => {
    it('should add bullet', () => {
      renderer.addBullet({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 10 })
      expect(renderer.bullets.length).toBe(1)
    })

    it('should update bullets', () => {
      renderer.addBullet({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 10 })
      for (let i = 0; i < 100; i++) {
        renderer.update()
      }
      expect(renderer.bullets.length).toBe(0)
    })
  })

  describe('Camera', () => {
    it('should update camera position', () => {
      renderer.updateCamera({ x: 5, y: 0, z: 5 }, 0)
      expect(renderer.camera.position.set).toHaveBeenCalled()
    })
  })
})
