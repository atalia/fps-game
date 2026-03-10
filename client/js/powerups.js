// powerups.js - 道具系统
class PowerUpSystem {
    constructor(scene) {
        this.scene = scene;
        this.powerups = [];
        this.spawnPoints = [];
        this.respawnTime = 30000; // 30秒重生
    }

    // 初始化出生点
    initSpawnPoints(points) {
        this.spawnPoints = points;
        for (const point of points) {
            this.spawnPowerup(point);
        }
    }

    // 生成道具
    spawnPowerup(point) {
        const types = ['health', 'ammo', 'speed', 'damage', 'shield'];
        const type = types[Math.floor(Math.random() * types.length)];

        const powerup = {
            id: `powerup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type,
            position: { ...point },
            active: true,
            mesh: this.createMesh(type, point)
        };

        this.powerups.push(powerup);
        return powerup;
    }

    // 创建道具网格
    createMesh(type, position) {
        let geometry, material;

        switch (type) {
            case 'health':
                geometry = new THREE.OctahedronGeometry(0.3);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0x00ff00, 
                    emissive: 0x00ff00, 
                    emissiveIntensity: 0.5 
                });
                break;
            case 'ammo':
                geometry = new THREE.BoxGeometry(0.3, 0.3, 0.5);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0xffff00, 
                    emissive: 0xffff00, 
                    emissiveIntensity: 0.5 
                });
                break;
            case 'speed':
                geometry = new THREE.ConeGeometry(0.2, 0.4);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0x00ffff, 
                    emissive: 0x00ffff, 
                    emissiveIntensity: 0.5 
                });
                break;
            case 'damage':
                geometry = new THREE.TetrahedronGeometry(0.3);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0xff0000, 
                    emissive: 0xff0000, 
                    emissiveIntensity: 0.5 
                });
                break;
            case 'shield':
                geometry = new THREE.IcosahedronGeometry(0.25);
                material = new THREE.MeshStandardMaterial({ 
                    color: 0x0088ff, 
                    emissive: 0x0088ff, 
                    emissiveIntensity: 0.5 
                });
                break;
        }

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y + 0.5, position.z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        return mesh;
    }

    // 检查拾取
    checkPickup(playerPos, radius = 1) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            if (!powerup.active) continue;

            const dx = playerPos.x - powerup.position.x;
            const dz = playerPos.z - powerup.position.z;
            const dist = Math.sqrt(dx * dx + dz * dz);

            if (dist < radius) {
                powerup.active = false;
                this.scene.remove(powerup.mesh);

                // 设置重生
                setTimeout(() => {
                    this.respawnPowerup(powerup);
                }, this.respawnTime);

                return {
                    type: powerup.type,
                    id: powerup.id
                };
            }
        }
        return null;
    }

    // 重生道具
    respawnPowerup(powerup) {
        const types = ['health', 'ammo', 'speed', 'damage', 'shield'];
        const newType = types[Math.floor(Math.random() * types.length)];

        powerup.type = newType;
        powerup.active = true;
        powerup.mesh = this.createMesh(newType, powerup.position);
    }

    // 获取效果
    getEffect(type) {
        const effects = {
            health: { health: 50, duration: 0 },
            ammo: { ammo: 30, duration: 0 },
            speed: { speedMultiplier: 1.5, duration: 10000 },
            damage: { damageMultiplier: 2, duration: 15000 },
            shield: { shield: 100, duration: 20000 }
        };
        return effects[type] || null;
    }

    // 更新动画
    update(dt) {
        for (const powerup of this.powerups) {
            if (!powerup.active || !powerup.mesh) continue;

            // 旋转动画
            powerup.mesh.rotation.y += dt * 2;

            // 上下浮动
            powerup.mesh.position.y = powerup.position.y + 0.5 + Math.sin(Date.now() * 0.003) * 0.1;
        }
    }

    // 清除所有道具
    clear() {
        for (const powerup of this.powerups) {
            if (powerup.mesh) {
                this.scene.remove(powerup.mesh);
            }
        }
        this.powerups = [];
    }
}

// 道具效果管理器
class PowerUpEffectManager {
    constructor() {
        this.activeEffects = [];
    }

    // 应用效果
    applyEffect(effect, player) {
        if (!effect) return;

        // 立即效果
        if (effect.health && player.health < player.maxHealth) {
            player.health = Math.min(player.maxHealth, player.health + effect.health);
        }
        if (effect.ammo) {
            player.ammo = Math.min(player.maxAmmo, player.ammo + effect.ammo);
        }
        if (effect.shield) {
            player.shield = (player.shield || 0) + effect.shield;
        }

        // 持续效果
        if (effect.duration > 0) {
            const activeEffect = {
                type: effect,
                startTime: Date.now(),
                duration: effect.duration,
                player
            };

            // 应用持续效果
            if (effect.speedMultiplier) {
                player.speedMultiplier = effect.speedMultiplier;
            }
            if (effect.damageMultiplier) {
                player.damageMultiplier = effect.damageMultiplier;
            }

            this.activeEffects.push(activeEffect);
        }
    }

    // 更新效果
    update() {
        const now = Date.now();

        this.activeEffects = this.activeEffects.filter(effect => {
            if (now - effect.startTime >= effect.duration) {
                // 效果结束，移除
                if (effect.type.speedMultiplier) {
                    effect.player.speedMultiplier = 1;
                }
                if (effect.type.damageMultiplier) {
                    effect.player.damageMultiplier = 1;
                }
                return false;
            }
            return true;
        });
    }
}

// 默认道具出生点
const DEFAULT_POWERUP_SPAWNS = [
    { x: 15, y: 0, z: 15 },
    { x: -15, y: 0, z: 15 },
    { x: 15, y: 0, z: -15 },
    { x: -15, y: 0, z: -15 },
    { x: 0, y: 0, z: 0 },
];

window.PowerUpSystem = PowerUpSystem;
window.PowerUpEffectManager = PowerUpEffectManager;
window.DEFAULT_POWERUP_SPAWNS = DEFAULT_POWERUP_SPAWNS;
