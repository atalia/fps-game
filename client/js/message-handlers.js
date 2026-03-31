// message-handlers.js - 可测试的消息处理函数（从 main.js 提取）

/**
 * 这些函数从 main.js 的 network.on 回调中提取，
 * 用于单元测试。main.js 中的回调调用这些函数。
 */

// 依赖注入容器
export function createMessageHandlers(deps) {
  const {
    game,
    renderer,
    uiManager,
    audioManager,
    screenEffects,
    hitIndicator,
    effectsSystem,
    damageNumber,
    dynamicCrosshair,
    hitEffects,
    killNotice,
    killstreakEnhanced,
    aiLabels
  } = deps

  return {
    /**
     * 处理 player_damaged 消息
     * main.js line 292-328
     */
    handlePlayerDamaged(data) {
      // 更新血量
      if (data.player_id === game?.player?.id) {
        game.player.health = data.remaining_health
        uiManager.updateHealth(data.remaining_health)

        // 屏幕闪红 + 受击指示
        if (screenEffects) {
          screenEffects.flashDamage()
        }
        if (hitIndicator && data.attacker_position) {
          hitIndicator.show(data.attacker_position, data.damage)
        }
      } else {
        // 显示命中标记 (射击者视角)
        if (data.attacker_id === game?.player?.id) {
          // 命中粒子效果
          if (effectsSystem?.core) {
            effectsSystem.core.createHitBurst(data.position, data.hitbox === 'head')
          }
          // 血迹效果
          if (effectsSystem?.core) {
            effectsSystem.core.createBloodSplatter(data.position)
          }
          // 伤害数字
          if (damageNumber) {
            damageNumber.show(data.damage, data.position, { isHeadshot: data.hitbox === 'head' })
          }
          // 准星命中反馈
          if (dynamicCrosshair) {
            dynamicCrosshair.showHit()
          }
          // 命中音效
          if (audioManager) {
            audioManager.playHit()
          }
        }
      }
    },

    /**
     * 处理 player_shot 消息
     * main.js line 279-289
     */
    handlePlayerShot(data) {
      // 使用正确的武器音效
      const weaponId = data.weapon_id || 'rifle'
      audioManager.playShoot(weaponId)

      // 使用服务端提供的方向，如果没有则使用默认方向
      if (data.position) {
        const direction = data.direction || { x: 0, y: 0, z: -1 }
        renderer.addProjectile(data.position, direction)
      }
    },

    /**
     * 处理 player_killed 消息
     * main.js line 331-358
     */
    handlePlayerKilled(data) {
      // 更新击杀计数
      if (data.killer_id === game?.player?.id) {
        game.player.kills++
        uiManager.updateKills(game.player.kills)
        uiManager.addKillFeed(`击杀 ${data.victim_id}${data.is_headshot ? ' (爆头!)' : ''}`)
        
        // 击杀音效
        if (audioManager) {
          audioManager.playKill()
        }
        
        // 新特效系统
        if (killNotice) {
          killNotice.show(data.victim_id, { isHeadshot: data.is_headshot })
        }
        if (killstreakEnhanced) {
          killstreakEnhanced.addKill()
        }
        if (screenEffects) {
          screenEffects.flashKill()
        }
      }

      if (data.victim_id === game?.player?.id) {
        game.player.deaths++
        uiManager.updateDeaths(game.player.deaths)
        uiManager.showDeathScreen()
      }
    },

    /**
     * 处理 weapon_changed 消息
     * main.js line 387-401
     */
    handleWeaponChanged(data) {
      // 更新本地玩家武器状态
      if (data.player_id === game?.player?.id) {
        game.player.weapon = data.weapon
        uiManager.showMessage(`切换到 ${data.weapon}`)
      }
      
      // 更新玩家列表中的武器
      if (game?.players) {
        const player = game.players.get(data.player_id)
        if (player) {
          player.weapon = data.weapon
        }
      }
    },

    /**
     * 处理 player_joined 消息
     * main.js line 186-217
     */
    handlePlayerJoined(data) {
      const position = data.position || { x: 0, y: 0, z: 0 }
      const isBot = data.is_bot || false
      renderer.addPlayer(data.player_id, position, isBot)

      // 如果是机器人，显示 AI 标签
      if (isBot && aiLabels) {
        aiLabels.createLabel(data.player_id, data.name, data.difficulty)
      }

      uiManager.addKillFeed(`${data.name || data.player_id} 加入了游戏`)

      // 同步到 game.players Map
      if (game?.players) {
        game.players.set(data.player_id, {
          id: data.player_id,
          name: data.name,
          position: position,
          rotation: 0,
          is_bot: isBot,
          kills: data.kills || 0,
          health: data.health || 100
        })
      }
    },

    /**
     * 处理 player_respawned 消息
     * main.js line 361-372
     */
    handlePlayerRespawned(data) {
      if (data.player_id === game?.player?.id) {
        game.player.health = data.health
        game.player.position = data.position
        uiManager.updateHealth(data.health)
        uiManager.hideDeathScreen()
      }

      renderer.updatePlayer(data.player_id, data.position, 0)
    }
  }
}
