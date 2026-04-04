// message-handlers.js - 可测试的消息处理函数（从 main.js 提取）
// 注意：不使用 ES6 export，使用全局函数供 main.js 调用

/**
 * 创建消息处理器
 * 必须在 window.game 创建后调用（即进房后）
 */
function createMessageHandlers(deps) {
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
    aiLabels,
  } = deps;

  return {
    /**
     * 处理 player_damaged 消息
     * 对应 main.js line 292-328 的真实逻辑
     */
    handlePlayerDamaged(data) {
      // 更新血量
      if (data.player_id === game?.player?.id) {
        game.player.health = data.remaining_health;
        uiManager.updateHealth(data.remaining_health);

        // 屏幕闪红 + 受击指示
        if (screenEffects) {
          screenEffects.flashDamage();
        }
        if (hitIndicator && data.attacker_position) {
          hitIndicator.show(data.attacker_position, data.damage);
        }
      } else {
        // 显示命中标记 (射击者视角)
        if (data.attacker_id === game?.player?.id) {
          // 命中粒子效果
          if (effectsSystem?.core) {
            effectsSystem.core.createHitBurst(
              data.position,
              data.hitbox === "head",
            );
          }
          // 血迹效果
          if (effectsSystem?.core) {
            effectsSystem.core.createBloodSplatter(data.position);
          }
          // 伤害数字
          if (damageNumber) {
            damageNumber.show(data.damage, data.position, {
              isHeadshot: data.hitbox === "head",
            });
          }
          // 准星命中反馈
          if (dynamicCrosshair) {
            dynamicCrosshair.showHit();
          }
          // 命中音效
          if (audioManager) {
            audioManager.playHit();
          }
          // 兼容旧系统 - hitEffects
          if (hitEffects && data.position) {
            // 使用 THREE.Vector3 如果可用，否则直接传对象
            let pos = data.position;
            if (
              typeof THREE !== "undefined" &&
              THREE !== null &&
              THREE.Vector3
            ) {
              pos = new THREE.Vector3(
                data.position.x,
                data.position.y,
                data.position.z,
              );
            }
            hitEffects.showHitMarker(pos, data.hitbox, data.damage);
          }
        }
      }
    },

    /**
     * 处理 player_shot 消息
     * 对应 main.js line 279-289
     */
    handlePlayerShot(data) {
      // 使用正确的武器音效
      const weaponId = data.weapon_id || "rifle";
      audioManager.playShoot(weaponId);

      // 使用服务端提供的方向，如果没有则使用默认方向
      if (data.position) {
        const direction = data.direction || { x: 0, y: 0, z: -1 };
        renderer.addProjectile(data.position, direction);
      }
    },

    /**
     * 处理 player_killed 消息
     * 对应 main.js line 331-358
     */
    handlePlayerKilled(data) {
      const resolvePlayerName = (playerId) => {
        if (!playerId) return "Unknown";
        if (playerId === game?.player?.id) {
          return game?.player?.name || "YOU";
        }
        return game?.players?.get(playerId)?.name || playerId;
      };

      if (data.weapon_id) {
        uiManager.addKillFeed({
          killer: resolvePlayerName(data.killer_id),
          victim: resolvePlayerName(data.victim_id),
          killer_id: data.killer_id,
          victim_id: data.victim_id,
          weapon: data.weapon_id,
          isHeadshot: data.is_headshot,
        });
      }

      // 更新击杀计数
      if (data.killer_id === game?.player?.id) {
        game.player.kills++;
        uiManager.updateKills(game.player.kills);
        if (!data.weapon_id) {
          uiManager.addKillFeed(
            `击杀 ${data.victim_id}${data.is_headshot ? " (爆头!)" : ""}`,
          );
        }

        // 击杀音效
        if (audioManager) {
          audioManager.playKill();
        }

        // 新特效系统
        if (killNotice) {
          killNotice.show(resolvePlayerName(data.victim_id), {
            isHeadshot: data.is_headshot,
            weapon: data.weapon_id,
          });
        }
        if (killstreakEnhanced) {
          killstreakEnhanced.addKill();
        }
        if (screenEffects) {
          screenEffects.flashKill();
        }
      }

      if (data.victim_id === game?.player?.id) {
        game.player.deaths++;
        uiManager.updateDeaths(game.player.deaths);
        uiManager.showDeathScreen();
      }
    },

    /**
     * 处理 weapon_changed 消息
     * 对应 main.js line 387-401
     */
    handleWeaponChanged(data) {
      const weaponConfig = window.weaponSystem?.getWeapon?.(data.weapon);
      const weaponLabel = weaponConfig?.name || data.weapon;
      const silentReason =
        data.reason === "round_reset" || data.reason === "team_join";

      // 更新本地玩家武器状态
      if (data.player_id === game?.player?.id) {
        game.player.ownWeapon?.(data.weapon);
        game.player.weapon = data.weapon;
        if (weaponConfig) {
          game.player.maxAmmo = weaponConfig.magSize;
          game.player.ammoReserve =
            weaponConfig.reserveAmmo ?? game.player.ammoReserve;
        }
        uiManager.updateWeapon(weaponLabel);
        if (weaponConfig) {
          uiManager.updateAmmo(
            game.player.ammo || weaponConfig.magSize,
            game.player.ammoReserve,
          );
        }
        if (!silentReason) {
          uiManager.showMessage(`切换到 ${weaponLabel}`);
        }
      }

      // 更新玩家列表中的武器
      if (game?.players) {
        const player = game.players.get(data.player_id);
        if (player) {
          player.weapon = data.weapon;
        }
      }
    },

    handleMoneyUpdated(data) {
      if (data.player_id !== game?.player?.id) {
        return;
      }

      game.player.money = data.money;
      uiManager.updateMoney?.(data.money);
      window.buyMenuUI?.refresh?.();
    },

    handleRoundState(data) {
      if (game) {
        game.roundState = { ...data };
      }
      if (typeof window !== "undefined") {
        window.roundState = { ...data };
      }
      uiManager.updateRoundState?.(data);
      window.buyMenuUI?.refresh?.();
    },

    handleRoundStarted(data) {
      this.handleRoundState(data);
      if (data.announcement) {
        uiManager.showMessage(data.announcement, "info", 1800);
      }
    },

    handleRoundEnded(data) {
      if (data.teams) {
        this.handleRoundState({
          ...(game?.roundState || {}),
          teams: data.teams,
          phase: "ended",
          round_number: data.round_number,
          is_overtime: data.is_overtime,
        });
      }
      if (data.announcement) {
        uiManager.showMessage(data.announcement, "success", 2800);
      }
    },

    handleMatchEnded(data) {
      this.handleRoundState({
        ...(game?.roundState || {}),
        teams: data.teams,
        phase: "match_over",
        round_number: data.round_number,
        is_overtime: data.is_overtime,
        match_winner: data.winner,
      });
      const winner = data.winner === "ct" ? "CT" : data.winner === "t" ? "T" : "Unknown";
      uiManager.showMessage(`${winner} win the match`, "success", 3500);
    },

    /**
     * 处理 player_joined 消息
     * 对应 main.js line 186-217
     */
    handlePlayerJoined(data) {
      const position = data.position || { x: 0, y: 0, z: 0 };
      const isBot = data.is_bot || false;
      renderer.addPlayer(data.player_id, position, {
        isBot,
        team: data.team || "",
      });

      // 如果是机器人，显示 AI 标签
      if (isBot && aiLabels) {
        aiLabels.createLabel(data.player_id, data.name, data.difficulty);
      }

      uiManager.addKillFeed(`${data.name || data.player_id} 加入了游戏`);

      // 同步到 game.players Map
      if (game?.players) {
        game.players.set(data.player_id, {
          id: data.player_id,
          name: data.name,
          position: position,
          rotation: 0,
          is_bot: isBot,
          team: data.team || "",
          weapon: data.weapon || "rifle",
          kills: data.kills || 0,
          deaths: data.deaths || 0,
          score: data.score || 0,
          health: data.health || 100,
        });
      }
    },

    /**
     * 处理 player_respawned 消息
     * 对应 main.js line 361-372
     */
    handlePlayerRespawned(data) {
      if (data.player_id === game?.player?.id) {
        game.player.health = data.health;
        game.player.position = data.position;
        uiManager.updateHealth(data.health);
        // 重生时更新护甲
        if (typeof data.armor === "number") {
          game.player.armor = data.armor;
          game.player.hasHelmet = data.has_helmet || false;
          uiManager.updateArmor(data.armor, data.has_helmet);
        }
        if (typeof data.ammo === "number") {
          game.player.ammo = data.ammo;
          uiManager.updateAmmo(game.player.ammo, game.player.ammoReserve);
        }
        uiManager.hideDeathScreen();
      }

      if (game?.players) {
        const player = game.players.get(data.player_id);
        if (player) {
          player.position = data.position;
          if (typeof data.health === "number") {
            player.health = data.health;
          }
        }
      }

      renderer.updatePlayer(data.player_id, data.position, 0);
    },

    /**
     * 处理 armor_updated 消息
     */
    handleArmorUpdated(data) {
      if (data.player_id === game?.player?.id) {
        game.player.armor = data.armor;
        game.player.hasHelmet = data.has_helmet;
        uiManager.updateArmor(data.armor, data.has_helmet);
      }
    },
  };
}

// 暴露给测试使用（仅在有全局 window 对象时）
if (typeof window !== "undefined") {
  window.createMessageHandlers = createMessageHandlers;
}
