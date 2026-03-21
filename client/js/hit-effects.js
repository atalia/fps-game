// hit-effects.js - 命中反馈效果
class HitEffects {
    constructor(scene, camera) {
        this.scene = scene;
        this.camera = camera;
        this.hitMarkers = [];
        this.damageNumbers = [];
    }

    // 显示命中标记
    showHitMarker(position, hitbox, damage) {
        const colors = {
            head: 0xff0000,
            body: 0xffffff,
            arm:  0xffff00,
            leg:  0x00ff00
        };

        // 创建命中标记 (X 形)
        const group = new THREE.Group();
        
        // 创建两条交叉线
        const lineMaterial = new THREE.LineBasicMaterial({
            color: colors[hitbox] || 0xffffff,
            transparent: true,
            opacity: 1
        });

        // 水平线
        const hPoints = [
            new THREE.Vector3(-0.1, 0, 0),
            new THREE.Vector3(0.1, 0, 0)
        ];
        const hGeometry = new THREE.BufferGeometry().setFromPoints(hPoints);
        const hLine = new THREE.Line(hGeometry, lineMaterial);
        group.add(hLine);

        // 垂直线
        const vPoints = [
            new THREE.Vector3(0, -0.1, 0),
            new THREE.Vector3(0, 0.1, 0)
        ];
        const vGeometry = new THREE.BufferGeometry().setFromPoints(vPoints);
        const vLine = new THREE.Line(vGeometry, lineMaterial);
        group.add(vLine);

        group.position.set(position.x, position.y, position.z);
        group.lookAt(this.camera.position);
        this.scene.add(group);

        this.hitMarkers.push({
            group: group,
            time: Date.now()
        });
    }

    // 显示伤害数字 (2D Canvas)
    showDamageNumber(position, damage, isHeadshot) {
        // 创建伤害数字元素
        const element = document.createElement('div');
        element.className = 'damage-number';
        element.style.cssText = `
            position: fixed;
            color: ${isHeadshot ? '#ff0000' : '#ffffff'};
            font-size: ${isHeadshot ? '32px' : '24px'};
            font-weight: bold;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            pointer-events: none;
            z-index: 1000;
            transform: translate(-50%, -50%);
        `;
        element.textContent = damage.toString();
        document.body.appendChild(element);

        // 计算屏幕位置 (简化版)
        const screenPos = this.worldToScreen(position);
        element.style.left = `${screenPos.x}px`;
        element.style.top = `${screenPos.y}px`;

        // 动画效果
        let startTime = Date.now();
        const animate = () => {
            const elapsed = Date.now() - startTime;
            if (elapsed > 1000) {
                element.remove();
                return;
            }

            const progress = elapsed / 1000;
            element.style.top = `${screenPos.y - progress * 50}px`;
            element.style.opacity = (1 - progress).toString();

            requestAnimationFrame(animate);
        };
        animate();
    }

    // 世界坐标转屏幕坐标 (简化版)
    worldToScreen(position) {
        const vector = new THREE.Vector3(position.x, position.y, position.z);
        vector.project(this.camera);

        return {
            x: (vector.x + 1) / 2 * window.innerWidth,
            y: -(vector.y - 1) / 2 * window.innerHeight
        };
    }

    // 更新效果
    update() {
        const now = Date.now();

        // 淡出命中标记
        for (let i = this.hitMarkers.length - 1; i >= 0; i--) {
            const elapsed = now - this.hitMarkers[i].time;
            if (elapsed > 500) {
                this.scene.remove(this.hitMarkers[i].group);
                this.hitMarkers.splice(i, 1);
            } else {
                // 淡出效果
                this.hitMarkers[i].group.children.forEach(child => {
                    if (child.material) {
                        child.material.opacity = 1 - elapsed / 500;
                    }
                });
            }
        }
    }
}

window.HitEffects = HitEffects;
