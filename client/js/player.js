// player.js - 玩家控制器
class PlayerController {
  constructor() {
    this.id = null; // 玩家 ID，由 startGame 设置
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rotation = 0;
    this.pitch = 0;

    this.health = 100;
    this.maxHealth = 100;
    this.money = 800;
    this.armor = 0;
    this.hasHelmet = false;
    this.ammo = 30;
    this.ammoReserve = 90;
    this.maxAmmo = 30;

    // 投掷物
    this.flashbangs = 0;
    this.heGrenades = 0;
    this.smokeGrenades = 0;
    this.selectedGrenade = "flashbang"; // flashbang, he, smoke

    this.kills = 0;
    this.deaths = 0;
    this.score = 0;

    this.weapon = "rifle";
    this.team = "";
    this.ownedWeapons = new Set();
    this.speed = 5;
    this.jumpForce = 8;
    this.isGrounded = true;

    this.keys = {};
    this.mouse = { x: 0, y: 0 };
    this.isLocked = false;

    this.lastShot = 0;
    this.shootCooldown = 100; // ms

    // 存储事件处理函数引用，用于后续清理
    this._eventHandlers = {};

    this.init();
  }

  init() {
    // 键盘事件
    this._eventHandlers.keydown = (e) => {
      this.keys[e.code] = true;
      
      // G 键投掷投掷物
      if (e.code === "KeyG" && !e.repeat) {
        this.throwGrenade();
      }
      
      // 4 键切换投掷物类型
      if (e.code === "Digit4" && !e.repeat) {
        const newType = this.cycleGrenade();
        if (window.uiManager?.showMessage) {
          window.uiManager.showMessage(`切换到 ${newType}`, "info");
        }
      }
    };
    this._eventHandlers.keyup = (e) => {
      this.keys[e.code] = false;
    };
    document.addEventListener("keydown", this._eventHandlers.keydown);
    document.addEventListener("keyup", this._eventHandlers.keyup);

    // 鼠标锁定
    this._eventHandlers.click = () => {
      if (!this.isLocked) {
        document.body.requestPointerLock();
      } else {
        this.shoot();
      }
    };
    this._eventHandlers.pointerlockchange = () => {
      this.isLocked = document.pointerLockElement === document.body;
    };
    document.addEventListener("click", this._eventHandlers.click);
    document.addEventListener(
      "pointerlockchange",
      this._eventHandlers.pointerlockchange,
    );

    // 鼠标移动
    this._eventHandlers.mousemove = (e) => {
      if (this.isLocked) {
        this.rotation -= e.movementX * 0.002;
        this.pitch -= e.movementY * 0.002;
        this.pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.pitch));
      }
    };
    document.addEventListener("mousemove", this._eventHandlers.mousemove);
  }

  destroy() {
    // 清理所有事件监听器，防止内存泄漏
    if (this._eventHandlers.keydown) {
      document.removeEventListener("keydown", this._eventHandlers.keydown);
    }
    if (this._eventHandlers.keyup) {
      document.removeEventListener("keyup", this._eventHandlers.keyup);
    }
    if (this._eventHandlers.click) {
      document.removeEventListener("click", this._eventHandlers.click);
    }
    if (this._eventHandlers.pointerlockchange) {
      document.removeEventListener(
        "pointerlockchange",
        this._eventHandlers.pointerlockchange,
      );
    }
    if (this._eventHandlers.mousemove) {
      document.removeEventListener("mousemove", this._eventHandlers.mousemove);
    }
    this._eventHandlers = {};
  }

  update() {
    const dt = 1 / 60;
    const canMove = this.canMoveDuringRound();

    // 移动
    let moveX = 0;
    let moveZ = 0;

    if (canMove) {
      if (this.keys["KeyW"]) moveZ -= 1;
      if (this.keys["KeyS"]) moveZ += 1;
      if (this.keys["KeyA"]) moveX -= 1;
      if (this.keys["KeyD"]) moveX += 1;
    }

    // 跳跃
    if (canMove && this.keys["Space"] && this.isGrounded) {
      this.velocity.y = this.jumpForce;
      this.isGrounded = false;
    }

    // 应用移动
    const sin = Math.sin(this.rotation);
    const cos = Math.cos(this.rotation);

    this.position.x += (moveX * cos - moveZ * sin) * this.speed * dt;
    this.position.z += (moveX * sin + moveZ * cos) * this.speed * dt;

    // 重力
    if (!this.isGrounded) {
      this.velocity.y -= 20 * dt;
      this.position.y += this.velocity.y * dt;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.velocity.y = 0;
        this.isGrounded = true;
      }
    }

    // 边界限制
    const boundary = 48;
    this.position.x = Math.max(-boundary, Math.min(boundary, this.position.x));
    this.position.z = Math.max(-boundary, Math.min(boundary, this.position.z));

    return {
      position: { ...this.position },
      rotation: this.rotation,
    };
  }

  shoot() {
    const now = Date.now();
    if (!this.canShootDuringRound()) return false;
    if (now - this.lastShot < this.shootCooldown) return false;
    if (this.ammo <= 0) {
      // 播放空弹夹音效
      if (window.audioManager) {
        window.audioManager.playEmpty();
      }
      return false;
    }

    this.lastShot = now;
    this.ammo--;

    // 根据武器类型设置冷却
    switch (this.weapon) {
      case "pistol":
      case "usp":
      case "glock":
        this.shootCooldown = 200;
        break;
      case "deagle":
        this.shootCooldown = 450;
        break;
      case "rifle":
      case "m4a1":
      case "famas":
      case "ak47":
      case "galil":
      case "mp5":
      case "p90":
        this.shootCooldown = 100;
        break;
      case "shotgun":
        this.shootCooldown = 800;
        break;
      case "sniper":
      case "awp":
        this.shootCooldown = 1500;
        break;
    }

    // === 射击视觉反馈 ===

    // 1. 枪口火焰
    if (window.effectsSystem && window.effectsSystem.core) {
      window.effectsSystem.core.createMuzzleFlash(
        { x: this.position.x, y: this.position.y + 1.5, z: this.position.z },
        this.rotation,
      );
    }

    // 2. 准星扩散动画
    if (window.dynamicCrosshair) {
      window.dynamicCrosshair.setShooting(true);
      setTimeout(() => {
        if (window.dynamicCrosshair) {
          window.dynamicCrosshair.setShooting(false);
        }
      }, 100);
    }

    // 3. 屏幕震动（狙击枪）
    if (
      (this.weapon === "sniper" || this.weapon === "awp") &&
      window.screenEffectsEnhanced
    ) {
      window.screenEffectsEnhanced.shake(8, 150);
    } else if (window.screenEffectsEnhanced) {
      window.screenEffectsEnhanced.shake(3, 50);
    }

    // 4. 音效
    if (window.audioManager) {
      window.audioManager.playShoot(this.weapon);
    }

    // 5. 弹药动画
    if (window.ammoDisplayEnhanced) {
      window.ammoDisplayEnhanced.update(this.ammo, this.ammoReserve);
    }

    // 发送射击消息到服务器
    if (window.network && window.network.connected) {
      // 根据 rotation 和 pitch 计算射击方向
      const direction = {
        x: -Math.sin(this.rotation) * Math.cos(this.pitch),
        y: Math.sin(this.pitch),
        z: -Math.cos(this.rotation) * Math.cos(this.pitch),
      };

      window.network.send("shoot", {
        position: {
          x: this.position.x,
          y: this.position.y + 1.7, // 眼睛高度
          z: this.position.z,
        },
        rotation: this.rotation,
        pitch: this.pitch,
        direction: direction,
        weapon_id: this.weapon,
      });
    }

    // 更新本地弹药显示
    if (window.uiManager) {
      window.uiManager.updateAmmo(this.ammo, this.ammoReserve);
    }

    return true;
  }

  reload() {
    if (this.ammoReserve <= 0) return;

    const needed = this.maxAmmo - this.ammo;
    const available = Math.min(needed, this.ammoReserve);

    this.ammo += available;
    this.ammoReserve -= available;
  }

  takeDamage(damage) {
    this.health -= damage;
    if (this.health < 0) this.health = 0;
    return this.health;
  }

  heal(amount) {
    this.health = Math.min(this.maxHealth, this.health + amount);
    return this.health;
  }

  addKill(score = 100) {
    this.kills++;
    this.score += score;
  }

  addDeath() {
    this.deaths++;
  }

  resetOwnedWeapons(weapons = []) {
    this.ownedWeapons = new Set(
      (weapons || [])
        .map((weapon) => String(weapon || "").trim().toLowerCase())
        .filter(Boolean),
    );
  }

  ownWeapon(weaponId) {
    const normalized = String(weaponId || "").trim().toLowerCase();
    if (!normalized) return;
    this.ownedWeapons.add(normalized);
  }

  hasWeapon(weaponId) {
    const normalized = String(weaponId || "").trim().toLowerCase();
    if (!normalized) return false;
    return this.ownedWeapons.has(normalized);
  }

  respawn() {
    this.health = this.maxHealth;
    this.ammo = this.maxAmmo;
    this.position = {
      x: (Math.random() - 0.5) * 40,
      y: 0,
      z: (Math.random() - 0.5) * 40,
    };
  }

  canMoveDuringRound() {
    const roundState = window.roundState || null;
    if (!roundState) return true;
    return roundState.can_move !== false;
  }

  canShootDuringRound() {
    const roundState = window.roundState || null;
    if (!roundState) return true;
    return roundState.can_shoot !== false;
  }

  // 投掷投掷物
  throwGrenade() {
    let type = this.selectedGrenade;
    
    // 检查是否有该类型的投掷物
    let available = false;
    switch (type) {
      case "flashbang":
        available = this.flashbangs > 0;
        break;
      case "he":
        available = this.heGrenades > 0;
        break;
      case "smoke":
        available = this.smokeGrenades > 0;
        break;
    }

    if (!available) {
      // 尝试切换到其他可用类型
      if (this.flashbangs > 0) {
        type = "flashbang";
        available = true;
      } else if (this.heGrenades > 0) {
        type = "he";
        available = true;
      } else if (this.smokeGrenades > 0) {
        type = "smoke";
        available = true;
      }
    }

    if (!available) return null;

    // 扣除投掷物
    switch (type) {
      case "flashbang":
        this.flashbangs--;
        break;
      case "he":
        this.heGrenades--;
        break;
      case "smoke":
        this.smokeGrenades--;
        break;
    }

    // 计算投掷方向和速度
    const forward = {
      x: Math.sin(this.rotation),
      y: -Math.sin(this.pitch) * 0.3 + 0.5, // 稍微向上
      z: Math.cos(this.rotation)
    };

    const speed = 15;
    const velocity = {
      x: forward.x * speed,
      y: forward.y * speed,
      z: forward.z * speed
    };

    // 从玩家位置投掷（稍微向前）
    const position = {
      x: this.position.x + forward.x * 0.5,
      y: this.position.y + 1.5,
      z: this.position.z + forward.z * 0.5
    };

    // 发送到服务器
    if (window.network?.connected) {
      window.network.send("grenade_throw", {
        type: type,
        position: position,
        velocity: velocity
      });
    }

    return { type, position, velocity };
  }

  // 切换投掷物类型
  cycleGrenade() {
    const types = ["flashbang", "he", "smoke"];
    const currentIndex = types.indexOf(this.selectedGrenade);
    const nextIndex = (currentIndex + 1) % types.length;
    this.selectedGrenade = types[nextIndex];
    return this.selectedGrenade;
  }
}

window.PlayerController = PlayerController;

export default PlayerController;
