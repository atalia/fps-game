// client/js/effects/core.js
// 核心层特效：命中粒子、枪口火焰

console.log('[EFFECTS] effects/core.js loading...')

class EffectsCore {
    constructor(renderer) {
        this.renderer = renderer
        this.scene = renderer.scene
        this.effects = []
        this.maxEffects = 100
        this.config = { max: 100, hitBurst: 10 }
        
        // 对象池优化
        this.particlePool = []
        this.meshPool = []
    }

    setConfig(config) {
        this.config = config
        this.maxEffects = config.max
    }

    // ==================== 命中粒子爆发 ====================
    
    createHitBurst(position, isHeadshot = false) {
        const count = Math.min(this.config.hitBurst, 10)
        const color = isHeadshot ? 0xff8800 : 0xff3333
        
        for (let i = 0; i < count; i++) {
            const particle = {
                type: 'hit_particle',
                position: { 
                    x: position.x, 
                    y: position.y, 
                    z: position.z 
                },
                velocity: {
                    x: (Math.random() - 0.5) * 5,
                    y: Math.random() * 5,
                    z: (Math.random() - 0.5) * 5
                },
                size: Math.random() * 0.15 + 0.08,
                color: color,
                life: 0.3,
                maxLife: 0.3,
                gravity: -10
            }
            this.addEffect(particle)
        }
    }

    // ==================== 枪口火焰 ====================
    
    createMuzzleFlash(position, rotation) {
        const flash = {
            type: 'muzzle_flash',
            position: { ...position },
            rotation: rotation,
            size: 0.5,
            color: 0xffaa00,
            lightIntensity: 2.0,
            life: 0.1,
            maxLife: 0.1
        }
        this.addEffect(flash)
        
        // 创建临时光源
        this.createTempLight(position, 0xffaa00, 2.0, 10, 0.1)
    }

    createTempLight(position, color, intensity, distance, duration) {
        const light = new THREE.PointLight(color, intensity, distance)
        light.position.set(position.x, position.y + 1.5, position.z)
        this.scene.add(light)
        
        // 自动移除
        setTimeout(() => {
            this.scene.remove(light)
            light.dispose()
        }, duration * 1000)
    }

    // ==================== 爆炸特效 ====================
    
    createExplosion(position) {
        const count = Math.min(this.config.hitBurst * 3, 30)
        
        for (let i = 0; i < count; i++) {
            const particle = {
                type: 'explosion_particle',
                position: { ...position },
                velocity: {
                    x: (Math.random() - 0.5) * 10,
                    y: Math.random() * 8,
                    z: (Math.random() - 0.5) * 10
                },
                size: Math.random() * 0.3 + 0.1,
                color: Math.random() > 0.5 ? 0xff6600 : 0xffaa00,
                life: 0.8,
                maxLife: 0.8,
                gravity: -5
            }
            this.addEffect(particle)
        }
        
        // 爆炸光源
        this.createTempLight(position, 0xff6600, 5.0, 20, 0.3)
    }

    // ==================== 子弹轨迹 ====================
    
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

    // ==================== 血迹效果 ====================
    
    createBloodSplatter(position) {
        const count = Math.min(this.config.hitBurst * 2, 15)
        
        for (let i = 0; i < count; i++) {
            const particle = {
                type: 'blood_particle',
                position: { ...position },
                velocity: {
                    x: (Math.random() - 0.5) * 3,
                    y: Math.random() * 2,
                    z: (Math.random() - 0.5) * 3
                },
                size: Math.random() * 0.2 + 0.05,
                color: 0x880000,
                life: 1.0,
                maxLife: 1.0,
                gravity: -8
            }
            this.addEffect(particle)
        }
    }

    // ==================== 效果管理 ====================
    
    addEffect(effect) {
        this.effects.push(effect)
        
        // 超出上限移除最旧的
        while (this.effects.length > this.maxEffects) {
            this.effects.shift()
        }
    }

    update(deltaTime) {
        this.effects = this.effects.filter(effect => {
            effect.life -= deltaTime
            
            // 更新粒子物理
            if (effect.velocity) {
                effect.position.x += effect.velocity.x * deltaTime
                effect.position.y += effect.velocity.y * deltaTime
                effect.position.z += effect.velocity.z * deltaTime
                
                if (effect.gravity) {
                    effect.velocity.y += effect.gravity * deltaTime
                }
            }
            
            return effect.life > 0
        })
    }

    render(scene) {
        // 清理上一帧的临时mesh
        const toRemove = []
        
        this.effects.forEach(effect => {
            const alpha = effect.life / effect.maxLife
            
            if (effect.type === 'muzzle_flash') {
                const mesh = this.renderMuzzleFlash(effect, alpha)
                if (mesh) toRemove.push(mesh)
            } else if (effect.type === 'bullet_trail') {
                const mesh = this.renderBulletTrail(effect, alpha)
                if (mesh) toRemove.push(mesh)
            } else if (effect.velocity) {
                const mesh = this.renderParticle(effect, alpha)
                if (mesh) toRemove.push(mesh)
            }
        })
        
        // 延迟移除（让渲染完成）
        setTimeout(() => {
            toRemove.forEach(mesh => {
                scene.remove(mesh)
                if (mesh.geometry) mesh.geometry.dispose()
                if (mesh.material) mesh.material.dispose()
            })
        }, 50)
    }

    renderMuzzleFlash(effect, alpha) {
        const size = effect.size * (1 + (1 - alpha) * 0.5)
        const geometry = new THREE.SphereGeometry(size, 8, 8)
        const material = new THREE.MeshBasicMaterial({
            color: effect.color,
            transparent: true,
            opacity: alpha
        })
        const mesh = new THREE.Mesh(geometry, material)
        
        // 枪口位置偏移
        const offset = 1.5
        mesh.position.set(
            effect.position.x + Math.sin(effect.rotation) * offset,
            effect.position.y + 1.5,
            effect.position.z + Math.cos(effect.rotation) * offset
        )
        
        this.scene.add(mesh)
        return mesh
    }

    renderParticle(effect, alpha) {
        const geometry = new THREE.SphereGeometry(effect.size, 4, 4)
        const material = new THREE.MeshBasicMaterial({
            color: effect.color,
            transparent: true,
            opacity: alpha * 0.8
        })
        const mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(effect.position.x, effect.position.y, effect.position.z)
        this.scene.add(mesh)
        return mesh
    }

    renderBulletTrail(effect, alpha) {
        const points = [
            new THREE.Vector3(effect.from.x, effect.from.y, effect.from.z),
            new THREE.Vector3(effect.to.x, effect.to.y, effect.to.z)
        ]
        const geometry = new THREE.BufferGeometry().setFromPoints(points)
        const material = new THREE.LineBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: alpha
        })
        const line = new THREE.Line(geometry, material)
        this.scene.add(line)
        return line
    }

    clear() {
        this.effects = []
    }
}

window.EffectsCore = EffectsCore
console.log('[EFFECTS] EffectsCore class exported')
