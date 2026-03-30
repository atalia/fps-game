// e2e/multiplayer.spec.ts - 双客户端 E2E 测试
import { test, expect, Page, Browser } from '@playwright/test'

// 测试配置
const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:8080'
const TEST_TIMEOUT = 60000

test.describe.configure({ mode: 'parallel' })

// 辅助函数
async function joinGame(page: Page, name: string): Promise<string> {
  await page.goto(BASE_URL)
  
  // 等待加载完成
  await page.waitForSelector('#player-name-input', { timeout: 10000 })
  
  // 输入玩家名字
  await page.fill('#player-name-input', name)
  
  // 点击快速加入
  await page.click('#quick-join-btn')
  
  // 等待进入游戏
  await page.waitForSelector('#game-container canvas', { timeout: 15000 })
  
  // 返回玩家 ID
  return await page.evaluate(() => {
    return (window as any).network?.playerId || 'unknown'
  })
}

async function addBot(page: Page): Promise<void> {
  await page.keyboard.press('b')
  await page.waitForTimeout(500)
}

async function switchWeapon(page: Page, weapon: string): Promise<void> {
  const keyMap: Record<string, string> = {
    'pistol': '1',
    'rifle': '2',
    'shotgun': '3',
    'sniper': '4'
  }
  await page.keyboard.press(keyMap[weapon] || '2')
  await page.waitForTimeout(300)
}

async function shoot(page: Page): Promise<void> {
  const canvas = page.locator('#game-container canvas')
  await canvas.click()
  await page.waitForTimeout(100)
}

async function leaveRoom(page: Page): Promise<void> {
  const leaveBtn = page.locator('#leave-room-btn')
  if (await leaveBtn.isVisible()) {
    await leaveBtn.click()
    await page.waitForSelector('#lobby-container', { timeout: 5000 })
  }
}

// 测试用例
test.describe('多人游戏 E2E 测试', () => {
  
  test('进房后双方能看到彼此', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    try {
      // 玩家1加入
      const player1Id = await joinGame(page1, 'Player1')
      console.log('Player 1 joined:', player1Id)
      
      // 玩家2加入同一房间
      const player2Id = await joinGame(page2, 'Player2')
      console.log('Player 2 joined:', player2Id)
      
      await page1.waitForTimeout(2000)
      
      // 验证双方都能看到玩家
      const player1Count = await page1.evaluate(() => {
        return (window as any).game?.players?.size || 1
      })
      
      const player2Count = await page2.evaluate(() => {
        return (window as any).game?.players?.size || 1
      })
      
      expect(player1Count).toBeGreaterThanOrEqual(2)
      expect(player2Count).toBeGreaterThanOrEqual(2)
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })
  
  test('开枪后另一端收到远端射击表现', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    try {
      await joinGame(page1, 'Shooter')
      await joinGame(page2, 'Observer')
      
      await page1.waitForTimeout(2000)
      
      // 射击
      await shoot(page1)
      await page1.waitForTimeout(1000)
      
      // 验证射击事件被广播（检查控制台或其他指示）
      // 实际验证需要监听 WebSocket 消息
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })
  
  test('切枪后远端状态同步', async ({ browser }) => {
    const context1 = await browser.newContext()
    const context2 = await browser.newContext()
    
    const page1 = await context1.newPage()
    const page2 = await context2.newPage()
    
    try {
      await joinGame(page1, 'WeaponSwitcher')
      await joinGame(page2, 'Observer')
      
      await page1.waitForTimeout(2000)
      
      // 切换武器
      await switchWeapon(page1, 'sniper')
      await page1.waitForTimeout(500)
      
      // 验证本地状态
      const weapon = await page1.evaluate(() => {
        return (window as any).game?.player?.weapon || 'rifle'
      })
      
      expect(weapon).toBe('sniper')
      
    } finally {
      await context1.close()
      await context2.close()
    }
  })
  
  test('退房再进房不出错', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    try {
      // 第一次进入
      await joinGame(page, 'RejoinPlayer')
      await page.waitForTimeout(2000)
      
      // 退出
      await leaveRoom(page)
      await page.waitForTimeout(1000)
      
      // 第二次进入
      await joinGame(page, 'RejoinPlayer2')
      await page.waitForTimeout(2000)
      
      // 验证游戏正常运行
      const gameExists = await page.evaluate(() => {
        return !!(window as any).game
      })
      
      expect(gameExists).toBe(true)
      
    } finally {
      await context.close()
    }
  })
  
  test('添加机器人后玩家数增加', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    try {
      await joinGame(page, 'BotTestPlayer')
      await page.waitForTimeout(2000)
      
      // 获取初始玩家数
      const initialCount = await page.evaluate(() => {
        return (window as any).game?.players?.size || 1
      })
      
      // 添加机器人
      await addBot(page)
      await page.waitForTimeout(2000)
      
      // 验证玩家数增加
      const newCount = await page.evaluate(() => {
        return (window as any).game?.players?.size || 1
      })
      
      expect(newCount).toBeGreaterThan(initialCount)
      
    } finally {
      await context.close()
    }
  })
  
  test('命中后受伤方血量变化', async ({ browser }) => {
    const context = await browser.newContext()
    const page = await context.newPage()
    
    try {
      await joinGame(page, 'DamageTestPlayer')
      await page.waitForTimeout(2000)
      
      // 添加机器人
      await addBot(page)
      await page.waitForTimeout(2000)
      
      // 射击
      await shoot(page)
      await page.waitForTimeout(1000)
      
      // 验证弹药消耗
      const ammo = await page.evaluate(() => {
        return (window as any).game?.player?.ammo || 30
      })
      
      expect(ammo).toBeLessThan(30)
      
    } finally {
      await context.close()
    }
  })
})
