// effects.js - 战斗特效系统
class Effects {
    constructor(scene) {
        this.scene = scene;
        this.particles = [];
        this.muzzles = [];
        this.impacts = [];
        this.bloodSplats = [];
    }

    // 枪口火焰
    createMuzzleFlash(position, direction) {
        const flash = new THREE.PointLight(0xffaa00, 3, 10);
        flash.position.copy(position);
        this.scene.add(flash);
        
        // 火焰粒子
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 1.0
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(position);
        this.scene.add(mesh);
        
        this.muzzles.push({
            light: flash,
            mesh: mesh,
            life: 0.1,
            maxLife: 0.1
        });
    }

    // 命中效果
    createImpact(position, hitbox = 'body') {
        // 火花粒子
        const sparkCount = 8;
        const sparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            const geometry = new THREE.SphereGeometry(0.02, 4, 4);
            const material = new THREE.MeshBasicMaterial({ 
                color: hitbox === 'head' ? 0xff0000 : 0xffaa00,
                transparent: true,
                opacity: 1.0
            });
            const spark = new THREE.Mesh(geometry, material);
            spark.position.copy(position);
            
            // 随机方向
            const angle = Math.random() * Math.PI * 2;
            const speed = 0.5 + Math.random() * 1;
            spark.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * speed * (Math.random() * 0.5 + 0.5),
                Math.random() * speed,
                Math.sin(angle) * speed * (Math.random() * 0.5 + 0.5)
            );
            
            this.scene.add(spark);
            sparks.push(spark);
        }
        
        // 命中光环
        const ringGeometry = new THREE.RingGeometry(0.1, 0.3, 16);
        const ringMaterial = new THREE.MeshBasicMaterial({ 
            color: hitbox === 'head' ? 0xff0000 : 0xffaa00,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide
        });
        const ring = new THREE.Mesh(ringGeometry, ringMaterial);
        ring.position.copy(position);
        ring.lookAt(new THREE.Vector3(position.x + 1, position.y, position.z));
        this.scene.add(ring);
        
        this.impacts.push({
            sparks: sparks,
            ring: ring,
            life: 0.5,
            maxLife: 0.5
        });
    }

    // 击杀效果
    createDeathEffect(position) {
        // 死亡爆炸
        const particleCount = 20;
        const particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
            const material = new THREE.MeshBasicMaterial({ 
                color: new THREE.Color().setHSL(Math.random() * 0.1, 1, 0.5),
                transparent: true,
                opacity: 1.0
            });
            const particle = new THREE.Mesh(geometry, material);
            particle.position.copy(position);
            
            const angle = Math.random() * Math.PI * 2;
            const angleY = (Math.random() - 0.5) * Math.PI;
            const speed = 1 + Math.random() * 2;
            
            particle.userData.velocity = new THREE.Vector3(
                Math.cos(angle) * Math.cos(angleY) * speed,
                Math.sin(angleY) * speed + 1,
                Math.sin(angle) * Math.cos(angleY) * speed
            );
            particle.userData.rotationSpeed = new THREE.Vector3(
                Math.random() * 10,
                Math.random() * 10,
                Math.random() * 10
            );
            
            this.scene.add(particle);
            particles.push(particle);
        }
        
        // 闪光
        const flash = new THREE.PointLight(0xffffff, 5, 20);
        flash.position.copy(position);
        this.scene.add(flash);
        
        this.particles.push({
            particles: particles,
            light: flash,
            life: 1.5,
            maxLife: 1.5
        });
    }

    // 伤害数字
    createDamageNumber(position, damage, isHeadshot = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = isHeadshot ? '#ff4444' : '#ffffff';
        ctx.font = 'bold 48px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(damage.toString(), 64, 32);
        
        if (isHeadshot) {
            ctx.font = 'bold 24px Arial';
            ctx.fillText('HEADSHOT', 64, 56);
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            opacity: 1.0
        });
        const sprite = new THREE.Sprite(material);
        sprite.position.copy(position);
        sprite.position.y += 1;
        sprite.scale.set(1, 0.5, 1);
        this.scene.add(sprite);
        
        this.bloodSplats.push({
            sprite: sprite,
            life: 1.0,
            maxLife: 1.0
        });
    }

    // 弹道轨迹
    createBulletTrail(from, to) {
        const direction = new THREE.Vector3().subVectors(to, from);
        const length = direction.length();
        direction.normalize();
        
        const geometry = new THREE.CylinderGeometry(0.01, 0.01, length, 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffff00,
            transparent: true,
            opacity: 0.8
        });
        const trail = new THREE.Mesh(geometry, material);
        
        // 旋转到正确方向
        trail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
        
        // 放置在中点
        const midPoint = new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5);
        trail.position.copy(midPoint);
        
        this.scene.add(trail);
        
        this.particles.push({
            particles: [trail],
            light: null,
            life: 0.1,
            maxLife: 0.1,
            isTrail: true
        });
    }

    update(deltaTime) {
        // 更新枪口火焰
        this.muzzles = this.muzzles.filter(m => {
            m.life -= deltaTime;
            const progress = m.life / m.maxLife;
            
            m.light.intensity = progress * 3;
            m.mesh.material.opacity = progress;
            m.mesh.scale.setScalar(1 + (1 - progress) * 2);
            
            if (m.life <= 0) {
                this.scene.remove(m.light);
                this.scene.remove(m.mesh);
                return false;
            }
            return true;
        });
        
        // 更新命中效果
        this.impacts = this.impacts.filter(i => {
            i.life -= deltaTime;
            const progress = i.life / i.maxLife;
            
            // 更新火花
            i.sparks.forEach(spark => {
                spark.position.add(spark.userData.velocity.clone().multiplyScalar(deltaTime));
                spark.userData.velocity.y -= deltaTime * 10; // 重力
                spark.material.opacity = progress;
            });
            
            // 更新光环
            i.ring.scale.setScalar(1 + (1 - progress) * 3);
            i.ring.material.opacity = progress;
            
            if (i.life <= 0) {
                i.sparks.forEach(s => this.scene.remove(s));
                this.scene.remove(i.ring);
                return false;
            }
            return true;
        });
        
        // 更新粒子
        this.particles = this.particles.filter(p => {
            p.life -= deltaTime;
            const progress = p.life / p.maxLife;
            
            p.particles.forEach(particle => {
                particle.position.add(particle.userData.velocity.clone().multiplyScalar(deltaTime));
                particle.userData.velocity.y -= deltaTime * 5; // 重力
                
                if (particle.userData.rotationSpeed) {
                    particle.rotation.x += particle.userData.rotationSpeed.x * deltaTime;
                    particle.rotation.y += particle.userData.rotationSpeed.y * deltaTime;
                    particle.rotation.z += particle.userData.rotationSpeed.z * deltaTime;
                }
                
                particle.material.opacity = progress;
            });
            
            if (p.light) {
                p.light.intensity = progress * 5;
            }
            
            if (p.life <= 0) {
                p.particles.forEach(particle => this.scene.remove(particle));
                if (p.light) this.scene.remove(p.light);
                return false;
            }
            return true;
        });
        
        // 更新伤害数字
        this.bloodSplats = this.bloodSplats.filter(b => {
            b.life -= deltaTime;
            const progress = b.life / b.maxLife;
            
            b.sprite.position.y += deltaTime * 0.5; // 上浮
            b.sprite.material.opacity = progress;
            b.sprite.scale.setScalar(1 + (1 - progress) * 0.5);
            
            if (b.life <= 0) {
                this.scene.remove(b.sprite);
                return false;
            }
            return true;
        });
    }
}

window.Effects = Effects;
