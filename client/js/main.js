// main.js - 主入口
let gameStarted = false;

async function init() {
  const loading = document.getElementById("loading");
  const loadingText = loading ? loading.querySelector("p") : null;

  try {
    console.log("🚀 Starting game initialization...");
    console.log("📍 DOM Elements:", {
      loading: !!loading,
      loadingText: !!loadingText,
      gameContainer: !!document.getElementById("game-container"),
    });

    if (!loading || !loadingText) {
      throw new Error("DOM 元素未找到，请检查 HTML 结构");
    }

    // 更新加载状态
    loadingText.textContent = "初始化音效系统...";

    // 检查类是否存在
    console.log("📦 Checking required classes:", {
      AudioManager: typeof AudioManager !== "undefined",
      UIManager: typeof UIManager !== "undefined",
      ScreenEffects: typeof ScreenEffects !== "undefined",
      Renderer: typeof Renderer !== "undefined",
      Network: typeof Network !== "undefined",
      Lobby: typeof Lobby !== "undefined",
      Game: typeof Game !== "undefined",
    });

    // 初始化音效
    if (typeof AudioManager === "undefined") {
      throw new Error("AudioManager 类未定义，请检查 audio.js 加载");
    }
    window.audioManager = new AudioManager();
    await window.audioManager.init();
    console.log("✅ Audio initialized");

    // 初始化 UI
    loadingText.textContent = "初始化界面...";
    if (typeof UIManager === "undefined") {
      throw new Error("UIManager 类未定义，请检查 ui.js 加载");
    }
    if (typeof ScreenEffects === "undefined") {
      throw new Error("ScreenEffects 类未定义，请检查 effects.js 加载");
    }
    window.uiManager = new UIManager();
    window.screenEffects = new ScreenEffects();
    if (typeof RadioMenu !== "undefined") {
      window.radioMenu = new RadioMenu();
    }
    if (typeof TeamSystem !== "undefined") {
      window.teamSystem = new TeamSystem();
    }
    if (typeof BuyMenuUI !== "undefined") {
      window.buyMenuUI = new BuyMenuUI(
        document.getElementById("game-container"),
      );
    }
    console.log("✅ UI initialized");

    // 初始化渲染器
    loadingText.textContent = "初始化渲染器...";
    if (typeof Renderer === "undefined") {
      throw new Error("Renderer 类未定义，请检查 renderer.js 加载");
    }
    window.renderer = new Renderer("game-container");
    console.log("✅ Renderer initialized");

    if (typeof TeamSelectUI !== "undefined" && window.teamSystem) {
      window.teamSelectUI = new TeamSelectUI(
        document.getElementById("game-container"),
        window.teamSystem,
      );
    }
    if (typeof TeamScoreUI !== "undefined" && window.teamSystem) {
      window.teamScoreUI = new TeamScoreUI(
        document.getElementById("game-container"),
      );
      window.teamScoreUI.show(window.teamSystem.getAllTeams());
    }
    if (typeof WeaponSystem !== "undefined") {
      window.weaponSystem = new WeaponSystem();
    }

    // 初始化特效系统
    loadingText.textContent = "初始化特效系统...";
    if (
      typeof EffectsSystem !== "undefined" &&
      typeof PerformanceMonitor !== "undefined"
    ) {
      window.performanceMonitor = new PerformanceMonitor();
      window.effectsSystem = new EffectsSystem();
      window.effectsSystem.init(window.renderer); // 调用 init 方法完成初始化
      console.log("✅ Effects system initialized");
    } else {
      console.warn("⚠️ Effects system not loaded, using fallback");
    }

    // 初始化网络
    loadingText.textContent = "连接服务器...";
    console.log("[MAIN] Initializing network...");
    if (typeof Network === "undefined") {
      console.error("[MAIN] Network class not defined!");
      throw new Error("Network 类未定义，请检查 network.js 加载");
    }
    const wsProtocol = window.location.protocol === "https:" ? "wss" : "ws";
    const wsUrl = `${wsProtocol}://${window.location.host}/ws`;
    console.log("[MAIN] WebSocket URL:", wsUrl);
    console.log("[MAIN] Creating Network instance...");
    window.network = new Network(wsUrl);
    console.log("[MAIN] Network created, waiting for connection...");

    // 设置网络事件处理
    setupNetworkHandlers();

    // 等待连接
    await new Promise((resolve, reject) => {
      window.network.onConnect = () => {
        console.log("✅ WebSocket connected");
        resolve();
      };
      window.network.onError = (err) => {
        console.error("❌ WebSocket error:", err);
        reject(new Error("WebSocket 连接失败"));
      };
      setTimeout(() => reject(new Error("连接超时 (10秒)")), 10000);
    });

    // 初始化大厅
    loadingText.textContent = "加载大厅...";
    if (typeof Lobby === "undefined") {
      throw new Error("Lobby 类未定义，请检查 lobby.js 加载");
    }
    window.lobby = new Lobby();

    // 设置退出房间按钮
    setupLeaveRoomButton();

    // 隐藏加载画面
    loading.style.display = "none";

    console.log("🎮 Game initialized successfully!");
  } catch (error) {
    console.error("初始化失败:", error);
    if (loading) {
      loading.innerHTML = `
                <h1>❌ 初始化失败</h1>
                <p style="color: #ff6b6b;">${error.message}</p>
                <p style="color: #888; margin-top: 10px; font-size: 14px;">
                    请检查控制台 (F12) 获取详细信息
                </p>
                <p style="margin-top: 20px">
                    <button onclick="location.reload()" style="
                        padding: 12px 24px; 
                        font-size: 16px; 
                        cursor: pointer;
                        background: #4CAF50;
                        color: white;
                        border: none;
                        border-radius: 5px;
                    ">
                        🔄 重试
                    </button>
                </p>
            `;
    }
  }
}

function setupNetworkHandlers() {
  // 注意：messageHandlers 在 startGame() 中初始化，因为那时 window.game 才创建

  // 辅助函数：刷新玩家列表 UI
  function refreshPlayerList() {
    if (!window.game || !window.game.players) return;
    const players = Array.from(window.game.players.values());
    // 添加自己
    if (window.game.player) {
      const selfInList = players.find((p) => p.id === window.game.player.id);
      if (!selfInList) {
        players.unshift({
          id: window.game.player.id,
          name: window.game.player.name || "You",
          kills: window.game.player.kills || 0,
          deaths: window.game.player.deaths || 0,
          score: window.game.player.score || 0,
          health: window.game.player.health || 100,
          team: window.game.player.team || "",
          is_bot: false,
        });
      }
    }
    window.uiManager.updatePlayerList(players);
  }

  function syncTeamState(teams) {
    if (!window.teamSystem || !teams) return;
    window.teamSystem.setTeams(teams);
    if (window.teamScoreUI) {
      window.teamScoreUI.show(window.teamSystem.getAllTeams());
    }
    window.teamSelectUI?.render();
    window.uiManager.updateScoreboardTeamSummary(
      window.teamSystem.getAllTeams(),
    );
  }

  function syncRoundState(roundState) {
    if (!roundState) return;
    if (roundState.teams) {
      syncTeamState(roundState.teams);
    }
    if (window.messageHandlers?.handleRoundState) {
      window.messageHandlers.handleRoundState(roundState);
      return;
    }
    window.__pendingRoundState = roundState;
  }

  function applyPlayerTeam(playerId, teamId) {
    if (!window.teamSystem || !playerId || !teamId) return;
    window.teamSystem.setPlayerTeam(playerId, teamId);
    window.teamScoreUI?.updateTeams(window.teamSystem.getAllTeams());
    window.uiManager.updateScoreboardTeamSummary(
      window.teamSystem.getAllTeams(),
    );

    if (window.game?.player?.id === playerId) {
      window.game.player.team = teamId;
    }

    const remotePlayer = window.game?.players?.get(playerId);
    if (remotePlayer) {
      remotePlayer.team = teamId;
    }

    if (window.renderer && playerId !== window.network.playerId) {
      window.renderer.setPlayerTeam(
        playerId,
        teamId,
        remotePlayer?.is_bot || false,
      );
    }
  }

  function maybeShowTeamSelect() {
    if (!window.teamSelectUI || !window.game?.player) return;
    if (window.game.player.team) {
      window.teamSelectUI.hide();
    } else {
      window.teamSelectUI.show();
    }
  }

  if (window.teamSelectUI) {
    window.teamSelectUI.onSelect = (teamId) => {
      if (window.network?.connected) {
        window.network.send("team_join", { team: teamId });
      }
    };
  }

  // 房间加入成功
  window.network.on("room_joined", (data) => {
    console.log("✅ Joined room:", data.room_id);

    window.uiManager.updateRoom(data.room_id, data.player_count);
    window.uiManager.showMessage(`已加入房间 ${data.room_id}`);
    syncTeamState(data.teams);

    // 设置当前玩家 ID
    window.uiManager.setSelfPlayerId(data.player_id);

    // 初始化游戏
    if (!gameStarted) {
      startGame(data.player_id);
    }

    // 创建房间内现有玩家的模型（排除自己）
    if (data.players && Array.isArray(data.players)) {
      console.log("Room has", data.players.length, "players");
      if (window.teamSystem) {
        window.teamSystem.syncPlayers(data.players);
        window.teamScoreUI?.updateTeams(window.teamSystem.getAllTeams());
      }
      const selfPlayerData = data.players.find(
        (player) => player.id === data.player_id,
      );
      if (selfPlayerData) {
        window.__pendingSelfState = {
          team: selfPlayerData.team || "",
          weapon: selfPlayerData.weapon || "",
          money: selfPlayerData.money ?? 800,
        };
      }
      if (data.round_state) {
        window.__pendingRoundState = data.round_state;
      }

      // 更新玩家列表 UI
      window.uiManager.updatePlayerList(data.players);

      data.players.forEach((player) => {
        if (player.id === data.player_id && window.game?.player) {
          window.game.player.team = player.team || "";
          window.game.player.weapon =
            player.weapon || window.game.player.weapon;
          return;
        }

        if (player.id !== data.player_id) {
          console.log(
            "Creating existing player:",
            player.id,
            "position:",
            player.position,
          );
          const position = player.position || { x: 0, y: 0, z: 0 };
          window.renderer.addPlayer(player.id, position, {
            isBot: player.is_bot || false,
            team: player.team || "",
          });

          // 如果是机器人，显示 AI 标签
          if (player.is_bot && window.aiLabels) {
            window.aiLabels.createLabel(
              player.id,
              player.name,
              player.difficulty,
            );
          }

          // 同步到 game.players Map
          if (window.game && window.game.players) {
            window.game.players.set(player.id, {
              id: player.id,
              name: player.name,
              position: position,
              rotation: player.rotation || 0,
              is_bot: player.is_bot,
              team: player.team || "",
              weapon: player.weapon || "",
              kills: player.kills || 0,
              deaths: player.deaths || 0,
              score: player.score || 0,
              health: player.health || 100,
            });
          }
        }
      });
    }

    maybeShowTeamSelect();
    if (data.round_state) {
      syncRoundState(data.round_state);
    }
  });

  // 玩家加入
  window.network.on("player_joined", (data) => {
    console.log(
      "Player joined:",
      data.name,
      "position:",
      data.position,
      "is_bot:",
      data.is_bot,
    );
    if (window.messageHandlers) {
      window.messageHandlers.handlePlayerJoined(data);
    }
    if (data.team) {
      applyPlayerTeam(data.player_id, data.team);
    }

    // 更新玩家列表 UI
    if (typeof refreshPlayerList === "function") refreshPlayerList();
  });

  // 玩家离开
  window.network.on("player_left", (data) => {
    console.log("Player left:", data.player_id);
    window.renderer.removePlayer(data.player_id);

    // 移除 AI 标签
    if (window.aiLabels) {
      window.aiLabels.removeLabel(data.player_id);
    }

    window.uiManager.addKillFeed(`${data.name || data.player_id} 离开了游戏`);

    // 从 game.players Map 移除
    if (window.game && window.game.players) {
      window.game.players.delete(data.player_id);
    }
    if (window.teamSystem) {
      window.teamSystem.removePlayer(data.player_id);
      if (window.teamScoreUI) {
        window.teamScoreUI.updateTeams(window.teamSystem.getAllTeams());
      }
    }

    // 更新玩家列表 UI
    if (typeof refreshPlayerList === "function") refreshPlayerList();
  });

  // 玩家移动
  window.network.on("player_moved", (data) => {
    window.renderer.updatePlayer(data.player_id, data.position, data.rotation);

    // 同步到 game.players Map
    if (window.game && window.game.players) {
      const player = window.game.players.get(data.player_id);
      if (player) {
        player.position = data.position;
        player.rotation = data.rotation;
      }
    }
  });

  // 玩家射击
  window.network.on("player_shot", (data) => {
    if (window.messageHandlers) {
      window.messageHandlers.handlePlayerShot(data);
    }
  });

  // 玩家受伤
  window.network.on("player_damaged", (data) => {
    console.log(
      `Player ${data.player_id} took ${data.damage} damage (${data.hitbox})`,
    );
    if (window.messageHandlers) {
      window.messageHandlers.handlePlayerDamaged(data);
    }
  });

  // 玩家死亡
  window.network.on("player_killed", (data) => {
    console.log(`Player ${data.victim_id} killed by ${data.killer_id}`);
    if (window.messageHandlers) {
      window.messageHandlers.handlePlayerKilled(data);
    }
  });

  // 玩家重生（广播给其他玩家）
  window.network.on("player_respawned", (data) => {
    if (window.messageHandlers) {
      window.messageHandlers.handlePlayerRespawned(data);
    }
  });

  // 玩家自己重生（直接消息）
  window.network.on("respawn", (data) => {
    if (window.game?.player) {
      window.game.player.position = data.position;
      window.game.player.health = data.health;
      window.game.player.ammo = data.ammo;
      if (typeof data.armor === "number") {
        window.game.player.armor = data.armor;
        window.game.player.hasHelmet = data.has_helmet;
        window.uiManager.updateArmor(data.armor, data.has_helmet);
      }
      window.uiManager.updateHealth(data.health);
      window.uiManager.hideDeathScreen();
    }
  });

  // 护甲更新
  window.network.on("armor_updated", (data) => {
    if (window.messageHandlers) {
      window.messageHandlers.handleArmorUpdated(data);
    }
  });

  // 诱饵弹激活
  window.network.on("decoy_active", (data) => {
    if (window.grenadeSystem?.onDecoyEffect) {
      window.grenadeSystem.onDecoyEffect({
        position: data.position,
        weapon: 'ak47',
        duration: data.duration
      });
    }
  });

  // 无线电消息
  window.network.on("radio", (data) => {
    if (window.radioMenu) {
      window.radioMenu.receiveRadio(data);
    }
  });

  // 武器切换
  window.network.on("weapon_changed", (data) => {
    console.log(`Player ${data.player_id} switched to ${data.weapon}`);
    if (window.messageHandlers) {
      window.messageHandlers.handleWeaponChanged(data);
    }
    window.buyMenuUI?.refresh?.();
  });

  window.network.on("money_updated", (data) => {
    if (window.messageHandlers) {
      window.messageHandlers.handleMoneyUpdated(data);
    }
  });

  window.network.on("buy_result", (data) => {
    if (data.player_id !== window.game?.player?.id) {
      return;
    }

    const item = window.findBuyMenuItem?.(data.item_id);
    const isEquipment = Boolean(
      window.BUY_MENU_CATALOG?.find((category) => category.id === "equipment")
        ?.items?.some((entry) => entry.id === data.item_id),
    );

    if (data.success && item && isEquipment) {
      window.uiManager.showMessage(`已购买 ${item.name}`, "success", 1500);
    } else if (data.message) {
      window.uiManager.showMessage(data.message, "error");
    }

    window.buyMenuUI?.refresh?.();
  });

  window.network.on("team_changed", (data) => {
    console.log(`Player ${data.player_id} joined team ${data.team}`);
    syncTeamState(data.teams);
    applyPlayerTeam(data.player_id, data.team);

    if (window.game?.player?.id === data.player_id) {
      window.game.player.resetOwnedWeapons?.([]);
      window.uiManager.showMessage(
        `已加入 ${data.team === "ct" ? "CT" : "T"}`,
        "success",
      );
      maybeShowTeamSelect();
    }

    window.buyMenuUI?.refresh?.();
    if (typeof refreshPlayerList === "function") refreshPlayerList();
  });

  window.network.on("team_scores_updated", (data) => {
    syncTeamState(data.teams);
  });

  window.network.on("round_state", (data) => {
    syncRoundState(data);
  });

  window.network.on("round_started", (data) => {
    if (data.teams) {
      syncTeamState(data.teams);
    }
    window.messageHandlers?.handleRoundStarted?.(data);
  });

  window.network.on("round_ended", (data) => {
    if (data.teams) {
      syncTeamState(data.teams);
    }
    window.messageHandlers?.handleRoundEnded?.(data);
  });

  window.network.on("match_ended", (data) => {
    if (data.teams) {
      syncTeamState(data.teams);
    }
    window.messageHandlers?.handleMatchEnded?.(data);
  });

  // C4 进度消息
  window.network.on("c4_plant_start", (data) => {
    window.messageHandlers?.handleC4PlantStart?.(data);
  });
  window.network.on("c4_plant_progress", (data) => {
    window.messageHandlers?.handleC4PlantProgress?.(data);
  });
  window.network.on("c4_plant_cancel", (data) => {
    window.messageHandlers?.handleC4PlantCancel?.(data);
  });
  window.network.on("c4_planted", (data) => {
    window.messageHandlers?.handleC4Planted?.(data);
  });
  window.network.on("c4_defuse_start", (data) => {
    window.messageHandlers?.handleC4DefuseStart?.(data);
  });
  window.network.on("c4_defuse_progress", (data) => {
    window.messageHandlers?.handleC4DefuseProgress?.(data);
  });
  window.network.on("c4_defuse_cancel", (data) => {
    window.messageHandlers?.handleC4DefuseCancel?.(data);
  });
  window.network.on("c4_defused", (data) => {
    window.messageHandlers?.handleC4Defused?.(data);
  });
  window.network.on("c4_exploded", (data) => {
    window.messageHandlers?.handleC4Exploded?.(data);
  });

  // 聊天消息
  window.network.on("chat", (data) => {
    console.log("[MAIN] Received chat message:", data);
    window.uiManager.addChatMessage(data.name, data.message);
  });

  // 错误消息
  window.network.on("error", (data) => {
    console.error("Server error:", data.message);
    window.uiManager.showMessage(data.message, "error");
  });

  // 投掷物
  window.network.on("grenade_thrown", (data) => {
    if (window.grenadeSystem) {
      const grenade = {
        id: Date.now().toString(),
        type: data.type,
        position: data.position,
        velocity: data.velocity,
        playerId: data.player_id,
        detonateTime: Date.now() + getGrenadeDetonationTime(data.type),
        active: true
      };
      window.grenadeSystem.activeGrenades.push(grenade);
    }
  });
}

// 获取投掷物引爆时间
function getGrenadeDetonationTime(type) {
  switch (type) {
    case 'flashbang': return 1500;
    case 'smoke': return 2000;
    case 'he': return 2500;
    case 'molotov': return 1000;
    case 'decoy': return 500;
    default: return 2000;
  }
}

async function startGame(playerId) {
  gameStarted = true;

  // 初始化游戏
  window.game = new Game();
  window.game.selfPlayerId = playerId;

  // 【重要】尽早记录玩家 ID，防止消息处理时找不到自己
  if (window.game.player) {
    window.game.player.id = playerId;
    console.log("[MAIN] Player ID set early:", playerId);
  }

  // 创建 messageHandlers，此时 player.id 已设置
  if (typeof createMessageHandlers !== "undefined") {
    window.messageHandlers = createMessageHandlers({
      game: window.game,
      renderer: window.renderer,
      uiManager: window.uiManager,
      audioManager: window.audioManager,
      screenEffects: window.screenEffects,
      hitIndicator: window.hitIndicator,
      effectsSystem: window.effectsSystem,
      damageNumber: window.damageNumber,
      dynamicCrosshair: window.dynamicCrosshair,
      hitEffects: window.hitEffects,
      killNotice: window.killNotice,
      killstreakEnhanced: window.killstreakEnhanced,
      aiLabels: window.aiLabels,
    });
    console.log("[MAIN] Message handlers initialized (early with player ID)");
  }

  await window.game.init();

  if (window.game?.player) {
    window.game.player.id = playerId;
  }

  if (window.__pendingSelfState && window.game?.player) {
    window.game.player.team = window.__pendingSelfState.team || "";
    if (window.__pendingSelfState.weapon) {
      window.game.player.weapon = window.__pendingSelfState.weapon;
    }
    window.game.player.money = window.__pendingSelfState.money ?? 800;
    const defaultWeapon = window.game.player.team
      ? window.teamSystem?.getDefaultWeapon(window.game.player.team)
      : "";
    window.game.player.resetOwnedWeapons?.(
      [defaultWeapon, window.__pendingSelfState.weapon].filter(Boolean),
    );
    delete window.__pendingSelfState;
  }

  window.uiManager.updateMoney(window.game?.player?.money ?? 800);
  window.buyMenuUI?.refresh?.();
  if (window.__pendingRoundState && window.messageHandlers?.handleRoundState) {
    window.messageHandlers.handleRoundState(window.__pendingRoundState);
    delete window.__pendingRoundState;
  }

  // 初始化命中效果系统
  if (typeof HitEffects !== "undefined") {
    window.hitEffects = new HitEffects(
      window.renderer.scene,
      window.renderer.camera,
    );
  }

  // 初始化投掷物系统
  if (typeof GrenadeSystem !== "undefined") {
    window.grenadeSystem = new GrenadeSystem(window.renderer.scene);
    
    // 设置闪光弹效果回调
    window.grenadeSystem.onFlashEffect = (effect) => {
      // 检查玩家是否在范围内且面向闪光弹
      const playerPos = window.game?.player?.position;
      if (!playerPos) return;

      const dx = effect.position.x - playerPos.x;
      const dy = effect.position.y - playerPos.y;
      const dz = effect.position.z - playerPos.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (distance <= effect.radius) {
        // 根据距离和是否面向计算致盲时间
        const intensity = Math.max(0.3, 1 - distance / effect.radius);
        const blindDuration = effect.duration * intensity;
        
        if (window.screenEffects?.flashblind) {
          window.screenEffects.flashblind(blindDuration, intensity);
        }
      }
    };

    // 设置烟雾效果回调
    window.grenadeSystem.onSmokeEffect = (smoke) => {
      if (window.effectsSystem?.addSmokeEffect) {
        window.effectsSystem.addSmokeEffect(smoke.position, smoke.radius);
      }
    };

    // 设置爆炸效果回调
    window.grenadeSystem.onExplosion = (explosion) => {
      if (window.effectsSystem?.addExplosion) {
        window.effectsSystem.addExplosion(explosion.position, explosion.radius);
      }
      if (window.audioManager?.playExplosion) {
        window.audioManager.playExplosion();
      }
    };

    console.log("[MAIN] GrenadeSystem initialized with effect callbacks");
  }

  // 初始化 AI 标签系统
  if (typeof AILabels !== "undefined") {
    window.aiLabels = new AILabels();
  }

  // 初始化手机控制
  if (typeof MobileControls !== "undefined") {
    window.mobileControls = new MobileControls();
    window.mobileControls.show();
  }

  // 初始化语音系统
  if (typeof VoiceSystem !== "undefined") {
    window.voiceSystem = new VoiceSystem();
    window.voiceSystem
      .init()
      .then((success) => {
        if (success) {
          console.log("[MAIN] Voice system initialized");
          setupVoiceHandlers();
        }
      })
      .catch((err) => {
        console.warn("[MAIN] Voice system init failed:", err);
      });
  }

  // 重新创建 messageHandlers，包含新初始化的依赖（hitEffects, aiLabels 等）
  if (typeof createMessageHandlers !== "undefined") {
    window.messageHandlers = createMessageHandlers({
      game: window.game,
      renderer: window.renderer,
      uiManager: window.uiManager,
      audioManager: window.audioManager,
      screenEffects: window.screenEffects,
      hitIndicator: window.hitIndicator,
      effectsSystem: window.effectsSystem,
      damageNumber: window.damageNumber,
      dynamicCrosshair: window.dynamicCrosshair,
      hitEffects: window.hitEffects,
      killNotice: window.killNotice,
      killstreakEnhanced: window.killstreakEnhanced,
      aiLabels: window.aiLabels,
    });
    console.log(
      "[MAIN] Message handlers re-initialized with full dependencies",
    );
  }

  const needsTeamSelection = !window.game?.player?.team;

  // 隐藏大厅
  if (window.lobby) {
    window.lobby.hide(!needsTeamSelection);
  }

  // 显示退出按钮
  const leaveBtn = document.getElementById("leave-room-btn");
  if (leaveBtn) {
    leaveBtn.style.display = "block";
  }

  if (window.teamSelectUI && window.game?.player) {
    if (window.game.player.team) {
      window.teamSelectUI.hide();
    } else {
      window.teamSelectUI.show();
    }
  }
}

// 设置退出房间按钮
function setupLeaveRoomButton() {
  const leaveBtn = document.getElementById("leave-room-btn");
  if (!leaveBtn) return;

  // 点击按钮退出房间
  leaveBtn.addEventListener("click", leaveRoom);

  // ESC 键退出房间
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !e.repeat && gameStarted) {
      leaveRoom();
    }
  });
}

// 退出房间
function leaveRoom() {
  console.log("[MAIN] Leaving room...");

  // 发送离开消息
  if (window.network && window.network.connected) {
    window.network.send("leave_room", {});
  }

  // 清理游戏实例（包括所有事件监听器）
  if (window.game) {
    if (typeof window.game.destroy === "function") {
      window.game.destroy();
    }
    window.game = null;
  }

  // 清理渲染器中的其他玩家
  if (window.renderer) {
    window.renderer.clearPlayers();
  }

  // 隐藏退出按钮
  const leaveBtn = document.getElementById("leave-room-btn");
  if (leaveBtn) {
    leaveBtn.style.display = "none";
  }

  // 显示大厅
  if (window.lobby) {
    window.lobby.show();
  }

  // 更新 UI
  window.uiManager.updateRoom("等待加入...", 0);
  window.uiManager.updatePlayerList([]);
  if (window.teamSystem) {
    window.teamSystem.playerTeam.clear();
    window.teamSystem.setTeams(window.teamSystem.getDefaultTeams());
  }
  if (window.teamScoreUI && window.teamSystem) {
    window.teamScoreUI.updateTeams(window.teamSystem.getAllTeams());
  }
  if (window.teamSelectUI) {
    window.teamSelectUI.hide();
  }
  window.buyMenuUI?.hide?.();
  window.uiManager.updateMoney(0);
  window.roundState = null;
  window.uiManager.resetRoundState?.();
  delete window.__pendingSelfState;
  delete window.__pendingRoundState;

  gameStarted = false;

  console.log("[MAIN] Left room successfully");
}

// 设置语音事件处理
function setupVoiceHandlers() {
  if (!window.network || !window.voiceSystem) return;

  // 接收语音数据
  window.network.on("voice_data", (data) => {
    if (window.voiceSystem && data.playerId && data.audio) {
      window.voiceSystem.receiveAudio(data.playerId, data.audio);
    }
  });

  // 语音开始
  window.network.on("voice_start", (data) => {
    console.log("[VOICE] Player started speaking:", data.playerId);
    if (window.ui) {
      window.ui.showSpeakingIndicator(data.playerId, true);
    }
  });

  // 语音停止
  window.network.on("voice_stop", (data) => {
    console.log("[VOICE] Player stopped speaking:", data.playerId);
    if (window.ui) {
      window.ui.showSpeakingIndicator(data.playerId, false);
    }
    if (window.voiceSystem) {
      window.voiceSystem.stopReceiving(data.playerId);
    }
  });
}

// 启动
if (typeof window !== "undefined" && !window.__FPS_DISABLE_AUTO_INIT__) {
  init();
}

