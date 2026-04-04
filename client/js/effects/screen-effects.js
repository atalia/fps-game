// client/js/effects/screen-effects.js
// 屏幕震动和视觉效果

console.log("[EFFECTS] effects/screen-effects.js loading...");

class ScreenEffectsEnhanced {
  constructor() {
    if (window.__screenEffectsSingleton) {
      return window.__screenEffectsSingleton;
    }

    this.enabled = true;
    this.overlay = null;
    this.damageVignette = null;
    this.lowHealthOverlay = null;
    this.muzzleFlashOverlay = null;
    this.hitMarker = null;
    this.hitMarkerLabel = null;
    this.gameContainer = null;
    this.nightVisionActive = false;
    this.lowHealthActive = false;
    this.effectTimers = new Map();

    this.init();
    window.__screenEffectsSingleton = this;
  }

  init() {
    this.overlay = document.getElementById("screen-effects-overlay");
    if (!this.overlay) {
      this.overlay = document.createElement("div");
      this.overlay.id = "screen-effects-overlay";
      this.overlay.innerHTML = `
        <div id="damage-vignette"></div>
        <div id="low-health-overlay"></div>
        <div id="muzzle-flash-overlay"></div>
      `;
      document.body.appendChild(this.overlay);
    }

    Object.assign(this.overlay.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "175",
      transition: "background-color 0.12s ease",
    });

    this.damageVignette = this.ensureLayer("damage-vignette");
    this.lowHealthOverlay = this.ensureLayer("low-health-overlay");
    this.muzzleFlashOverlay = this.ensureLayer("muzzle-flash-overlay");
    this.hitMarker = document.getElementById("hit-marker");
    this.hitMarkerLabel = document.getElementById("hit-marker-label");
    this.gameContainer = document.getElementById("game-container");

    this.configureLayer(this.damageVignette, {
      transition: "opacity 0.12s ease",
      opacity: "0",
    });
    this.configureLayer(this.lowHealthOverlay, {
      transition: "opacity 0.2s ease",
      opacity: "0",
    });
    this.configureLayer(this.muzzleFlashOverlay, {
      transition: "opacity 0.08s ease, transform 0.12s ease",
      opacity: "0",
      transform: "scale(0.92)",
    });
  }

  ensureLayer(id) {
    let element = document.getElementById(id);
    if (!element) {
      element = document.createElement("div");
      element.id = id;
      this.overlay.appendChild(element);
    }
    return element;
  }

  configureLayer(element, styles) {
    if (!element) return;
    Object.assign(element.style, {
      position: "absolute",
      inset: "0",
      pointerEvents: "none",
      ...styles,
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.clear();
    }
  }

  restartTimer(key, callback, duration) {
    const activeTimer = this.effectTimers.get(key);
    if (activeTimer) {
      window.clearTimeout(activeTimer);
    }

    const timer = window.setTimeout(() => {
      this.effectTimers.delete(key);
      callback();
    }, duration);

    this.effectTimers.set(key, timer);
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // ==================== 屏幕震动 ====================

  shake(intensity = 10, duration = 100) {
    if (!this.enabled || !this.gameContainer) return;

    const startTime = performance.now();
    const originalTransform = this.gameContainer.style.transform || "";

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;

      if (elapsed < duration) {
        const progress = elapsed / duration;
        const decay = 1 - progress;

        const x = (Math.random() - 0.5) * intensity * decay;
        const y = (Math.random() - 0.5) * intensity * decay;

        this.gameContainer.style.transform = `translate(${x}px, ${y}px)`;
        requestAnimationFrame(animate);
      } else {
        this.gameContainer.style.transform = originalTransform;
      }
    };

    requestAnimationFrame(animate);
  }

  // ==================== 屏幕闪烁 ====================

  flashDamage(intensity = 0.3) {
    if (!this.enabled || !this.damageVignette) return;

    const vignetteOpacity = this.clamp(intensity * 1.8, 0.22, 0.88);
    this.damageVignette.style.opacity = String(vignetteOpacity);
    this.overlay.style.backgroundColor = `rgba(255, 58, 22, ${this.clamp(intensity * 0.25, 0.04, 0.14)})`;

    this.restartTimer("damageFlash", () => {
      this.damageVignette.style.opacity = "0";
      this.overlay.style.backgroundColor = "transparent";
    }, 120);
  }

  flashKill() {
    if (!this.enabled) return;

    this.overlay.style.backgroundColor = "rgba(134, 255, 158, 0.16)";
    this.restartTimer("killFlash", () => {
      this.overlay.style.backgroundColor = "transparent";
    }, 150);
  }

  showKill() {
    this.flashKill();
  }

  flashHeal() {
    if (!this.enabled) return;

    this.overlay.style.backgroundColor = "rgba(90, 180, 255, 0.18)";
    this.restartTimer("healFlash", () => {
      this.overlay.style.backgroundColor = "transparent";
    }, 150);
  }

  showMuzzleFlash(intensity = 1) {
    if (!this.enabled || !this.muzzleFlashOverlay) return;

    const opacity = this.clamp(0.18 + intensity * 0.42, 0.2, 0.72);
    this.muzzleFlashOverlay.style.opacity = String(opacity);
    this.muzzleFlashOverlay.style.transform = "scale(1.04)";

    this.restartTimer("muzzleFlash", () => {
      this.muzzleFlashOverlay.style.opacity = "0";
      this.muzzleFlashOverlay.style.transform = "scale(0.92)";
    }, 90);
  }

  showHitMarker(options = {}) {
    if (!this.enabled || !this.hitMarker) return;

    const headshot =
      options === "head" ||
      options?.headshot === true ||
      options?.isHeadshot === true ||
      options?.hitbox === "head";
    const damage = Number(options?.damage) || 0;
    const label = headshot ? "HEADSHOT" : damage > 0 ? `+${Math.round(damage)}` : "HIT";

    if (this.hitMarkerLabel) {
      this.hitMarkerLabel.textContent = label;
    }

    this.hitMarker.classList.remove("active", "headshot");
    void this.hitMarker.offsetWidth;
    this.hitMarker.classList.add("active");
    this.hitMarker.classList.toggle("headshot", headshot);

    this.restartTimer("hitMarker", () => {
      this.hitMarker?.classList.remove("active", "headshot");
    }, 180);
  }

  setLowHealthActive(active, intensity = 1) {
    if (!this.lowHealthOverlay) return;

    this.lowHealthActive = Boolean(active);
    if (!this.lowHealthActive) {
      this.lowHealthOverlay.style.opacity = "0";
      this.lowHealthOverlay.style.animation = "none";
      return;
    }

    this.lowHealthOverlay.style.opacity = String(this.clamp(0.18 + intensity * 0.3, 0.22, 0.56));
    this.lowHealthOverlay.style.animation =
      "lowHealthPulseStrong 1.05s ease-in-out infinite";
  }

  // ==================== 闪光弹致盲 ====================

  flashblind(duration = 3000, intensity = 1.0) {
    if (!this.enabled) return;

    let flashOverlay = document.getElementById("flashbang-overlay");
    if (!flashOverlay) {
      flashOverlay = document.createElement("div");
      flashOverlay.id = "flashbang-overlay";
      flashOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: white;
        pointer-events: none;
        z-index: 1000;
      `;
      document.body.appendChild(flashOverlay);
    }

    flashOverlay.style.opacity = intensity;
    flashOverlay.style.display = "block";

    const startTime = Date.now();
    const fadeStep = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      const opacity = intensity * Math.pow(1 - progress, 2);
      flashOverlay.style.opacity = opacity;

      if (progress < 1) {
        requestAnimationFrame(fadeStep);
      } else {
        flashOverlay.style.display = "none";
      }
    };
    requestAnimationFrame(fadeStep);

    if (window.audioManager?.playFlashbangRing) {
      window.audioManager.playFlashbangRing();
    }
  }

  // ==================== 夜视仪 ====================

  toggleNightVision() {
    this.nightVisionActive = !this.nightVisionActive;

    if (this.nightVisionActive) {
      this.enableNightVision();
    } else {
      this.disableNightVision();
    }

    return this.nightVisionActive;
  }

  enableNightVision() {
    if (!this.enabled) return;

    let nvOverlay = document.getElementById("nightvision-overlay");
    if (!nvOverlay) {
      nvOverlay = document.createElement("div");
      nvOverlay.id = "nightvision-overlay";
      nvOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999;
        mix-blend-mode: screen;
        background: radial-gradient(ellipse at center,
          rgba(0, 255, 0, 0.1) 0%,
          rgba(0, 128, 0, 0.2) 50%,
          rgba(0, 64, 0, 0.3) 100%);
      `;
      document.body.appendChild(nvOverlay);
    }

    nvOverlay.style.display = "block";

    if (window.renderer?.scene) {
      window.renderer.scene.background = new THREE.Color(0x001100);
    }

    this.addScanLines();

    if (window.audioManager?.playSound) {
      window.audioManager.playSound("nightvision_on");
    }
  }

  disableNightVision() {
    const nvOverlay = document.getElementById("nightvision-overlay");
    if (nvOverlay) {
      nvOverlay.style.display = "none";
    }

    if (window.renderer?.scene) {
      window.renderer.scene.background = new THREE.Color(0x87ceeb);
    }

    this.removeScanLines();

    if (window.audioManager?.playSound) {
      window.audioManager.playSound("nightvision_off");
    }
  }

  addScanLines() {
    let scanlines = document.getElementById("nv-scanlines");
    if (!scanlines) {
      scanlines = document.createElement("div");
      scanlines.id = "nv-scanlines";
      scanlines.style.cssText = `
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 1001;
        background: repeating-linear-gradient(
          0deg,
          rgba(0, 0, 0, 0.1) 0px,
          rgba(0, 0, 0, 0.1) 1px,
          transparent 1px,
          transparent 2px
        );
        animation: scanline-move 0.1s linear infinite;
      `;
      document.body.appendChild(scanlines);

      const style = document.createElement("style");
      style.textContent = `
        @keyframes scanline-move {
          0% { transform: translateY(0); }
          100% { transform: translateY(2px); }
        }
      `;
      document.head.appendChild(style);
    }
    scanlines.style.display = "block";
  }

  removeScanLines() {
    const scanlines = document.getElementById("nv-scanlines");
    if (scanlines) {
      scanlines.style.display = "none";
    }
  }

  // ==================== 死亡效果 ====================

  showDeath() {
    this.overlay.style.backgroundColor = "rgba(0, 0, 0, 0.78)";
    if (this.damageVignette) {
      this.damageVignette.style.opacity = "0";
    }
  }

  hideDeath() {
    this.overlay.style.backgroundColor = "transparent";
  }

  clear() {
    this.overlay.style.backgroundColor = "transparent";
    if (this.damageVignette) {
      this.damageVignette.style.opacity = "0";
    }
    if (this.lowHealthOverlay) {
      this.lowHealthOverlay.style.opacity = "0";
      this.lowHealthOverlay.style.animation = "none";
    }
    if (this.muzzleFlashOverlay) {
      this.muzzleFlashOverlay.style.opacity = "0";
      this.muzzleFlashOverlay.style.transform = "scale(0.92)";
    }
    if (this.hitMarker) {
      this.hitMarker.classList.remove("active", "headshot");
    }
    if (this.gameContainer) {
      this.gameContainer.style.transform = "";
    }

    this.effectTimers.forEach((timer) => {
      window.clearTimeout(timer);
    });
    this.effectTimers.clear();
    this.lowHealthActive = false;
  }
}

window.screenEffectsEnhanced =
  window.screenEffectsEnhanced || new ScreenEffectsEnhanced();
window.ScreenEffectsEnhanced = ScreenEffectsEnhanced;

// 向后兼容
window.screenEffects = window.screenEffectsEnhanced;
window.ScreenEffects = ScreenEffectsEnhanced;

console.log("[EFFECTS] ScreenEffectsEnhanced initialized");
