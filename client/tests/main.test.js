import { describe, it, expect, beforeEach, vi } from 'vitest'

async function loadMain() {
  vi.resetModules()
  const mod = await import('../js/main.js')
  return mod
}

describe('main init', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="loading"><p>loading...</p></div>
      <div id="game-container"></div>
    `
    global.window = global.window || {}
    window.__FPS_DISABLE_AUTO_INIT__ = true
  })

  it('renders a failure message when AudioManager is missing', async () => {
    const main = await loadMain()

    await main.init()

    expect(document.getElementById('loading').textContent).toContain('初始化失败')
    expect(document.getElementById('loading').textContent).toContain('AudioManager 类未定义')
  })
})
