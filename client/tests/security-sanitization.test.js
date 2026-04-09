import { describe, it, expect, beforeEach, vi } from 'vitest'

async function loadKillFeed() {
  vi.resetModules()
  const mod = await import('../js/killfeed.js')
  return mod.default || window.KillFeed
}

async function loadScoreboard() {
  vi.resetModules()
  const mod = await import('../js/scoreboard.js')
  return mod.default || window.Scoreboard
}

async function loadAILabels() {
  vi.resetModules()
  const mod = await import('../js/ai-labels.js')
  return mod.default || window.AILabels
}

// @vitest-environment jsdom
describe('security sanitization', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="kill-feed"></div>
      <div id="scoreboard"></div>
      <div id="scoreboard-rows"></div>
    `
  })

  it('escapes killfeed content from user-controlled strings', async () => {
    const KillFeed = await loadKillFeed()
    const killFeed = new KillFeed()

    killFeed.add('<img src=x onerror=1>', '<svg/onload=1>', '<script>alert(1)</script>', true)

    expect(killFeed.container.innerHTML).not.toContain('<img')
    expect(killFeed.container.innerHTML).not.toContain('<svg')
    expect(killFeed.container.innerHTML).not.toContain('<script>')
    expect(killFeed.container.textContent).toContain('<img src=x onerror=1>')
    expect(killFeed.container.textContent).toContain('<svg/onload=1>')
    expect(killFeed.container.textContent).toContain('<script>alert(1)</script>')
  })

  it('escapes scoreboard player names', async () => {
    const Scoreboard = await loadScoreboard()
    const scoreboard = new Scoreboard()

    scoreboard.update([
      { name: '<img src=x onerror=1>', kills: 10, deaths: 2, score: 100 },
      { name: 'safe', kills: 5, deaths: 1, score: 50 }
    ])

    expect(scoreboard.rowsContainer.innerHTML).not.toContain('<img')
    expect(scoreboard.rowsContainer.textContent).toContain('<img src=x onerror=1>')
  })

  it('escapes ai label names', async () => {
    const AILabels = await loadAILabels()
    const aiLabels = new AILabels()

    const label = aiLabels.createLabel('bot-1', '<img src=x onerror=1>', 'hard')

    expect(label.innerHTML).not.toContain('<img')
    expect(label.textContent).toContain('[BOT]')
    expect(label.textContent).toContain('<img src=x onerror=1>')
  })
})
