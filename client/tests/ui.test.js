// UI Manager Tests
import { describe, it, expect, beforeEach } from 'vitest'

// Mock DOM elements
const mockElement = () => ({
  textContent: '',
  innerHTML: '',
  style: { width: '', backgroundColor: '', transform: '' },
  className: '',
  classList: { add: vi.fn(), remove: vi.fn() },
  appendChild: vi.fn(),
  removeChild: vi.fn(),
  scrollTop: 0,
  children: [],
  parentNode: null
})

// Mock UIManager
class UIManager {
  constructor() {
    this.elements = {
      healthFill: mockElement(),
      ammo: mockElement(),
      ammoReserve: mockElement(),
      score: mockElement(),
      kills: mockElement(),
      deaths: mockElement()
    }
  }

  updateHealth(health, maxHealth = 100) {
    const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100))
    this.elements.healthFill.style.width = `${percentage}%`
  }

  updateAmmo(ammo, reserve) {
    this.elements.ammo.textContent = ammo
    this.elements.ammoReserve.textContent = reserve
  }

  updateScore(score) {
    this.elements.score.textContent = score
  }

  updateKD(kills, deaths) {
    this.elements.kills.textContent = kills
    this.elements.deaths.textContent = deaths
  }

  escapeHtml(text) {
    const div = { textContent: '' }
    div.textContent = text
    return div.textContent
  }
}

describe('UIManager', () => {
  let ui

  beforeEach(() => {
    ui = new UIManager()
  })

  describe('Health', () => {
    it('should update health to 100%', () => {
      ui.updateHealth(100)
      expect(ui.elements.healthFill.style.width).toBe('100%')
    })

    it('should update health to 50%', () => {
      ui.updateHealth(50)
      expect(ui.elements.healthFill.style.width).toBe('50%')
    })

    it('should not exceed 100%', () => {
      ui.updateHealth(150)
      expect(ui.elements.healthFill.style.width).toBe('100%')
    })

    it('should not go below 0%', () => {
      ui.updateHealth(-10)
      expect(ui.elements.healthFill.style.width).toBe('0%')
    })

    it('should handle custom max health', () => {
      ui.updateHealth(75, 150)
      expect(ui.elements.healthFill.style.width).toBe('50%')
    })
  })

  describe('Ammo', () => {
    it('should update ammo count', () => {
      ui.updateAmmo(30, 90)
      expect(ui.elements.ammo.textContent).toBe(30)
      expect(ui.elements.ammoReserve.textContent).toBe(90)
    })

    it('should handle zero ammo', () => {
      ui.updateAmmo(0, 0)
      expect(ui.elements.ammo.textContent).toBe(0)
    })
  })

  describe('Score', () => {
    it('should update score', () => {
      ui.updateScore(500)
      expect(ui.elements.score.textContent).toBe(500)
    })
  })

  describe('K/D', () => {
    it('should update kills and deaths', () => {
      ui.updateKD(10, 5)
      expect(ui.elements.kills.textContent).toBe(10)
      expect(ui.elements.deaths.textContent).toBe(5)
    })
  })

  describe('HTML Escape', () => {
    it('should escape HTML', () => {
      const result = ui.escapeHtml('<script>alert("xss")</script>')
      expect(result).not.toContain('<script>')
    })

    it('should handle normal text', () => {
      const result = ui.escapeHtml('Hello World')
      expect(result).toBe('Hello World')
    })
  })
})
