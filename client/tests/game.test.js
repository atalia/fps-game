// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'

async function loadGame() {
  vi.resetModules()
  const mod = await import('../js/game.js')
  return mod.default || window.Game
}

describe('Game', () => {
  let Game

  beforeEach(async () => {
    document.body.innerHTML = `
      <input id="chat-input" />
      <span id="current-weapon"></span>
      <canvas id="minimap-canvas"></canvas>
    `

    global.window = {
      network: { send: vi.fn(), connected: true },
      audioManager: { playReload: vi.fn(), init: vi.fn(), resume: vi.fn() },
      uiManager: { showMessage: vi.fn(), updateAmmo: vi.fn(), showLowHealthWarning: vi.fn(), hideLowHealthWarning: vi.fn() }
    }

    Game = await loadGame()
  })

  it('sends chat message and clears input when enter is pressed', () => {
    const game = new Game()
    const input = document.getElementById('chat-input')
    const blurSpy = vi.spyOn(input, 'blur')

    game.setupChat()
    input.value = 'hello room'

    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.dispatchEvent(event)

    expect(window.network.send).toHaveBeenCalledWith('chat', { message: 'hello room' })
    expect(input.value).toBe('')
    expect(blurSpy).toHaveBeenCalled()
  })
})
