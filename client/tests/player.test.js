import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalWindow = global.window
const originalDateNow = Date.now

async function loadPlayerController() {
  vi.resetModules()
  global.window = {
    audioManager: { playEmpty: vi.fn(), playShoot: vi.fn() },
    effectsSystem: { core: { createMuzzleFlash: vi.fn() } },
    dynamicCrosshair: { setShooting: vi.fn() },
    screenEffectsEnhanced: { shake: vi.fn() },
    ammoDisplayEnhanced: { update: vi.fn() },
    network: { connected: true, send: vi.fn() },
    uiManager: { updateAmmo: vi.fn() }
  }

  const mod = await import('../js/player.js')
  return mod.default || window.PlayerController
}

describe('PlayerController', () => {
  let PlayerController
  let player

  beforeEach(async () => {
    document.body.innerHTML = ''
    document.addEventListener = vi.fn()
    document.body.requestPointerLock = vi.fn()
    Object.defineProperty(document, 'pointerLockElement', {
      configurable: true,
      value: null
    })

    PlayerController = await loadPlayerController()
    player = new PlayerController()
  })

  afterEach(() => {
    global.window = originalWindow
    Date.now = originalDateNow
  })

  it('initializes with default combat stats', () => {
    expect(player.health).toBe(100)
    expect(player.maxHealth).toBe(100)
    expect(player.ammo).toBe(30)
    expect(player.ammoReserve).toBe(90)
    expect(player.weapon).toBe('rifle')
  })

  it('moves forward when W is pressed', () => {
    player.keys['KeyW'] = true
    const result = player.update()
    expect(result.position.z).toBeLessThan(0)
  })

  it('moves forward in the camera facing direction after turning right', () => {
    player.rotation = -Math.PI / 2
    player.keys['KeyW'] = true

    const result = player.update()

    expect(result.position.x).toBeGreaterThan(0)
    expect(Math.abs(result.position.z)).toBeLessThan(0.001)
  })

  it('jumps and becomes airborne when space is pressed on ground', () => {
    player.keys['Space'] = true
    player.update()

    expect(player.isGrounded).toBe(false)
    expect(player.velocity.y).toBeLessThan(player.jumpForce)
    expect(player.position.y).toBeGreaterThan(0)
  })

  it('lands back on the ground after enough updates', () => {
    player.keys['Space'] = true
    player.update()
    player.keys['Space'] = false

    for (let i = 0; i < 200; i++) {
      player.update()
    }

    expect(player.position.y).toBe(0)
    expect(player.velocity.y).toBe(0)
    expect(player.isGrounded).toBe(true)
  })

  it('shoots, reduces ammo, and sends a network event', () => {
    Date.now = vi.fn(() => 1000)
    const fired = player.shoot()

    expect(fired).toBe(true)
    expect(player.ammo).toBe(29)
    expect(window.network.send).toHaveBeenCalledWith('shoot', expect.objectContaining({
      position: expect.objectContaining({ x: 0, y: 1.7, z: 0 }),
      rotation: 0,
      pitch: 0
    }))
    expect(window.uiManager.updateAmmo).toHaveBeenCalledWith(29, 90)
  })

  it('does not shoot during cooldown', () => {
    Date.now = vi.fn(() => 1000)
    expect(player.shoot()).toBe(true)
    Date.now = vi.fn(() => 1050)
    expect(player.shoot()).toBe(false)
  })

  it('reloads from reserve ammo', () => {
    player.ammo = 10
    player.ammoReserve = 15

    player.reload()

    expect(player.ammo).toBe(25)
    expect(player.ammoReserve).toBe(0)
  })

  it('heals but does not exceed max health', () => {
    player.health = 60
    expect(player.heal(30)).toBe(90)
    expect(player.heal(50)).toBe(100)
  })

  it('respawns with full health and ammo', () => {
    player.health = 1
    player.ammo = 2
    player.position = { x: 999, y: 9, z: 999 }

    player.respawn()

    expect(player.health).toBe(100)
    expect(player.ammo).toBe(30)
    expect(player.position.y).toBe(0)
    expect(player.position.x).toBeGreaterThanOrEqual(-20)
    expect(player.position.x).toBeLessThanOrEqual(20)
    expect(player.position.z).toBeGreaterThanOrEqual(-20)
    expect(player.position.z).toBeLessThanOrEqual(20)
  })
})
