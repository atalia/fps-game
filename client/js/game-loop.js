// game-loop.js - 游戏主循环
class GameLoop {
    constructor(fps = 60) {
        this.fps = fps;
        this.frameTime = 1000 / fps;
        this.running = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.callbacks = [];
    }

    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.loop();
    }

    stop() {
        this.running = false;
    }

    loop() {
        if (!this.running) return;

        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        // 执行所有回调
        for (const cb of this.callbacks) {
            cb(this.deltaTime);
        }

        // 下一帧
        requestAnimationFrame(() => this.loop());
    }

    onTick(callback) {
        this.callbacks.push(callback);
    }

    removeCallback(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }
}

// 粒子系统
class ParticleSystem {
    constructor() {
        this.particles = [];
        this.maxParticles = 1000;
    }

    emit(position, options = {}) {
        const count = options.count || 10;
        const color = options.color || 0xffffff;
        const size = options.size || 0.1;
        const lifetime = options.lifetime || 1;
        const velocity = options.velocity || { x: 0, y: 1, z: 0 };
        const spread = options.spread || 1;

        for (let i = 0; i < count && this.particles.length < this.maxParticles; i++) {
            const particle = {
                position: { ...position },
                velocity: {
                    x: velocity.x + (Math.random() - 0.5) * spread,
                    y: velocity.y + Math.random() * spread,
                    z: velocity.z + (Math.random() - 0.5) * spread
                },
                color,
                size,
                lifetime,
                age: 0
            };
            this.particles.push(particle);
        }
    }

    update(dt) {
        this.particles = this.particles.filter(p => {
            p.age += dt;
            if (p.age >= p.lifetime) return false;

            // 更新位置
            p.position.x += p.velocity.x * dt;
            p.position.y += p.velocity.y * dt;
            p.position.z += p.velocity.z * dt;

            // 重力
            p.velocity.y -= 9.8 * dt;

            return true;
        });
    }

    clear() {
        this.particles = [];
    }
}

// 相机控制
class CameraController {
    constructor(camera) {
        this.camera = camera;
        this.target = { x: 0, y: 1.7, z: 0 };
        this.rotation = { x: 0, y: 0 };
        this.smoothness = 0.1;
    }

    setTarget(x, y, z) {
        this.target.x = x;
        this.target.y = y + 1.7; // 眼睛高度
        this.target.z = z;
    }

    setRotation(yaw, pitch) {
        this.rotation.y = yaw;
        this.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));
    }

    update(dt) {
        // 平滑移动
        this.camera.position.x += (this.target.x - this.camera.position.x) * this.smoothness;
        this.camera.position.y += (this.target.y - this.camera.position.y) * this.smoothness;
        this.camera.position.z += (this.target.z - this.camera.position.z) * this.smoothness;

        // 应用旋转
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = this.rotation.y;
        this.camera.rotation.x = this.rotation.x;
    }
}

// 弹道系统
class BulletSystem {
    constructor(scene) {
        this.scene = scene;
        this.bullets = [];
        this.maxBullets = 100;
    }

    fire(from, to, speed = 100) {
        if (this.bullets.length >= this.maxBullets) {
            // 移除最旧的子弹
            const old = this.bullets.shift();
            this.scene.remove(old.mesh);
        }

        const geometry = new THREE.SphereGeometry(0.05, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(geometry, material);

        bullet.position.set(from.x, from.y, from.z);

        const direction = new THREE.Vector3(
            to.x - from.x,
            to.y - from.y,
            to.z - from.z
        ).normalize();

        this.scene.add(bullet);

        this.bullets.push({
            mesh: bullet,
            direction,
            speed,
            distance: 0,
            maxDistance: 500
        });
    }

    update(dt) {
        this.bullets = this.bullets.filter(b => {
            const move = b.speed * dt;
            b.mesh.position.add(b.direction.clone().multiplyScalar(move));
            b.distance += move;

            if (b.distance >= b.maxDistance) {
                this.scene.remove(b.mesh);
                return false;
            }
            return true;
        });
    }

    clear() {
        for (const b of this.bullets) {
            this.scene.remove(b.mesh);
        }
        this.bullets = [];
    }
}

// 地图管理
class MapManager {
    constructor(scene) {
        this.scene = scene;
        this.obstacles = [];
    }

    loadMap(mapData) {
        // 清除旧地图
        this.clearMap();

        // 加载障碍物
        for (const obs of mapData.obstacles) {
            const geometry = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
            const material = new THREE.MeshStandardMaterial({
                color: obs.color || 0x666666,
                roughness: 0.5
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(obs.x, obs.y || obs.h / 2, obs.z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            this.scene.add(mesh);
            this.obstacles.push({
                mesh,
                bounds: {
                    minX: obs.x - obs.w / 2,
                    maxX: obs.x + obs.w / 2,
                    minZ: obs.z - obs.d / 2,
                    maxZ: obs.z + obs.d / 2
                }
            });
        }
    }

    checkCollision(x, z, radius = 0.5) {
        for (const obs of this.obstacles) {
            if (x + radius > obs.bounds.minX &&
                x - radius < obs.bounds.maxX &&
                z + radius > obs.bounds.minZ &&
                z - radius < obs.bounds.maxZ) {
                return true;
            }
        }
        return false;
    }

    clearMap() {
        for (const obs of this.obstacles) {
            this.scene.remove(obs.mesh);
        }
        this.obstacles = [];
    }
}

// 默认地图数据
const DEFAULT_MAP = {
    obstacles: [
        // 中央建筑
        { x: 0, z: 0, w: 10, h: 4, d: 10, color: 0x555555 },
        // 四角掩体
        { x: 20, z: 20, w: 4, h: 2, d: 4, color: 0x666666 },
        { x: -20, z: 20, w: 4, h: 2, d: 4, color: 0x666666 },
        { x: 20, z: -20, w: 4, h: 2, d: 4, color: 0x666666 },
        { x: -20, z: -20, w: 4, h: 2, d: 4, color: 0x666666 },
        // 侧翼
        { x: 30, z: 0, w: 2, h: 3, d: 15, color: 0x444444 },
        { x: -30, z: 0, w: 2, h: 3, d: 15, color: 0x444444 },
        { x: 0, z: 30, w: 15, h: 3, d: 2, color: 0x444444 },
        { x: 0, z: -30, w: 15, h: 3, d: 2, color: 0x444444 },
    ]
};

window.GameLoop = GameLoop;
window.ParticleSystem = ParticleSystem;
window.CameraController = CameraController;
window.BulletSystem = BulletSystem;
window.MapManager = MapManager;
window.DEFAULT_MAP = DEFAULT_MAP;
