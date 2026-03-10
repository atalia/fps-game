// Player Controller Tests
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock PlayerController
class PlayerController {
  constructor() {
    this.position = { x: 0, y: 0, z: 0 }
    this.rotation = 0
    this.pitch = 0
    this.velocity = { x: 0, y: 0, z: 0 }
    this.speed = 0.15
    this.jumpForce = 0.3
    this.gravity = -0.02
    this.onGround = true
    this.health = 100
    this.ammo = 30
    this.ammoReserve = 90
    this.kills = 0
    this.deaths = 0
    this.score = 0
    this.canShoot = true
    this.shootCooldown = 100
    this.keys = { forward: false, backward: false, left: false, right: false, jump: false }
    this.mouse = { sensitivity: 0.002, locked: false }
  }

  setKey(key, value) {
    this.keys[key] = value
  }

  update() {
    const moveDirection = { x: 0, z: 0 }

    if (this.keys.forward) {
      moveDirection.x += Math.sin(this.rotation)
      moveDirection.z += Math.cos(this.rotation)
    }
    if (this.keys.backward) {
      moveDirection.x -= Math.sin(this.rotation)
      moveDirection.z -= Math.cos(this.rotation)
    }
    if (this.keys.left) {
      moveDirection.x += Math.cos(this.rotation)
      moveDirection.z -= Math.sin(this.rotation)
    }
    if (this.keys.right) {
      moveDirection.x -= Math.cos(this.rotation)
      moveDirection.z += Math.sin(this.rotation)
    }

    const length = Math.sqrt(moveDirection.x ** 2 + moveDirection.z ** 2)
    if (length > 0) {
      moveDirection.x /= length
      moveDirection.z /= length
    }

    this.position.x += moveDirection.x * this.speed
    this.position.z += moveDirection.z * this.speed

    if (this.keys.jump && this.onGround) {
      this.velocity.y = this.jumpForce
      this.onGround = false
    }

    this.velocity.y += this.gravity
    this.position.y += this.velocity.y

    if (this.position.y <= 0) {
      this.position.y = 0
      this.velocity.y = 0
      this.onGround = true
    }

    const boundary = 48
    this.position.x = Math.max(-boundary, Math.min(boundary, this.position.x))
    this.position.z = Math.max(-boundary, Math.min(boundary, this.position.z))

    return { position: { ...this.position }, rotation: this.rotation }
  }

  shoot() {
    if (!this.canShoot || this.ammo <= 0) return false
    this.ammo--
    this.canShoot = false
    setTimeout(() => { this.canShoot = true }, this.shootCooldown)
    return true
  }

  reload() {
    const needed = 30 - this.ammo
    if (needed <= 0 || this.ammoReserve <= 0) return
    const toReload = Math.min(needed, this.ammoReserve)
    this.ammo += toReload
    this.ammoReserve -= toReload
  }

  takeDamage(damage) {
    this.health -= damage
    if (this.health <= 0) {
      this.health = 0
      this.die()
    }
    return this.health
  }

  die() {
    this.deaths++
    setTimeout(() => this.respawn(), 3000)
  }

  respawn() {
    this.health = 100
    this.ammo = 30
    this.position = {
      x: (Math.random() - 0.5) * 40,
      y: 0,
      z: (Math.random() - 0.5) * 40
    }
  }

  addKill() {
    this.kills++
    this.score += 100
  }
}

describe('PlayerController', () => {
  let player

  beforeEach(() => {
    player = new PlayerController()
  })

  describe('Initial State', () => {
    it('should initialize with default values', () => {
      expect(player.health).toBe(100)
      expect(player.ammo).toBe(30)
      expect(player.ammoReserve).toBe(90)
      expect(player.kills).toBe(0)
      expect(player.deaths).toBe(0)
      expect(player.score).toBe(0)
    })

    it('should start at origin', () => {
      expect(player.position.x).toBe(0)
      expect(player.position.y).toBe(0)
      expect(player.position.z).toBe(0)
    })
  })

  describe('Movement', () => {
    it('should move forward', () => {
      player.setKey('forward', true)
      const result = player.update()
      expect(result.position.z).toBeGreaterThan(0)
    })

    it('should move backward', () => {
      player.setKey('backward', true)
      const result = player.update()
      expect(result.position.z).toBeLessThan(0)
    })

    it('should move left', () => {
      player.setKey('left', true)
      const result = player.update()
      expect(result.position.x).toBeGreaterThan(0)
    })

    it('should move right', () => {
      player.setKey('right', true)
      const result = player.update()
      expect(result.position.x).toBeLessThan(0)
    })

    it('should not move when no keys pressed', () => {
      const result = player.update()
      expect(result.position.x).toBe(0)
      expect(result.position.z).toBe(0)
    })

    it('should normalize diagonal movement', () => {
      player.setKey('forward', true)
      player.setKey('right', true)
      const result = player.update()
      const distance = Math.sqrt(result.position.x ** 2 + result.position.z ** 2)
      expect(distance).toBeCloseTo(player.speed, 1)
    })
  })

  describe('Jump', () => {
    it('should jump when on ground', () => {
      player.setKey('jump', true)
      player.update()
      expect(player.velocity.y).toBe(player.jumpForce)
      expect(player.onGround).toBe(false)
    })

    it('should not jump when in air', () => {
      player.setKey('jump', true)
      player.update()
      player.setKey('jump', false)
      player.update()
      player.setKey('jump', true)
      const velocityBeforeJump = player.velocity.y
      player.update()
      expect(player.velocity.y).toBeLessThan(velocityBeforeJump) // Still falling
    })
  })

  describe('Gravity', () => {
    it('should apply gravity when in air', () => {
      player.setKey('jump', true)
      player.update()
      player.update()
      expect(player.velocity.y).toBeLessThan(player.jumpForce)
    })

    it('should land on ground', () => {
      player.setKey('jump', true)
      player.update()
      // Simulate falling
      for (let i = 0; i < 50; i++) {
        player.update()
      }
      expect(player.position.y).toBe(0)
      expect(player.onGround).toBe(true)
    })
  })

  describe('Boundary', () => {
    it('should not exceed positive boundary', () => {
      player.position.x = 50
      player.position.z = 50
      player.update()
      expect(player.position.x).toBeLessThanOrEqual(48)
      expect(player.position.z).toBeLessThanOrEqual(48)
    })

    it('should not exceed negative boundary', () => {
      player.position.x = -50
      player.position.z = -50
      player.update()
      expect(player.position.x).toBeGreaterThanOrEqual(-48)
      expect(player.position.z).toBeGreaterThanOrEqual(-48)
    })
  })

  describe('Shooting', () => {
    it('should shoot successfully', () => {
      const result = player.shoot()
      expect(result).toBe(true)
      expect(player.ammo).toBe(29)
    })

    it('should not shoot without ammo', () => {
      player.ammo = 0
      const result = player.shoot()
      expect(result).toBe(false)
    })

    it('should not shoot during cooldown', () => {
      player.shoot()
      player.canShoot = false
      const result = player.shoot()
      expect(result).toBe(false)
    })
  })

  describe('Reload', () => {
    it('should reload ammo', () => {
      player.ammo = 20
      player.reload()
      expect(player.ammo).toBe(30)
      expect(player.ammoReserve).toBe(80)
    })

    it('should not reload when full', () => {
      player.ammo = 30
      player.reload()
      expect(player.ammo).toBe(30)
      expect(player.ammoReserve).toBe(90)
    })

    it('should not reload without reserve', () => {
      player.ammo = 20
      player.ammoReserve = 0
      player.reload()
      expect(player.ammo).toBe(20)
    })
  })

  describe('Health & Death', () => {
    it('should take damage', () => {
      player.takeDamage(30)
      expect(player.health).toBe(70)
    })

    it('should die when health reaches 0', () => {
      player.takeDamage(100)
      expect(player.health).toBe(0)
      expect(player.deaths).toBe(1)
    })

    it('should not have negative health', () => {
      player.takeDamage(200)
      expect(player.health).toBe(0)
    })
  })

  describe('Score', () => {
    it('should add kill', () => {
      player.addKill()
      expect(player.kills).toBe(1)
      expect(player.score).toBe(100)
    })

    it('should accumulate score', () => {
      player.addKill()
      player.addKill()
      expect(player.kills).toBe(2)
      expect(player.score).toBe(200)
    })
  })
})
