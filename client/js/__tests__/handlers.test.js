// handlers.test.js - 消息处理链测试
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock 全局对象
const mockRenderer = {
  addPlayer: vi.fn(),
  removePlayer: vi.fn(),
  updatePlayerPosition: vi.fn(),
  addProjectile: vi.fn(),
  clearPlayers: vi.fn(),
  scene: { add: vi.fn(), remove: vi.fn() }
}

const mockUIManager = {
  updateHealth: vi.fn(),
  updateAmmo: vi.fn(),
  updatePlayerList: vi.fn(),
  showMessage: vi.fn(),
  addKillFeed: vi.fn(),
  showDamageIndicator: vi.fn()
}

const mockAudioManager = {
  playShoot: vi.fn(),
  playHit: vi.fn(),
  playKill: vi.fn(),
  playReload: vi.fn()
}

const mockNetwork = {
  send: vi.fn(),
  on: vi.fn(),
  playerId: 'test-player-123',
  connected: true
}

const mockEffectsSystem = {
  addEffect: vi.fn(),
  showHitMarker: vi.fn(),
  showDamageNumber: vi.fn()
}

// 模拟游戏状态
const createMockGameState = () => ({
  player: {
    id: 'test-player-123',
    health: 100,
    ammo: 30,
    weapon: 'rifle',
    kills: 0,
    deaths: 0
  },
  players: new Map([
    ['test-player-123', { id: 'test-player-123', name: 'TestPlayer', health: 100 }]
  ])
})

// 设置全局 mock
beforeEach(() => {
  // 每次测试创建新的游戏状态
  const freshGameState = createMockGameState()
  
  vi.stubGlobal('window', {
    renderer: mockRenderer,
    uiManager: mockUIManager,
    audioManager: mockAudioManager,
    network: mockNetwork,
    effectsSystem: mockEffectsSystem,
    game: freshGameState,
    performanceMonitor: { update: vi.fn() }
  })
  
  // 重置所有 mock
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// 消息处理器
function createMessageHandlers() {
  return {
    handlePlayerDamaged: (data) => {
      const window = globalThis.window
      
      // 更新血量
      if (data.player_id === window.game.player.id) {
        window.game.player.health = data.remaining_health
        window.uiManager.updateHealth(data.remaining_health)
        
        // 显示受伤指示器
        if (data.attacker_position) {
          window.uiManager.showDamageIndicator(data.attacker_position)
        }
      }
      
      // 更新玩家列表中的血量
      const player = window.game.players.get(data.player_id)
      if (player) {
        player.health = data.remaining_health
      }
    },
    
    handlePlayerShot: (data) => {
      const window = globalThis.window
      
      // 播放射击音效
      const weaponId = data.weapon_id || 'rifle'
      window.audioManager.playShoot(weaponId)
      
      // 添加弹道效果
      if (data.position) {
        const direction = data.direction || { x: 0, y: 0, z: -1 }
        window.renderer.addProjectile(data.position, direction)
      }
    },
    
    handleWeaponChanged: (data) => {
      const window = globalThis.window
      
      // 更新武器状态
      if (data.player_id === window.game.player.id) {
        window.game.player.weapon = data.weapon
        window.uiManager.showMessage(`切换到 ${data.weapon}`)
      }
      
      // 更新玩家列表
      const player = window.game.players.get(data.player_id)
      if (player) {
        player.weapon = data.weapon
      }
    },
    
    handlePlayerKilled: (data) => {
      const window = globalThis.window
      
      // 如果是自己死亡
      if (data.victim_id === window.game.player.id) {
        window.game.player.deaths++
        window.uiManager.showMessage('你被击杀了！')
        
        // 更新击杀者的击杀数
        if (data.killer_id === window.game.player.id) {
          // 自杀不计击杀
        }
      }
      
      // 如果自己击杀了敌人
      if (data.killer_id === window.game.player.id && data.victim_id !== window.game.player.id) {
        window.game.player.kills++
        window.audioManager.playKill()
        window.uiManager.addKillFeed(`你击杀了敌人`)
      }
      
      // 更新击杀信息
      window.uiManager.addKillFeed(`${data.victim_id} 被 ${data.killer_id} 击杀`)
    },
    
    handlePlayerJoined: (data) => {
      const window = globalThis.window
      
      // 添加到玩家列表
      window.game.players.set(data.player_id, {
        id: data.player_id,
        name: data.name,
        health: data.health || 100,
        position: data.position,
        is_bot: data.is_bot || false
      })
      
      // 渲染器添加玩家模型
      window.renderer.addPlayer(data.player_id, data.position || { x: 0, y: 0, z: 0 }, data.is_bot || false)
      
      // 显示加入消息
      window.uiManager.addKillFeed(`${data.name} 加入了游戏`)
    }
  }
}

// 测试
describe('消息处理链测试', () => {
  const handlers = createMessageHandlers()
  
  describe('player_damaged 处理链', () => {
    it('更新本地玩家血量并调用 UI', () => {
      const data = {
        player_id: 'test-player-123',
        attacker_id: 'enemy-456',
        attacker_position: { x: 10, y: 0, z: 20 },
        damage: 25,
        remaining_health: 75
      }
      
      handlers.handlePlayerDamaged(data)
      
      expect(window.game.player.health).toBe(75)
      expect(mockUIManager.updateHealth).toHaveBeenCalledWith(75)
      expect(mockUIManager.showDamageIndicator).toHaveBeenCalledWith({ x: 10, y: 0, z: 20 })
    })
    
    it('不更新其他玩家的 UI', () => {
      const data = {
        player_id: 'other-player',
        attacker_id: 'test-player-123',
        damage: 30,
        remaining_health: 70
      }
      
      handlers.handlePlayerDamaged(data)
      
      // 不应该更新本地玩家血量
      expect(window.game.player.health).toBe(100)
      expect(mockUIManager.updateHealth).not.toHaveBeenCalled()
    })
    
    it('更新玩家列表中的血量', () => {
      window.game.players.set('other-player', { id: 'other-player', health: 100 })
      
      const data = {
        player_id: 'other-player',
        attacker_id: 'test-player-123',
        damage: 40,
        remaining_health: 60
      }
      
      handlers.handlePlayerDamaged(data)
      
      expect(window.game.players.get('other-player').health).toBe(60)
    })
  })
  
  describe('player_shot 处理链', () => {
    it('播放正确的武器音效', () => {
      const data = {
        player_id: 'enemy-456',
        weapon_id: 'sniper',
        position: { x: 0, y: 1.7, z: 0 }
      }
      
      handlers.handlePlayerShot(data)
      
      expect(mockAudioManager.playShoot).toHaveBeenCalledWith('sniper')
    })
    
    it('添加弹道效果', () => {
      const data = {
        player_id: 'enemy-456',
        weapon_id: 'rifle',
        position: { x: 10, y: 1.7, z: 20 },
        direction: { x: 0, y: 0, z: -1 }
      }
      
      handlers.handlePlayerShot(data)
      
      expect(mockRenderer.addProjectile).toHaveBeenCalledWith(
        { x: 10, y: 1.7, z: 20 },
        { x: 0, y: 0, z: -1 }
      )
    })
    
    it('使用默认值当缺少字段时', () => {
      const data = {
        player_id: 'enemy-456',
        position: { x: 0, y: 0, z: 0 }
      }
      
      handlers.handlePlayerShot(data)
      
      expect(mockAudioManager.playShoot).toHaveBeenCalledWith('rifle')
      expect(mockRenderer.addProjectile).toHaveBeenCalled()
    })
  })
  
  describe('weapon_changed 处理链', () => {
    it('更新本地玩家武器状态', () => {
      const data = {
        player_id: 'test-player-123',
        weapon: 'shotgun'
      }
      
      handlers.handleWeaponChanged(data)
      
      expect(window.game.player.weapon).toBe('shotgun')
      expect(mockUIManager.showMessage).toHaveBeenCalledWith('切换到 shotgun')
    })
    
    it('更新玩家列表中的武器', () => {
      window.game.players.set('other-player', { id: 'other-player', weapon: 'rifle' })
      
      const data = {
        player_id: 'other-player',
        weapon: 'pistol'
      }
      
      handlers.handleWeaponChanged(data)
      
      expect(window.game.players.get('other-player').weapon).toBe('pistol')
    })
  })
  
  describe('player_killed 处理链', () => {
    it('处理自己被击杀', () => {
      const data = {
        victim_id: 'test-player-123',
        killer_id: 'enemy-456',
        weapon_id: 'rifle',
        is_headshot: true
      }
      
      handlers.handlePlayerKilled(data)
      
      expect(window.game.player.deaths).toBe(1)
      expect(mockUIManager.showMessage).toHaveBeenCalledWith('你被击杀了！')
    })
    
    it('处理自己击杀敌人', () => {
      window.game.player.kills = 0
      
      const data = {
        victim_id: 'enemy-456',
        killer_id: 'test-player-123',
        weapon_id: 'sniper',
        is_headshot: true
      }
      
      handlers.handlePlayerKilled(data)
      
      expect(window.game.player.kills).toBe(1)
      expect(mockAudioManager.playKill).toHaveBeenCalled()
    })
    
    it('显示击杀信息', () => {
      const data = {
        victim_id: 'player-1',
        killer_id: 'player-2',
        weapon_id: 'pistol'
      }
      
      handlers.handlePlayerKilled(data)
      
      expect(mockUIManager.addKillFeed).toHaveBeenCalled()
    })
  })
  
  describe('player_joined 处理链', () => {
    it('添加新玩家到列表和渲染器', () => {
      const data = {
        player_id: 'new-player-789',
        name: 'NewPlayer',
        position: { x: 15, y: 0, z: 25 },
        health: 100,
        is_bot: false
      }
      
      handlers.handlePlayerJoined(data)
      
      expect(window.game.players.has('new-player-789')).toBe(true)
      expect(mockRenderer.addPlayer).toHaveBeenCalledWith(
        'new-player-789',
        { x: 15, y: 0, z: 25 },
        false
      )
      expect(mockUIManager.addKillFeed).toHaveBeenCalledWith('NewPlayer 加入了游戏')
    })
    
    it('正确处理机器人加入', () => {
      const data = {
        player_id: 'bot-123',
        name: 'Bot',
        position: { x: 0, y: 0, z: 0 },
        is_bot: true,
        difficulty: 'normal'
      }
      
      handlers.handlePlayerJoined(data)
      
      expect(window.game.players.get('bot-123').is_bot).toBe(true)
      expect(mockRenderer.addPlayer).toHaveBeenCalledWith(
        'bot-123',
        { x: 0, y: 0, z: 0 },
        true  // is_bot
      )
    })
  })
})
