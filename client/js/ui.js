// UI Manager - 界面管理
class UIManager {
  constructor() {
    this.elements = {}
    this.initElements()
  }

  initElements() {
    this.elements = {
      healthFill: document.getElementById('health-fill'),
      ammo: document.getElementById('ammo'),
      ammoReserve: document.getElementById('ammo-reserve'),
      score: document.getElementById('score'),
      kills: document.getElementById('kills'),
      deaths: document.getElementById('deaths'),
      roomId: document.getElementById('room-id'),
      playerCount: document.getElementById('player-count'),
      connectionStatus: document.getElementById('connection-status'),
      chatMessages: document.getElementById('chat-messages'),
      chatInput: document.getElementById('chat-input'),
      killFeed: document.getElementById('kill-feed'),
      scoreboard: document.getElementById('scoreboard'),
      scoreboardBody: document.getElementById('scoreboard-body')
    }
  }

  // 更新血量
  updateHealth(health, maxHealth = 100) {
    if (this.elements.healthFill) {
      const percentage = Math.max(0, Math.min(100, (health / maxHealth) * 100))
      this.elements.healthFill.style.width = `${percentage}%`
      
      // 血量低于30%变红
      if (percentage < 30) {
        this.elements.healthFill.style.background = 'linear-gradient(90deg, #ff0000, #ff4444)'
      } else {
        this.elements.healthFill.style.background = 'linear-gradient(90deg, #e94560, #ff6b6b)'
      }
    }
  }

  // 更新弹药
  updateAmmo(ammo, reserve) {
    if (this.elements.ammo) {
      this.elements.ammo.textContent = ammo
    }
    if (this.elements.ammoReserve) {
      this.elements.ammoReserve.textContent = reserve
    }
  }

  // 更新得分
  updateScore(score) {
    if (this.elements.score) {
      this.elements.score.textContent = score
    }
  }

  // 更新击杀/死亡
  updateKD(kills, deaths) {
    if (this.elements.kills) {
      this.elements.kills.textContent = kills
    }
    if (this.elements.deaths) {
      this.elements.deaths.textContent = deaths
    }
  }

  // 更新房间信息
  updateRoom(roomId, playerCount) {
    if (this.elements.roomId) {
      this.elements.roomId.textContent = roomId || '-'
    }
    if (this.elements.playerCount) {
      this.elements.playerCount.textContent = playerCount
    }
  }

  // 更新连接状态
  updateConnectionStatus(connected) {
    if (this.elements.connectionStatus) {
      this.elements.connectionStatus.textContent = connected ? '已连接' : '已断开'
      this.elements.connectionStatus.className = connected ? 'connected' : 'disconnected'
    }
  }

  // 添加聊天消息
  addChatMessage(name, message) {
    if (!this.elements.chatMessages) return

    const div = document.createElement('div')
    div.className = 'chat-message'
    div.innerHTML = `<span class="name">${this.escapeHtml(name)}:</span> ${this.escapeHtml(message)}`
    this.elements.chatMessages.appendChild(div)
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight

    // 限制消息数量
    while (this.elements.chatMessages.children.length > 50) {
      this.elements.chatMessages.removeChild(this.elements.chatMessages.firstChild)
    }
  }

  // 添加击杀信息
  addKillFeed(text) {
    if (!this.elements.killFeed) return

    const div = document.createElement('div')
    div.className = 'kill-item'
    div.textContent = text
    this.elements.killFeed.appendChild(div)

    // 5秒后移除
    setTimeout(() => {
      if (div.parentNode === this.elements.killFeed) {
        this.elements.killFeed.removeChild(div)
      }
    }, 5000)

    // 限制显示数量
    while (this.elements.killFeed.children.length > 5) {
      this.elements.killFeed.removeChild(this.elements.killFeed.firstChild)
    }
  }

  // 显示/隐藏记分板
  toggleScoreboard(show) {
    if (!this.elements.scoreboard) return

    if (show) {
      this.elements.scoreboard.classList.add('show')
    } else {
      this.elements.scoreboard.classList.remove('show')
    }
  }

  // 更新记分板
  updateScoreboard(players) {
    if (!this.elements.scoreboardBody) return

    this.elements.scoreboardBody.innerHTML = ''

    // 按得分排序
    const sorted = [...players].sort((a, b) => b.score - a.score)

    sorted.forEach((player, index) => {
      const tr = document.createElement('tr')
      tr.innerHTML = `
        <td>${index + 1}. ${this.escapeHtml(player.name || player.id)}</td>
        <td>${player.kills || 0}</td>
        <td>${player.deaths || 0}</td>
        <td>${player.score || 0}</td>
      `
      this.elements.scoreboardBody.appendChild(tr)
    })
  }

  // 显示伤害指示器
  showDamageIndicator(direction) {
    const indicator = document.createElement('div')
    indicator.className = 'damage-indicator'
    indicator.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      width: 100px;
      height: 100px;
      margin-left: -50px;
      margin-top: -50px;
      pointer-events: none;
      z-index: 15;
    `

    // 根据方向显示箭头
    const arrow = document.createElement('div')
    arrow.style.cssText = `
      position: absolute;
      top: 0;
      left: 50%;
      transform: translateX(-50%) rotate(${direction}deg);
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 20px solid rgba(255, 0, 0, 0.8);
    `
    indicator.appendChild(arrow)
    document.body.appendChild(indicator)

    // 1秒后移除
    setTimeout(() => {
      indicator.remove()
    }, 1000)
  }

  // 显示准心扩散
  updateCrosshairSpread(spread) {
    // 通过CSS变量控制准心大小
    document.documentElement.style.setProperty('--crosshair-spread', spread)
  }

  // 显示低血量警告
  showLowHealthWarning() {
    // 添加屏幕边缘红色渐变
    if (!document.querySelector('.low-health-warning')) {
      const warning = document.createElement('div')
      warning.className = 'low-health-warning'
      warning.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 5;
        box-shadow: inset 0 0 100px rgba(255, 0, 0, 0.3);
        animation: pulse 1s ease-in-out infinite;
      `
      document.body.appendChild(warning)
    }
  }

  hideLowHealthWarning() {
    const warning = document.querySelector('.low-health-warning')
    if (warning) {
      warning.remove()
    }
  }

  // 显示消息提示
  showMessage(text, duration = 3000) {
    const message = document.createElement('div')
    message.className = 'game-message'
    message.style.cssText = `
      position: fixed;
      top: 30%;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: #fff;
      padding: 15px 30px;
      border-radius: 10px;
      font-size: 1.2rem;
      z-index: 50;
      animation: fadeInOut ${duration}ms ease-in-out;
    `
    message.textContent = text
    document.body.appendChild(message)

    setTimeout(() => {
      message.remove()
    }, duration)
  }

  // HTML 转义
  escapeHtml(text) {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
}

window.uiManager = new UIManager()
