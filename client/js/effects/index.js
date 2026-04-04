// client/js/effects/index.js
// 特效系统入口

console.log('[EFFECTS] effects/index.js loading...')

// 等待所有模块加载完成
class EffectsSystem {
    constructor() {
        this.performanceMonitor = window.performanceMonitor
        this.initialized = false
        
        // 模块引用（初始化后填充）
        this.core = null
        this.damageNumber = null
        this.healthBar = null
        this.hitIndicator = null
        this.killfeed = null
        this.killNotice = null
        this.killstreak = null
        this.achievements = null
        this.screenEffects = null
        this.crosshair = null
        this.ammoDisplay = null
    }

    init(renderer) {
        console.log('[EFFECTS] Initializing effects system...')
        this.renderer = renderer
        
        // 初始化各模块（按依赖顺序）
        if (window.EffectsCore) {
            this.core = new window.EffectsCore(renderer)
        }
        
        if (window.DamageNumber) {
            this.damageNumber = new window.DamageNumber()
        }
        
        if (window.HealthBarManager) {
            this.healthBar = new window.HealthBarManager(renderer)
        }
        
        if (window.HitIndicator) {
            this.hitIndicator = new window.HitIndicator()
        }
        
        if (window.KillfeedEnhanced) {
            this.killfeed = new window.KillfeedEnhanced()
        }
        
        if (window.KillNotice) {
            this.killNotice = new window.KillNotice()
        }
        
        if (window.KillstreakEnhanced) {
            this.killstreak = new window.KillstreakEnhanced()
        }
        
        if (window.AchievementsEnhanced) {
            this.achievements = new window.AchievementsEnhanced()
        }
        
        if (window.ScreenEffectsEnhanced) {
            this.screenEffects = new window.ScreenEffectsEnhanced()
        }
        
        if (window.DynamicCrosshair) {
            this.crosshair = new window.DynamicCrosshair()
        }
        
        if (window.AmmoDisplayEnhanced) {
            this.ammoDisplay = new window.AmmoDisplayEnhanced()
        }
        
        // 监听性能等级变化
        this.performanceMonitor.onLevelChange((oldLevel, newLevel, fps, config) => {
            this.applyPerformanceLevel(config)
        })
        
        this.initialized = true
        console.log('[EFFECTS] Effects system initialized')
    }

    applyPerformanceLevel(config) {
        // 通知各模块应用新的性能配置
        if (this.core) this.core.setConfig(config.particles)
        if (this.healthBar) this.healthBar.setConfig(config.healthBars)
        if (this.screenEffects) this.screenEffects.setEnabled(config.screenShake)
        if (this.killfeed) this.killfeed.setAnimated(config.killfeed.animated)
        if (this.achievements) this.achievements.setAnimated(config.achievements.animated)
        if (this.crosshair) this.crosshair.setDynamic(config.crosshair.dynamic)
    }

    // 每帧更新
    update(deltaTime) {
        this.performanceMonitor.tick()
        
        if (this.core) this.core.update(deltaTime)
        if (this.healthBar) this.healthBar.update(deltaTime)
        if (this.crosshair) this.crosshair.update(deltaTime)

        // 更新烟雾效果
        if (this.smokeEffects && this.smokeEffects.length > 0) {
            const now = Date.now()
            this.smokeEffects = this.smokeEffects.filter(smoke => {
                if (now - smoke.startTime > smoke.duration) {
                    // 移除过期烟雾
                    if (smoke.group && this.renderer?.scene) {
                        this.renderer.scene.remove(smoke.group)
                        smoke.group.traverse(child => {
                            if (child.geometry) child.geometry.dispose()
                            if (child.material) child.material.dispose()
                        })
                    }
                    return false
                }
                return true
            })
        }
    }

    // 渲染（在Three.js渲染循环中调用）
    render(scene) {
        if (this.core) this.core.render(scene)
        if (this.healthBar) this.healthBar.render()
    }

    // 清理
    clear() {
        if (this.core) this.core.clear()
        if (this.healthBar) this.healthBar.clear()
        if (this.damageNumber) this.damageNumber.clear()
        // 清理烟雾效果
        this.smokeEffects = []
    }

    // 添加烟雾效果
    addSmokeEffect(position, radius = 6) {
        if (!this.renderer?.scene) return

        // 创建烟雾粒子系统
        const smokeGroup = new THREE.Group()
        smokeGroup.position.set(position.x, position.y + 1, position.z)

        // 烟雾粒子
        const particleCount = 50
        const geometry = new THREE.BufferGeometry()
        const positions = new Float32Array(particleCount * 3)
        const colors = new Float32Array(particleCount * 3)
        const sizes = new Float32Array(particleCount)

        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2
            const r = Math.random() * radius
            positions[i * 3] = Math.cos(angle) * r
            positions[i * 3 + 1] = Math.random() * 3
            positions[i * 3 + 2] = Math.sin(angle) * r

            colors[i * 3] = 0.7
            colors[i * 3 + 1] = 0.7
            colors[i * 3 + 2] = 0.7

            sizes[i] = 1 + Math.random() * 2
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

        const material = new THREE.PointsMaterial({
            size: 2,
            vertexColors: true,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        })

        const particles = new THREE.Points(geometry, material)
        smokeGroup.add(particles)

        this.renderer.scene.add(smokeGroup)

        // 存储以便清理
        if (!this.smokeEffects) this.smokeEffects = []
        this.smokeEffects.push({
            group: smokeGroup,
            startTime: Date.now(),
            duration: 18000
        })

        return smokeGroup
    }

    // 添加爆炸效果
    addExplosion(position, radius = 8) {
        if (!this.renderer?.scene) return

        // 创建爆炸闪光
        const geometry = new THREE.SphereGeometry(radius, 16, 16)
        const material = new THREE.MeshBasicMaterial({
            color: 0xff6600,
            transparent: true,
            opacity: 0.8
        })
        const sphere = new THREE.Mesh(geometry, material)
        sphere.position.set(position.x, position.y + 0.5, position.z)
        this.renderer.scene.add(sphere)

        // 快速消失
        const startTime = Date.now()
        const animate = () => {
            const elapsed = Date.now() - startTime
            const progress = elapsed / 500
            if (progress < 1) {
                sphere.scale.setScalar(1 + progress)
                material.opacity = 0.8 * (1 - progress)
                requestAnimationFrame(animate)
            } else {
                this.renderer.scene.remove(sphere)
                geometry.dispose()
                material.dispose()
            }
        }
        animate()

        return sphere
    }
}

// 创建全局实例
window.effectsSystem = new EffectsSystem()
window.EffectsSystem = EffectsSystem

console.log('[EFFECTS] effects/index.js loaded')
