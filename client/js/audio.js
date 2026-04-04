// Audio Manager - 音效管理
class AudioManager {
  constructor() {
    this.context = null;
    this.sounds = new Map();
    this.masterVolume = 0.7;
    this.sfxVolume = 0.8;
    this.musicVolume = 0.5;
    this.enabled = true;
  }

  async init() {
    try {
      this.context = new (window.AudioContext || window.webkitAudioContext)();
      await this.loadSounds();
      console.log("Audio system initialized");
    } catch (error) {
      console.warn("Audio system not available:", error);
      this.enabled = false;
    }
  }

  async loadSounds() {
    // 音效定义（使用 Web Audio API 合成）
    const soundDefs = {
      shoot: {
        type: "synth",
        freq: 150,
        duration: 0.1,
        attack: 0.01,
        decay: 0.09,
      },
      reload: {
        type: "synth",
        freq: 300,
        duration: 0.3,
        attack: 0.05,
        decay: 0.25,
      },
      hit: {
        type: "synth",
        freq: 200,
        duration: 0.15,
        attack: 0.01,
        decay: 0.14,
      },
      kill: {
        type: "synth",
        freq: 400,
        duration: 0.2,
        attack: 0.01,
        decay: 0.19,
      },
      death: {
        type: "synth",
        freq: 100,
        duration: 0.5,
        attack: 0.1,
        decay: 0.4,
      },
      jump: {
        type: "synth",
        freq: 250,
        duration: 0.1,
        attack: 0.01,
        decay: 0.09,
      },
      land: {
        type: "synth",
        freq: 80,
        duration: 0.1,
        attack: 0.01,
        decay: 0.09,
      },
      footstep: {
        type: "synth",
        freq: 60,
        duration: 0.05,
        attack: 0.01,
        decay: 0.04,
      },
      empty: {
        type: "synth",
        freq: 500,
        duration: 0.05,
        attack: 0.01,
        decay: 0.04,
      },
    };

    // 预合成音效
    for (const [name, def] of Object.entries(soundDefs)) {
      this.sounds.set(name, def);
    }
  }

  play(name, volume = 1.0) {
    if (!this.enabled || !this.context) return;

    const sound = this.sounds.get(name);
    if (!sound) return;

    try {
      // 创建振荡器
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      // 设置音效参数
      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(sound.freq, this.context.currentTime);

      // 音量包络
      const now = this.context.currentTime;
      const actualVolume = volume * this.sfxVolume * this.masterVolume;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(actualVolume, now + sound.attack);
      gainNode.gain.linearRampToValueAtTime(
        0,
        now + sound.attack + sound.decay,
      );

      // 播放
      oscillator.start(now);
      oscillator.stop(now + sound.duration);
    } catch (error) {
      console.warn("Failed to play sound:", error);
    }
  }

  // 武器射击音效（不同武器不同音色）
  playShoot(weaponType = "rifle") {
    const sounds = {
      pistol: () => this.playShootSound(180, 0.08),
      usp: () => this.playShootSound(185, 0.08),
      glock: () => this.playShootSound(175, 0.07),
      deagle: () => this.playShootSound(110, 0.12),
      rifle: () => this.playShootSound(120, 0.06),
      m4a1: () => this.playShootSound(118, 0.06),
      famas: () => this.playShootSound(126, 0.06),
      ak47: () => this.playShootSound(100, 0.07),
      galil: () => this.playShootSound(108, 0.07),
      shotgun: () => this.playShootSound(80, 0.15),
      sniper: () => this.playShootSound(60, 0.2),
      awp: () => this.playShootSound(55, 0.22),
    };

    const playFn = sounds[weaponType] || sounds["rifle"];
    playFn();
  }

  playShootSound(freq, duration) {
    if (!this.enabled || !this.context) return;

    try {
      const oscillator = this.context.createOscillator();
      const gainNode = this.context.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.context.destination);

      oscillator.type = "sawtooth";
      oscillator.frequency.setValueAtTime(freq, this.context.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(
        freq * 0.5,
        this.context.currentTime + duration,
      );

      const now = this.context.currentTime;
      const volume = this.sfxVolume * this.masterVolume;
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (error) {
      console.warn("Failed to play shoot sound:", error);
    }
  }

  // 命中音效
  playHit() {
    this.play("hit");
  }

  // 击杀音效
  playKill() {
    this.play("kill");
  }

  // 死亡音效
  playDeath() {
    this.play("death");
  }

  // 跳跃音效
  playJump() {
    this.play("jump");
  }

  // 落地音效
  playLand() {
    this.play("land");
  }

  // 脚步音效
  playFootstep() {
    this.play("footstep", 0.3);
  }

  // 换弹音效
  playReload() {
    this.play("reload");
  }

  // 空弹夹音效
  playEmpty() {
    this.play("empty");
  }

  // 设置主音量
  setMasterVolume(volume) {
    this.masterVolume = Math.max(0, Math.min(1, volume));
  }

  // 设置音效音量
  setSfxVolume(volume) {
    this.sfxVolume = Math.max(0, Math.min(1, volume));
  }

  // 设置音乐音量
  setMusicVolume(volume) {
    this.musicVolume = Math.max(0, Math.min(1, volume));
  }

  // 切换静音
  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  // 恢复音频上下文（用户交互后调用）
  resume() {
    if (this.context && this.context.state === "suspended") {
      this.context.resume();
    }
  }
}

window.audioManager = new AudioManager();

