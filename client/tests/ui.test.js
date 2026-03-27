import { describe, it, expect, beforeEach } from 'vitest'

async function loadUIManager() {
  const mod = await import('../js/ui.js')
  return mod.default || window.UIManager
}

describe('UIManager', () => {
  let UIManager
  let ui

  beforeEach(async () => {
    document.body.innerHTML = `
      <div id="health-fill"></div>
      <div id="health-text"></div>
      <span id="ammo-count"></span>
      <span id="ammo-reserve"></span>
      <span id="current-weapon"></span>
      <span id="room-id"></span>
      <span id="player-count"></span>
      <div id="players-container"></div>
      <div id="connection-status"></div>
      <div id="chat-messages"></div>
      <input id="chat-input" />
      <div id="kill-feed"></div>
      <div id="scoreboard"></div>
      <tbody id="scoreboard-rows"></tbody>
    `
    UIManager = await loadUIManager()
    ui = new UIManager()
  })

  it('updates health bar and text', () => {
    ui.updateHealth(50)
    expect(ui.elements.healthFill.style.width).toBe('50%')
    expect(ui.elements.healthText.textContent).toBe('50 HP')
  })

  it('updates ammo counters', () => {
    ui.updateAmmo(30, 90)
    expect(ui.elements.ammo.textContent).toBe('30')
    expect(ui.elements.ammoReserve.textContent).toBe('90')
  })

  it('escapes html in player list names', () => {
    ui.updatePlayerList([
      { id: 'p1', name: '<script>alert(1)</script>', kills: 3, health: 90 }
    ])

    expect(ui.elements.playersContainer.innerHTML).not.toContain('<script>')
    expect(ui.elements.playersContainer.textContent).toContain('<script>alert(1)</script>')
  })

  it('updates connection status classes and text', () => {
    ui.updateConnectionStatus(true)
    expect(ui.elements.connectionStatus.textContent).toBe('已连接')
    expect(ui.elements.connectionStatus.className).toBe('connected')

    ui.updateConnectionStatus(false)
    expect(ui.elements.connectionStatus.textContent).toBe('已断开')
    expect(ui.elements.connectionStatus.className).toBe('disconnected')
  })

  it('renders chat messages with escaped content', () => {
    ui.addChatMessage('<b>alice</b>', '<img src=x onerror=1 />')
    expect(ui.elements.chatMessages.innerHTML).not.toContain('<img')
    expect(ui.elements.chatMessages.textContent).toContain('<b>alice</b>: <img src=x onerror=1 />')
  })
})
