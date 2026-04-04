// client/js/effects/health-bar.js
// 敌人血条系统

console.log("[EFFECTS] effects/health-bar.js loading...");

class HealthBarManager {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = renderer.scene;
    this.healthBars = new Map();
    this.config = { always: false, onDamage: true };

    // 使用 CSS2DRenderer 或 Sprite
    this.useSprite = true;
  }

  setConfig(config) {
    this.config = config;
  }

  // 创建或更新血条
  updateHealth(playerId, health, maxHealth, position, team = null) {
    if (!this.config.always && !this.config.onDamage) {
      return;
    }

    let healthBar = this.healthBars.get(playerId);

    // 满血时隐藏（除非配置为始终显示）
    const isFullHealth = health >= maxHealth;

    if (!healthBar) {
      if (isFullHealth && !this.config.always) {
        return;
      }

      healthBar = this.createHealthBar(playerId, position, team);
      this.healthBars.set(playerId, healthBar);
    }

    // 更新血量
    healthBar.health = health;
    healthBar.maxHealth = maxHealth;
    healthBar.position = position;
    healthBar.team = team;
    healthBar.lastUpdate = Date.now();
    healthBar.visible = !isFullHealth || this.config.always;

    // 更新显示
    this.renderHealthBar(healthBar);
  }

  createHealthBar(playerId, position, team) {
    return {
      playerId,
      position: { ...position },
      health: 100,
      maxHealth: 100,
      team,
      sprite: null,
      lastUpdate: Date.now(),
      visible: true,
      shakeOffset: 0,
    };
  }

  renderHealthBar(healthBar) {
    if (!healthBar.visible) {
      if (healthBar.sprite) {
        this.scene.remove(healthBar.sprite);
      }
      return;
    }

    // 创建或更新 Sprite
    if (!healthBar.sprite) {
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 16;
      healthBar.canvas = canvas;
      healthBar.ctx = canvas.getContext("2d");

      const texture = new THREE.CanvasTexture(canvas);
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      });
      healthBar.sprite = new THREE.Sprite(material);
      healthBar.sprite.scale.set(1, 0.12, 1);
      this.scene.add(healthBar.sprite);
    }

    // 绘制血条
    const ctx = healthBar.ctx;
    const canvas = healthBar.canvas;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 背景
    ctx.fillStyle = "#333333";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 边框
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);

    // 血量
    const healthPercent = healthBar.health / healthBar.maxHealth;
    const barWidth = (canvas.width - 4) * healthPercent;

    // 颜色根据队伍
    let healthColor = "#44ff44"; // 绿色（无队伍）
    if (healthBar.team === "red" || healthBar.team === "t") {
      healthColor = "#ff4444";
    } else if (healthBar.team === "blue" || healthBar.team === "ct") {
      healthColor = "#4444ff";
    }

    ctx.fillStyle = healthColor;
    ctx.fillRect(2, 2, barWidth, canvas.height - 4);

    // 更新纹理
    healthBar.sprite.material.map.needsUpdate = true;

    // 更新位置
    healthBar.sprite.position.set(
      healthBar.position.x,
      healthBar.position.y + 2.5, // 头顶上方
      healthBar.position.z,
    );

    // 应用震动偏移
    if (healthBar.shakeOffset > 0) {
      healthBar.sprite.position.x +=
        healthBar.shakeOffset * (Math.random() - 0.5) * 0.1;
    }
  }

  // 显示受伤效果
  showDamageEffect(playerId) {
    const healthBar = this.healthBars.get(playerId);
    if (healthBar) {
      healthBar.shakeOffset = 1;
      healthBar.visible = true;
      healthBar.lastUpdate = Date.now();
    }
  }

  update(deltaTime) {
    const now = Date.now();
    const hideDelay = 3000; // 3秒后隐藏

    this.healthBars.forEach((healthBar, playerId) => {
      // 震动衰减
      if (healthBar.shakeOffset > 0) {
        healthBar.shakeOffset *= 0.9;
        if (healthBar.shakeOffset < 0.01) {
          healthBar.shakeOffset = 0;
        }
      }

      // 自动隐藏
      if (!this.config.always && now - healthBar.lastUpdate > hideDelay) {
        if (healthBar.sprite) {
          this.scene.remove(healthBar.sprite);
          healthBar.sprite = null;
        }
      }
    });
  }

  render() {
    // Sprite 会自动渲染
  }

  removeHealthBar(playerId) {
    const healthBar = this.healthBars.get(playerId);
    if (healthBar && healthBar.sprite) {
      this.scene.remove(healthBar.sprite);
      if (healthBar.sprite.material) {
        healthBar.sprite.material.dispose();
      }
    }
    this.healthBars.delete(playerId);
  }

  clear() {
    this.healthBars.forEach((healthBar, playerId) => {
      this.removeHealthBar(playerId);
    });
  }
}

window.HealthBarManager = HealthBarManager;
console.log("[EFFECTS] HealthBarManager class exported");
