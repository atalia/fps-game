// Game.js - 完整游戏逻辑
class Game {
  constructor() {
    this.renderer = null;
    this.player = null;
    this.players = new Map();
    this.running = false;
    this.roomId = null;
    this.lastUpdate = Date.now();
    this.tickRate = 60;
    this.effects = null;
    this._eventHandlers = {}; // 存储事件处理器引用，用于清理
  }

  async init() {
    console.log("Game.init called");
    console.log("window.renderer exists:", !!window.renderer);

    // 复用已有的渲染器，不要重新创建
    if (window.renderer) {
      console.log("Reusing existing renderer");
      this.renderer = window.renderer;
    } else {
      // 只有在没有渲染器时才创建
      console.log("Creating new renderer");
      const container = document.getElementById("game-container");
      if (!container) {
        console.error("game-container not found!");
        return;
      }
      this.renderer = new Renderer("game-container");
      window.renderer = this.renderer;
    }

    // 初始化玩家控制器
    console.log(
      "PlayerController exists:",
      typeof PlayerController !== "undefined",
    );
    if (typeof PlayerController !== "undefined") {
      this.player = new PlayerController();
    } else {
      console.error("PlayerController not defined");
      this.player = {
        update: () => ({ position: { x: 0, y: 2, z: 0 }, rotation: 0 }),
      };
    }

    // 初始化特效
    console.log(
      "EffectsManager exists:",
      typeof EffectsManager !== "undefined",
    );
    if (typeof EffectsManager !== "undefined") {
      this.effects = new EffectsManager(this.renderer);
    }

    this.running = true;

    // 初始化音频
    if (window.audioManager) {
      await window.audioManager.init();
      window.audioManager.resume();
    }

    // 启动游戏循环
    this.loop();

    // 设置聊天
    this.setupChat();

    // 设置武器切换
    this.setupWeaponSwitch();

    // 设置小地图
    this.setupMinimap();
  }

  loop() {
    if (!this.running) return;

    const now = Date.now();
    const deltaTime = (now - this.lastUpdate) / 1000;
    this.lastUpdate = now;

    // 更新玩家
    const { position, rotation } = this.player.update();

    // 更新相机
    this.renderer.updateCamera(position, rotation);

    // 发送位置到服务器
    if (window.network.connected) {
      window.network.send("move", { ...position, rotation });
    }

    // 更新性能监控
    if (window.performanceMonitor) {
      window.performanceMonitor.update();
    }

    // 更新特效
    this.effects.update(deltaTime);
    this.effects.render(this.renderer.scene);

    // 更新投掷物
    if (window.grenadeSystem) {
      window.grenadeSystem.update(deltaTime);
    }

    // 更新准星扩散（从 PlayerController 获取真实移动状态）
    if (window.dynamicCrosshair && this.player) {
      const keys = this.player.keys;
      const isMoving =
        keys["KeyW"] || keys["KeyA"] || keys["KeyS"] || keys["KeyD"];
      window.dynamicCrosshair.setMoving(isMoving);
      window.dynamicCrosshair.update(deltaTime);
    }

    // 更新渲染器
    this.renderer.update();
    this.renderer.render();

    // 更新 UI
    this.updateUI();

    // 更新小地图
    this.updateMinimap();

    requestAnimationFrame(() => this.loop());
  }

  setupChat() {
    const input = document.getElementById("chat-input");
    if (!input) {
      console.error("[GAME] Chat input not found!");
      return;
    }

    console.log("[GAME] Setting up chat, input element:", input.id);

    // 点击输入框时暂停游戏控制
    this._eventHandlers.chatFocus = () => {
      console.log("[GAME] Chat input focused");
      this.chatFocused = true;
    };
    this._eventHandlers.chatBlur = () => {
      console.log("[GAME] Chat input blurred");
      this.chatFocused = false;
    };
    this._eventHandlers.chatKeydown = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();

        const message = input.value.trim();
        if (message) {
          console.log("[GAME] Sending chat message:", message);
          window.network.send("chat", { message });
          input.value = "";
        }
        input.blur();
      }
    };

    input.addEventListener("focus", this._eventHandlers.chatFocus);
    input.addEventListener("blur", this._eventHandlers.chatBlur);
    input.addEventListener("keydown", this._eventHandlers.chatKeydown);
  }

  setupWeaponSwitch() {
    this._eventHandlers.weaponSwitchKeydown = (e) => {
      if (this.chatFocused) {
        return;
      }

      const buyMenuVisible = window.buyMenuUI?.isVisible?.();
      switch (e.key) {
        case "b":
        case "B":
          window.buyMenuUI?.toggle?.();
          return;
        case "n":
        case "N":
          console.log("[GAME] Adding bot...");
          window.network.send("add_bot", { difficulty: "normal" });
          window.uiManager.showMessage("已添加 AI 机器人");
          return;
      }

      if (buyMenuVisible) {
        return;
      }

      switch (e.key) {
        case "1":
          this.switchWeaponById(
            window.teamSystem?.getDefaultWeapon(this.player.team) || "pistol",
          );
          break;
        case "2":
          this.switchWeaponById(
            window.teamSystem?.getPrimaryWeapon(this.player.team) || "rifle",
          );
          break;
        case "3":
          this.switchWeaponById(
            window.teamSystem?.getSupportWeapon(this.player.team) || "shotgun",
          );
          break;
        case "4":
          this.switchWeaponById("awp");
          break;
        case "5":
          this.switchWeaponById("deagle");
          break;
        case "r":
        case "R":
          this.player.reload();
          window.audioManager.playReload();
          window.network.send("reload", {});
          break;
      }
    };
    document.addEventListener(
      "keydown",
      this._eventHandlers.weaponSwitchKeydown,
    );
  }

  switchWeapon(weapon) {
    return this.switchWeaponById(weapon);
  }

  canUseWeapon(weaponId) {
    if (!window.teamSystem || !this.player?.team) {
      return true;
    }

    return window.teamSystem.canUseWeapon(this.player.team, weaponId);
  }

  switchWeaponLegacy(weapon) {
    this.player.weapon = weapon;
    document.getElementById("current-weapon").textContent =
      weapon.charAt(0).toUpperCase() + weapon.slice(1);

    // 更新弹药显示
    const weapons = {
      pistol: { ammo: 12, reserve: 48 },
      rifle: { ammo: 30, reserve: 90 },
      shotgun: { ammo: 6, reserve: 24 },
      sniper: { ammo: 5, reserve: 20 },
    };

    const config = weapons[weapon];
    this.player.ammo = config.ammo;
    this.player.ammoReserve = config.reserve;
    window.uiManager.updateAmmo(config.ammo, config.reserve);

    // 同步到服务器
    if (window.network && window.network.connected) {
      window.network.send("weapon_change", { weapon_id: weapon });
    }

    return true;
  }

  // 通过武器 ID 切换武器（支持扩展武器系统）
  switchWeaponById(weaponId) {
    if (!this.canUseWeapon(weaponId)) {
      window.uiManager.showMessage("该武器不属于你的队伍", "error");
      return false;
    }

    const normalizedWeapon =
      window.teamSystem?.normalizeWeaponId(this.player.team, weaponId) ||
      weaponId;

    if (
      this.player?.team &&
      typeof this.player?.hasWeapon === "function" &&
      !this.player.hasWeapon(normalizedWeapon)
    ) {
      window.uiManager.showMessage("先购买该武器", "error");
      return false;
    }

    // 尝试从 WeaponSystem 获取武器配置
    if (window.weaponSystem) {
      const weapon = window.weaponSystem.getWeapon(normalizedWeapon);
      if (weapon) {
        this.player.weapon = weapon.id;
        this.player.weaponConfig = weapon;
        this.player.maxAmmo = weapon.magSize;
        document.getElementById("current-weapon").textContent = weapon.name;

        // 更新弹药显示
        this.player.ammo = weapon.magSize;
        this.player.ammoReserve = weapon.reserveAmmo ?? weapon.magSize * 4;
        window.uiManager.updateAmmo(weapon.magSize, this.player.ammoReserve);

        // 通知服务器
        if (window.network.connected) {
          window.network.send("weapon_change", { weapon: weaponId });
        }

        // 播放音效
        if (window.audioManager) {
          window.audioManager.play("weapon_switch");
        }

        return true;
      }
    }

    // 回退到基础武器
    return this.switchWeaponLegacy(weaponId);
  }

  setupMinimap() {
    this.minimapCanvas = document.getElementById("minimap-canvas");
    if (this.minimapCanvas) {
      this.minimapCtx = this.minimapCanvas.getContext("2d");
      this.minimapCanvas.width = 150;
      this.minimapCanvas.height = 150;
    }
  }

  updateMinimap() {
    if (!this.minimapCtx) return;

    const ctx = this.minimapCtx;
    const scale = 1.5; // 地图缩放

    // 清除
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(0, 0, 150, 150);

    // 绘制边界
    ctx.strokeStyle = "#333";
    ctx.strokeRect(0, 0, 150, 150);

    // 绘制自己
    const myX = 75 + this.player.position.x * scale;
    const myZ = 75 + this.player.position.z * scale;
    ctx.fillStyle = "#00ff00";
    ctx.beginPath();
    ctx.arc(myX, myZ, 4, 0, Math.PI * 2);
    ctx.fill();

    // 绘制朝向
    const dirX = Math.sin(this.player.rotation) * 10;
    const dirZ = Math.cos(this.player.rotation) * 10;
    ctx.strokeStyle = "#00ff00";
    ctx.beginPath();
    ctx.moveTo(myX, myZ);
    ctx.lineTo(myX + dirX, myZ + dirZ);
    ctx.stroke();

    // 绘制其他玩家
    ctx.fillStyle = "#ff0000";
    this.players.forEach((p) => {
      const px = 75 + p.position.x * scale;
      const pz = 75 + p.position.z * scale;
      ctx.beginPath();
      ctx.arc(px, pz, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  updateUI() {
    // 更新血量警告
    if (this.player.health < 30) {
      window.uiManager.showLowHealthWarning();
    } else {
      window.uiManager.hideLowHealthWarning();
    }
  }

  onRoomJoined(data) {
    this.roomId = data.room_id;
    window.uiManager.updateRoom(data.room_id, data.players.length);

    // 添加本地玩家到渲染器
    this.renderer.addPlayer(
      window.network.playerId,
      this.player.position,
      true,
    );

    // 添加其他玩家
    data.players.forEach((p) => {
      if (p.id !== window.network.playerId) {
        this.renderer.addPlayer(p.id, p.position, false);
        this.players.set(p.id, p);
      }
    });

    // 显示消息
    window.uiManager.showMessage("已加入房间 " + data.room_id);
  }

  onPlayerJoined(data) {
    if (data.player_id !== window.network.playerId) {
      this.renderer.addPlayer(data.player_id, data.position, false);
      this.players.set(data.player_id, data);

      const count = this.players.size + 1;
      window.uiManager.updateRoom(this.roomId, count);

      this.addKillFeed(`${data.name || data.player_id} 加入了游戏`);
    }
  }

  onPlayerLeft(data) {
    if (data.player_id !== window.network.playerId) {
      this.renderer.removePlayer(data.player_id);
      this.players.delete(data.player_id);

      const count = this.players.size + 1;
      window.uiManager.updateRoom(this.roomId, count);

      this.addKillFeed(`${data.name || data.player_id} 离开了游戏`);
    }
  }

  onPlayerMoved(data) {
    if (data.player_id !== window.network.playerId) {
      this.renderer.updatePlayer(data.player_id, data.position, data.rotation);

      const player = this.players.get(data.player_id);
      if (player) {
        player.position = data.position;
        player.rotation = data.rotation;
      }
    }
  }

  onPlayerShot(data) {
    const { player_id, target_id, damage, position } = data;

    // 添加子弹轨迹
    if (position) {
      this.effects.createBulletTrail(position, this.player.position);
    }

    // 播放射击音效
    window.audioManager.playShoot("rifle");

    // 如果本地玩家被击中
    if (target_id === window.network.playerId) {
      this.player.takeDamage(damage);
      window.uiManager.updateHealth(this.player.health);
      window.screenEffects.showDamage(0.3);
      window.screenEffects.shake(5);
      window.audioManager.playHit();

      if (this.player.health <= 0) {
        this.onDeath(player_id);
      }
    }

    // 如果本地玩家击中别人
    if (player_id === window.network.playerId && target_id) {
      this.player.addKill();
      window.uiManager.updateScore(this.player.score);
      window.uiManager.updateKD(this.player.kills, this.player.deaths);
      window.screenEffects.showKill();
      window.audioManager.playKill();
      this.addKillFeed(`你击中了 ${target_id}！`);

      // 创建命中特效
      const target = this.players.get(target_id);
      if (target) {
        this.effects.createHitEffect(target.position);
      }
    }
  }

  onDeath(killerId) {
    this.player.deaths++;
    window.uiManager.updateKD(this.player.kills, this.player.deaths);
    window.screenEffects.showDeath();
    window.audioManager.playDeath();
    this.addKillFeed(`你被 ${killerId} 击杀了`);

    // 3秒后重生
    setTimeout(() => this.respawn(), 3000);
  }

  respawn() {
    this.player.health = 100;
    this.player.ammo = 30;
    this.player.position = {
      x: (Math.random() - 0.5) * 40,
      y: 0,
      z: (Math.random() - 0.5) * 40,
    };

    window.uiManager.updateHealth(100);
    window.uiManager.updateAmmo(30, this.player.ammoReserve);
    window.screenEffects.hideDeath();
    window.uiManager.showMessage("已重生");

    // 通知服务器
    window.network.send("respawn", {
      position: this.player.position,
    });
  }

  onChat(data) {
    window.uiManager.addChatMessage(data.name || data.player_id, data.message);
  }

  addKillFeed(text) {
    window.uiManager.addKillFeed(text);
  }

  toggleScoreboard(show) {
    window.uiManager.toggleScoreboard(show);

    if (show) {
      // 更新记分板
      const players = Array.from(this.players.values()).map((p) => ({
        id: p.id,
        name: p.name || p.id,
        team: p.team || "",
        kills: p.kills || 0,
        deaths: p.deaths || 0,
        score: p.score || 0,
      }));

      // 添加自己
      players.push({
        id: window.network.playerId,
        name: "You",
        team: this.player.team || "",
        kills: this.player.kills,
        deaths: this.player.deaths,
        score: this.player.score,
      });

      window.uiManager.updateScoreboard(
        players,
        window.teamSystem?.getAllTeams() || [],
      );
    }
  }

  destroy() {
    this.running = false;

    // 清理聊天事件监听器
    const chatInput = document.getElementById("chat-input");
    if (chatInput) {
      if (this._eventHandlers.chatFocus) {
        chatInput.removeEventListener("focus", this._eventHandlers.chatFocus);
      }
      if (this._eventHandlers.chatBlur) {
        chatInput.removeEventListener("blur", this._eventHandlers.chatBlur);
      }
      if (this._eventHandlers.chatKeydown) {
        chatInput.removeEventListener(
          "keydown",
          this._eventHandlers.chatKeydown,
        );
      }
    }

    // 清理武器切换事件监听器
    if (this._eventHandlers.weaponSwitchKeydown) {
      document.removeEventListener(
        "keydown",
        this._eventHandlers.weaponSwitchKeydown,
      );
    }

    // 清理 PlayerController 的事件监听器
    if (this.player && typeof this.player.destroy === "function") {
      this.player.destroy();
    }

    // 注意：不销毁 renderer，因为它是全局共享的
    // 只清理渲染器中的玩家模型
    if (this.renderer && typeof this.renderer.clearPlayers === "function") {
      this.renderer.clearPlayers();
    }

    // 清空事件处理器引用
    this._eventHandlers = {};

    console.log("[GAME] Game destroyed, all event listeners cleaned up");
  }
}

window.Game = Game;

export default Game;
