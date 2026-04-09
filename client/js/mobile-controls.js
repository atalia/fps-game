// mobile-controls.js - 手机触控支持
class MobileControls {
  constructor() {
    this.isMobile = this.detectMobile();
    this.joystick = null;
    this.lookTouch = null;
    this.shootBtn = null;
    this.reloadBtn = null;
    this.jumpBtn = null;
    this.active = false;

    // 移动状态
    this.moveX = 0;
    this.moveY = 0;
    this.lookX = 0;
    this.lookY = 0;

    if (this.isMobile) {
      this.init();
    }
  }

  detectMobile() {
    return (
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent,
      ) ||
      (window.matchMedia && window.matchMedia("(max-width: 768px)").matches)
    );
  }

  init() {
    this.active = true;
    this.createControls();
    this.setupStyles();
    console.log("📱 Mobile controls initialized");
  }

  setupStyles() {
    const style = document.createElement("style");
    style.textContent = `
            /* 手机控制样式 */
            #mobile-controls {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                height: 200px;
                pointer-events: none;
                z-index: 1000;
                display: none;
            }
            
            #mobile-controls.active {
                display: block;
            }
            
            /* 移动端隐藏不必要的HUD元素 */
            @media (max-width: 768px) {
                #player-list,
                #chat-container,
                #kill-feed,
                #round-panel,
                #weapon-hint,
                #room-info {
                    display: none !important;
                }
                
                /* 简化HUD，只保留核心信息 */
                .vitals-stack {
                    bottom: 220px !important;
                    left: 12px !important;
                    right: auto !important;
                    width: 150px !important;
                }
                
                #ammo-display {
                    bottom: 220px !important;
                    right: 12px !important;
                    left: auto !important;
                    width: 100px !important;
                }
                
                #minimap-shell {
                    display: none !important;
                }
                
                /* 标题居中显示 */
                #game-title {
                    position: fixed;
                    top: 12px;
                    left: 50%;
                    transform: translateX(-50%);
                    font-size: 16px;
                    z-index: 100;
                }
            }
            
            .mobile-joystick {
                position: absolute;
                bottom: 30px;
                left: 30px;
                width: 120px;
                height: 120px;
                background: rgba(255, 255, 255, 0.15);
                border: 3px solid rgba(255, 255, 255, 0.4);
                border-radius: 50%;
                pointer-events: auto;
                touch-action: none;
            }
            
            .joystick-inner {
                position: absolute;
                top: 50%;
                left: 50%;
                width: 50px;
                height: 50px;
                background: rgba(255, 255, 255, 0.5);
                border-radius: 50%;
                transform: translate(-50%, -50%);
                transition: transform 0.05s;
            }
            
            .look-area {
                position: absolute;
                top: 0;
                right: 0;
                width: 50%;
                height: 100%;
                pointer-events: auto;
                touch-action: none;
            }
            
            .action-buttons {
                position: absolute;
                bottom: 30px;
                right: 30px;
                display: flex;
                flex-direction: column;
                gap: 15px;
                pointer-events: auto;
            }
            
            .action-btn {
                width: 70px;
                height: 70px;
                border-radius: 50%;
                border: 3px solid rgba(255, 255, 255, 0.5);
                background: rgba(255, 255, 255, 0.2);
                color: white;
                font-size: 14px;
                font-weight: bold;
                display: flex;
                align-items: center;
                justify-content: center;
                touch-action: manipulation;
            }
            
            .action-btn:active {
                background: rgba(255, 255, 255, 0.4);
                transform: scale(0.95);
            }
            
            .action-btn.shoot {
                width: 90px;
                height: 90px;
                background: rgba(255, 50, 50, 0.4);
                border-color: rgba(255, 100, 100, 0.6);
            }
            
            .action-btn.reload {
                background: rgba(50, 150, 255, 0.4);
                border-color: rgba(100, 180, 255, 0.6);
            }

            .action-btn.voice {
                background: rgba(80, 200, 120, 0.4);
                border-color: rgba(100, 255, 160, 0.6);
            }

            .action-btn.voice.active {
                background: rgba(80, 200, 120, 0.75);
            }

            .action-btn.voice.muted {
                background: rgba(200, 80, 80, 0.6);
                border-color: rgba(255, 120, 120, 0.75);
            }
            
            /* 手机 HUD 调整 */
            @media (max-width: 768px) {
                #hud {
                    padding: 10px !important;
                    font-size: 14px !important;
                }
                
                .vitals-stack {
                    min-width: 150px !important;
                }
                
                .hud-vital {
                    padding: 8px 10px !important;
                }
                
                #kill-feed {
                    width: 200px !important;
                    font-size: 11px !important;
                }
                
                #round-panel {
                    top: 10px !important;
                    padding: 8px 15px !important;
                }
                
                /* 隐藏桌面提示 */
                .desktop-only {
                    display: none !important;
                }
            }
            
            /* 横屏提示 */
            #rotate-device {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: none;
                justify-content: center;
                align-items: center;
                flex-direction: column;
                color: white;
                z-index: 9999;
                text-align: center;
                padding: 20px;
            }
            
            #rotate-device svg {
                width: 80px;
                height: 80px;
                margin-bottom: 20px;
                animation: rotate-hint 2s infinite;
            }
            
            @keyframes rotate-hint {
                0%, 100% { transform: rotate(0deg); }
                50% { transform: rotate(90deg); }
            }
            
            @media (max-width: 768px) and (orientation: portrait) {
                #rotate-device {
                    display: flex;
                }
            }
        `;
    document.head.appendChild(style);
  }

  createControls() {
    // 横屏提示
    const rotateHint = document.createElement("div");
    rotateHint.id = "rotate-device";
    rotateHint.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="4" y="2" width="16" height="20" rx="2"/>
                <line x1="12" y1="18" x2="12" y2="18"/>
            </svg>
            <p style="font-size: 18px; margin-bottom: 10px;">请横屏游玩</p>
            <p style="font-size: 14px; opacity: 0.7;">获得更好的游戏体验</p>
        `;
    document.body.appendChild(rotateHint);

    // 控制面板
    const controls = document.createElement("div");
    controls.id = "mobile-controls";
    controls.innerHTML = `
            <div class="look-area" id="look-area"></div>
            
            <div class="mobile-joystick" id="move-joystick">
                <div class="joystick-inner" id="joystick-inner"></div>
            </div>
            
            <div class="action-buttons">
                <button class="action-btn shoot" id="shoot-btn">射击</button>
                <button class="action-btn reload" id="reload-btn">换弹</button>
                <button class="action-btn" id="jump-btn">跳跃</button>
                <button class="action-btn voice" id="voice-btn">语音</button>
            </div>
        `;
    document.body.appendChild(controls);

    this.setupJoystick();
    this.setupLookArea();
    this.setupButtons();

    // 游戏开始后显示控制
    const checkGame = () => {
      if (window.game && window.game.started) {
        controls.classList.add("active");
        console.log("📱 Mobile controls activated");
      } else {
        setTimeout(checkGame, 500);
      }
    };
    setTimeout(checkGame, 1000);
  }

  setupJoystick() {
    const joystick = document.getElementById("move-joystick");
    const inner = document.getElementById("joystick-inner");
    if (!joystick || !inner) return;

    let startX = 0,
      startY = 0;
    let touching = false;

    joystick.addEventListener("touchstart", (e) => {
      e.preventDefault();
      touching = true;
      const touch = e.touches[0];
      const rect = joystick.getBoundingClientRect();
      startX = rect.left + rect.width / 2;
      startY = rect.top + rect.height / 2;
    });

    joystick.addEventListener("touchmove", (e) => {
      e.preventDefault();
      if (!touching) return;

      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      const distance = Math.min(Math.sqrt(dx * dx + dy * dy), 50);
      const angle = Math.atan2(dy, dx);

      const moveX = (Math.cos(angle) * distance) / 50;
      const moveY = (Math.sin(angle) * distance) / 50;

      inner.style.transform = `translate(calc(-50% + ${moveX * 35}px), calc(-50% + ${moveY * 35}px))`;

      this.moveX = moveX;
      this.moveY = moveY;

      // 发送移动指令
      if (window.player) {
        window.player.mobileMoveX = this.moveX;
        window.player.mobileMoveY = this.moveY;
      }
    });

    joystick.addEventListener("touchend", (e) => {
      e.preventDefault();
      touching = false;
      inner.style.transform = "translate(-50%, -50%)";
      this.moveX = 0;
      this.moveY = 0;
      if (window.player) {
        window.player.mobileMoveX = 0;
        window.player.mobileMoveY = 0;
      }
    });
  }

  setupLookArea() {
    const lookArea = document.getElementById("look-area");
    if (!lookArea) return;

    let lastX = 0,
      lastY = 0;

    lookArea.addEventListener("touchstart", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      lastX = touch.clientX;
      lastY = touch.clientY;
    });

    lookArea.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - lastX;
      const dy = touch.clientY - lastY;

      lastX = touch.clientX;
      lastY = touch.clientY;

      // 旋转相机
      if (window.player) {
        window.player.rotation -= dx * 0.005;
        window.player.pitch -= dy * 0.005;
        window.player.pitch = Math.max(
          -Math.PI / 2,
          Math.min(Math.PI / 2, window.player.pitch),
        );
      }
    });
  }

  setupButtons() {
    const shootBtn = document.getElementById("shoot-btn");
    const reloadBtn = document.getElementById("reload-btn");
    const jumpBtn = document.getElementById("jump-btn");

    if (shootBtn) {
      let shooting = false;
      shootBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        shooting = true;
        this.startShooting();
      });
      shootBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        shooting = false;
        this.stopShooting();
      });
    }

    if (reloadBtn) {
      reloadBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (window.player) {
          window.player.reload();
        }
      });
    }

    if (jumpBtn) {
      jumpBtn.addEventListener("touchstart", (e) => {
        e.preventDefault();
        if (window.player) {
          window.player.jump();
        }
      });
    }

    // 语音按钮
    const voiceBtn = document.getElementById("voice-btn");
    if (voiceBtn) {
      voiceBtn.addEventListener("touchstart", async (e) => {
        e.preventDefault();
        if (window.voiceSystem) {
          // 首次使用需要请求权限
          if (!window.voiceSystem.enabled) {
            const granted = await window.voiceSystem.init();
            if (!granted) {
              console.warn("[MOBILE] Microphone permission denied");
              voiceBtn.classList.add("muted");
              return;
            }
          }
          window.voiceSystem.startTransmission();
          voiceBtn.classList.remove("muted");
          voiceBtn.classList.add("active");
        }
      });
      voiceBtn.addEventListener("touchend", (e) => {
        e.preventDefault();
        if (window.voiceSystem) {
          window.voiceSystem.stopTransmission();
          voiceBtn.classList.remove("active");
        }
      });
    }
  }

  startShooting() {
    if (window.player && window.player.shoot) {
      window.player.shoot();
      this.shootInterval = setInterval(() => {
        if (window.player && window.player.shoot) {
          window.player.shoot();
        }
      }, 100);
    }
  }

  stopShooting() {
    if (this.shootInterval) {
      clearInterval(this.shootInterval);
      this.shootInterval = null;
    }
  }

  show() {
    const controls = document.getElementById("mobile-controls");
    if (controls && this.isMobile) {
      controls.classList.add("active");
    }
  }

  hide() {
    const controls = document.getElementById("mobile-controls");
    if (controls) {
      controls.classList.remove("active");
    }
  }
}

// 导出
if (typeof window !== "undefined") {
  window.MobileControls = MobileControls;
}
