// Effects Manager - 视觉特效管理
console.log('[EFFECTS] effects.js loading...')

class EffectsManager {
  constructor(renderer) {
    console.log('[EFFECTS] EffectsManager constructor called')
    this.renderer = renderer
    this.effects = []
    this.maxEffects = 100
    console.log('[EFFECTS] EffectsManager initialized, maxEffects:', this.maxEffects)
  }

  // 创建枪口火焰
  createMuzzleFlash(position, rotation) {
    const flash = {
      type: 'muzzle_flash',
      position: { ...position },
      rotation: rotation,
      life: 0.1,
      maxLife: 0.1,
      size: 0.5,
      color: 0xffaa00
    }
    this.addEffect(flash)
  }

  // 创建命中特效
  createHitEffect(position) {
    const effect = {
      type: 'hit',
      position: { ...position },
      particles: this.createParticles(position, 0xff0000, 10),
      life: 0.3,
      maxLife: 0.3
    }
    this.addEffect(effect)
  }

  // 创建击杀特效
  createKillEffect(position) {
    const effect = {
      type: 'kill',
      position: { ...position },
      particles: this.createParticles(position, 0xff4400, 30),
      life: 0.5,
      maxLife: 0.5
    }
    this.addEffect(effect)
  }

  // 创建爆炸特效
  createExplosion(position) {
    const effect = {
      type: 'explosion',
      position: { ...position },
      particles: this.createParticles(position, 0xff6600, 50),
      life: 0.8,
      maxLife: 0.8
    }
    this.addEffect(effect)
  }

  // 创建子弹轨迹
  createBulletTrail(from, to) {
    const effect = {
      type: 'bullet_trail',
      from: { ...from },
      to: { ...to },
      life: 0.1,
      maxLife: 0.1
    }
    this.addEffect(effect)
  }

  // 创建血迹效果
  createBloodSplatter(position) {
    const effect = {
      type: 'blood',
      position: { ...position },
      particles: this.createParticles(position, 0x880000, 20),
      life: 1.0,
      maxLife: 1.0
    }
    this.addEffect(effect)
  }

  // 创建粒子
  createParticles(position, color, count) {
    const particles = []
    for (let i = 0; i < count; i++) {
      particles.push({
        x: position.x + (Math.random() - 0.5) * 0.5,
        y: position.y + Math.random() * 0.5,
        z: position.z + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 5,
        vz: (Math.random() - 0.5) * 5,
        size: Math.random() * 0.2 + 0.1,
        color: color,
        alpha: 1.0
      })
    }
    return particles
  }

  // 添加特效
  addEffect(effect) {
    console.log('[EFFECTS] addEffect:', effect.type, 'total:', this.effects.length)
    this.effects.push(effect)
    if (this.effects.length > this.maxEffects) {
      this.effects.shift()
    }
  }

  // 更新特效
  update(deltaTime) {
    this.effects = this.effects.filter(effect => {
      effect.life -= deltaTime
      
      if (effect.particles) {
        effect.particles.forEach(p => {
          p.x += p.vx * deltaTime
          p.y += p.vy * deltaTime
          p.z += p.vz * deltaTime
          p.vy -= 10 * deltaTime // 重力
          p.alpha = effect.life / effect.maxLife
        })
      }
      
      return effect.life > 0
    })
  }

  // 渲染特效（在主渲染循环中调用）
  render(scene) {
    this.effects.forEach(effect => {
      if (effect.type === 'muzzle_flash') {
        this.renderMuzzleFlash(scene, effect)
      } else if (effect.particles) {
        this.renderParticles(scene, effect)
      } else if (effect.type === 'bullet_trail') {
        this.renderBulletTrail(scene, effect)
      }
    })
  }

  // 渲染枪口火焰
  renderMuzzleFlash(scene, effect) {
    const geometry = new THREE.SphereGeometry(effect.size, 8, 8)
    const material = new THREE.MeshBasicMaterial({
      color: effect.color,
      transparent: true,
      opacity: effect.life / effect.maxLife
    })
    const mesh = new THREE.Mesh(geometry, material)
    
    // 放置在枪口位置
    const offset = 1.5 // 枪口偏移
    mesh.position.set(
      effect.position.x + Math.sin(effect.rotation) * offset,
      effect.position.y + 1.5,
      effect.position.z + Math.cos(effect.rotation) * offset
    )
    
    scene.add(mesh)
    
    // 下一帧移除
    setTimeout(() => scene.remove(mesh), 50)
  }

  // 渲染粒子
  renderParticles(scene, effect) {
    effect.particles.forEach(p => {
      const geometry = new THREE.SphereGeometry(p.size, 4, 4)
      const material = new THREE.MeshBasicMaterial({
        color: p.color,
        transparent: true,
        opacity: p.alpha
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(p.x, p.y, p.z)
      scene.add(mesh)
      
      setTimeout(() => scene.remove(mesh), 100)
    })
  }

  // 渲染子弹轨迹
  renderBulletTrail(scene, effect) {
    const points = [
      new THREE.Vector3(effect.from.x, effect.from.y + 1.5, effect.from.z),
      new THREE.Vector3(effect.to.x, effect.to.y + 1.5, effect.to.z)
    ]
    const geometry = new THREE.BufferGeometry().setFromPoints(points)
    const material = new THREE.LineBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: effect.life / effect.maxLife
    })
    const line = new THREE.Line(geometry, material)
    scene.add(line)
    
    setTimeout(() => scene.remove(line), 100)
  }

  // 清除所有特效
  clear() {
    this.effects = []
  }
}

// 屏幕特效
class ScreenEffects {
  constructor() {
    this.overlay = document.createElement('div')
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 100;
      transition: background-color 0.1s;
    `
    document.body.appendChild(this.overlay)
    
    this.damageOverlay = null
    this.healOverlay = null
  }

  // 受伤闪红
  showDamage(intensity = 0.5) {
    this.overlay.style.backgroundColor = `rgba(255, 0, 0, ${intensity})`
    setTimeout(() => {
      this.overlay.style.backgroundColor = 'transparent'
    }, 100)
  }

  // 击杀闪绿
  showKill() {
    this.overlay.style.backgroundColor = 'rgba(0, 255, 0, 0.2)'
    setTimeout(() => {
      this.overlay.style.backgroundColor = 'transparent'
    }, 150)
  }

  // 治愈闪蓝
  showHeal() {
    this.overlay.style.backgroundColor = 'rgba(0, 100, 255, 0.2)'
    setTimeout(() => {
      this.overlay.style.backgroundColor = 'transparent'
    }, 150)
  }

  // 死亡变暗
  showDeath() {
    this.overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'
  }

  // 重生恢复
  hideDeath() {
    this.overlay.style.backgroundColor = 'transparent'
  }

  // 震动效果
  shake(intensity = 10, duration = 100) {
    const gameContainer = document.getElementById('game-container')
    if (!gameContainer) return

    const originalTransform = gameContainer.style.transform
    let start = null

    const animate = (timestamp) => {
      if (!start) start = timestamp
      const progress = timestamp - start

      if (progress < duration) {
        const x = (Math.random() - 0.5) * intensity
        const y = (Math.random() - 0.5) * intensity
        gameContainer.style.transform = `translate(${x}px, ${y}px)`
        requestAnimationFrame(animate)
      } else {
        gameContainer.style.transform = originalTransform
      }
    }

    requestAnimationFrame(animate)
  }
}

window.EffectsManager = EffectsManager
console.log('[EFFECTS] EffectsManager class exported to window')
// 不要自动创建实例，由 main.js 控制
// window.screenEffects = new ScreenEffects()
