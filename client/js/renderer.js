// renderer.js - Three.js 3D 渲染器（卡通风格）
class Renderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.players = new Map();
        this.projectiles = [];
        this.effects = null;
        this.clock = new THREE.Clock();

        this.init();
    }

    init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.container.appendChild(this.renderer.domElement);

        this.camera.position.set(0, 2, 5);
        this.setupLighting();
        this.createGround();
        this.createMap();
        this.createSkybox();
        this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 150);
        this.effects = new Effects(this.scene);
        window.addEventListener('resize', () => this.onResize());
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0x4488ff, 0.4);
        this.scene.add(ambientLight);

        const mainLight = new THREE.DirectionalLight(0xffeedd, 1.0);
        mainLight.position.set(50, 100, 50);
        mainLight.castShadow = true;
        mainLight.shadow.mapSize.width = 2048;
        mainLight.shadow.mapSize.height = 2048;
        mainLight.shadow.camera.near = 10;
        mainLight.shadow.camera.far = 200;
        mainLight.shadow.camera.left = -50;
        mainLight.shadow.camera.right = 50;
        mainLight.shadow.camera.top = 50;
        mainLight.shadow.camera.bottom = -50;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.4);
        fillLight.position.set(-30, 50, -30);
        this.scene.add(fillLight);

        const groundLight = new THREE.HemisphereLight(0x4488ff, 0x222233, 0.3);
        this.scene.add(groundLight);
    }

    createGround() {
        const size = 100;
        const divisions = 20;
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const tileSize = canvas.width / divisions;
        
        for (let i = 0; i < divisions; i++) {
            for (let j = 0; j < divisions; j++) {
                ctx.fillStyle = (i + j) % 2 === 0 ? '#2a2a3a' : '#1a1a28';
                ctx.fillRect(i * tileSize, j * tileSize, tileSize, tileSize);
            }
        }
        
        ctx.strokeStyle = '#3a3a4a';
        ctx.lineWidth = 2;
        for (let i = 0; i <= divisions; i++) {
            ctx.beginPath();
            ctx.moveTo(i * tileSize, 0);
            ctx.lineTo(i * tileSize, canvas.height);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i * tileSize);
            ctx.lineTo(canvas.width, i * tileSize);
            ctx.stroke();
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2);

        const geometry = new THREE.PlaneGeometry(size, size);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.8,
            metalness: 0.1
        });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    createMap() {
        const obstacles = [
            { x: 10, z: 10, w: 4, h: 3, d: 4, color: 0x44aa44 },
            { x: -10, z: -10, w: 4, h: 3, d: 4, color: 0xaa4444 },
            { x: 15, z: -15, w: 6, h: 2, d: 2, color: 0x4444aa },
            { x: -15, z: 15, w: 2, h: 2, d: 6, color: 0xaaaa44 },
            { x: 0, z: 20, w: 8, h: 4, d: 2, color: 0x44aaaa },
            { x: 0, z: -20, w: 8, h: 4, d: 2, color: 0xaa44aa },
            { x: 20, z: 0, w: 2, h: 4, d: 8, color: 0xdd8844 },
            { x: -20, z: 0, w: 2, h: 4, d: 8, color: 0x8844dd },
        ];

        obstacles.forEach(obs => {
            const geometry = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
            const material = new THREE.MeshStandardMaterial({
                color: obs.color,
                roughness: 0.5,
                metalness: 0.3
            });
            const box = new THREE.Mesh(geometry, material);
            box.position.set(obs.x, obs.h / 2, obs.z);
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);
        });

        const pillarPositions = [
            { x: 25, z: 25 }, { x: -25, z: 25 },
            { x: 25, z: -25 }, { x: -25, z: -25 },
        ];

        pillarPositions.forEach(pos => {
            const geometry = new THREE.CylinderGeometry(1, 1.2, 6, 8);
            const material = new THREE.MeshStandardMaterial({
                color: 0x666688,
                roughness: 0.4,
                metalness: 0.5
            });
            const pillar = new THREE.Mesh(geometry, material);
            pillar.position.set(pos.x, 3, pos.z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.scene.add(pillar);
        });
    }

    createSkybox() {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a0a1a');
        gradient.addColorStop(0.3, '#1a1a3a');
        gradient.addColorStop(0.6, '#2a2a4a');
        gradient.addColorStop(1, '#1a1a2e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * canvas.width;
            const y = Math.random() * canvas.height * 0.6;
            const size = Math.random() * 2 + 0.5;
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }

        const texture = new THREE.CanvasTexture(canvas);
        const skyGeo = new THREE.SphereGeometry(400, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({ map: texture, side: THREE.BackSide });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }

    // ========== 卡通角色创建 ==========
    createPlayer(id, position, isBot = false) {
        const group = new THREE.Group();
        
        // 卡通配色方案
        const colors = isBot ? {
            body: 0xff5533,      // 橙红
            bodyDark: 0xcc3311,
            head: 0xffddaa,      // 肤色
            eyes: 0xff0000,      // 红眼
            outline: 0x000000
        } : {
            body: 0x3399ff,      // 蓝色
            bodyDark: 0x2266cc,
            head: 0xffddaa,      // 肤色
            eyes: 0x000000,      // 黑眼
            outline: 0x000000
        };

        // ========== 身体（胶囊形）==========
        const bodyGroup = new THREE.Group();
        
        // 躯干 - 圆润的胶囊形状
        const torsoGeo = new THREE.CapsuleGeometry(0.35, 0.6, 8, 16);
        const torsoMat = new THREE.MeshToonMaterial({ color: colors.body });
        const torso = new THREE.Mesh(torsoGeo, torsoMat);
        torso.position.y = 0.7;
        torso.castShadow = true;
        bodyGroup.add(torso);

        // 腿部 - 短粗的圆柱
        const legGeo = new THREE.CapsuleGeometry(0.12, 0.3, 4, 8);
        const legMat = new THREE.MeshToonMaterial({ color: colors.bodyDark });
        
        const leftLeg = new THREE.Mesh(legGeo, legMat);
        leftLeg.position.set(-0.15, 0.2, 0);
        leftLeg.castShadow = true;
        bodyGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeo, legMat);
        rightLeg.position.set(0.15, 0.2, 0);
        rightLeg.castShadow = true;
        bodyGroup.add(rightLeg);

        // 手臂
        const armGeo = new THREE.CapsuleGeometry(0.08, 0.35, 4, 8);
        const armMat = new THREE.MeshToonMaterial({ color: colors.body });
        
        const leftArm = new THREE.Mesh(armGeo, armMat);
        leftArm.position.set(-0.45, 0.75, 0);
        leftArm.rotation.z = 0.3;
        leftArm.castShadow = true;
        bodyGroup.add(leftArm);
        
        const rightArm = new THREE.Mesh(armGeo, armMat);
        rightArm.position.set(0.45, 0.75, 0);
        rightArm.rotation.z = -0.3;
        rightArm.castShadow = true;
        bodyGroup.add(rightArm);

        group.add(bodyGroup);

        // ========== 头部（大头卡通比例）==========
        const headGroup = new THREE.Group();
        
        // 头部 - 大圆球
        const headGeo = new THREE.SphereGeometry(0.38, 16, 16);
        const headMat = new THREE.MeshToonMaterial({ color: colors.head });
        const head = new THREE.Mesh(headGeo, headMat);
        head.castShadow = true;
        headGroup.add(head);

        // 眼睛
        const eyeGeo = new THREE.SphereGeometry(0.08, 8, 8);
        const eyeMat = new THREE.MeshBasicMaterial({ color: colors.eyes });
        
        // 眼白
        const eyeWhiteGeo = new THREE.SphereGeometry(0.1, 8, 8);
        const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        
        const leftEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        leftEyeWhite.position.set(-0.12, 0.05, 0.3);
        headGroup.add(leftEyeWhite);
        
        const rightEyeWhite = new THREE.Mesh(eyeWhiteGeo, eyeWhiteMat);
        rightEyeWhite.position.set(0.12, 0.05, 0.3);
        headGroup.add(rightEyeWhite);
        
        // 瞳孔
        const leftPupil = new THREE.Mesh(eyeGeo, eyeMat);
        leftPupil.position.set(-0.12, 0.05, 0.36);
        headGroup.add(leftPupil);
        
        const rightPupil = new THREE.Mesh(eyeGeo, eyeMat);
        rightPupil.position.set(0.12, 0.05, 0.36);
        headGroup.add(rightPupil);

        // 嘴巴 - 微笑
        if (!isBot) {
            const smileGeo = new THREE.TorusGeometry(0.08, 0.02, 8, 16, Math.PI);
            const smileMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
            const smile = new THREE.Mesh(smileGeo, smileMat);
            smile.position.set(0, -0.1, 0.32);
            smile.rotation.x = Math.PI;
            headGroup.add(smile);
        }

        // 机器人特征：天线
        if (isBot) {
            const antennaGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.2, 8);
            const antennaMat = new THREE.MeshBasicMaterial({ color: 0x666666 });
            const antenna = new THREE.Mesh(antennaGeo, antennaMat);
            antenna.position.set(0, 0.45, 0);
            headGroup.add(antenna);
            
            const antennaBallGeo = new THREE.SphereGeometry(0.05, 8, 8);
            const antennaBallMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const antennaBall = new THREE.Mesh(antennaBallGeo, antennaBallMat);
            antennaBall.position.set(0, 0.55, 0);
            headGroup.add(antennaBall);
        }

        headGroup.position.y = 1.45;
        group.add(headGroup);

        // 设置位置
        group.position.set(position.x || 0, 0, position.z || 0);
        
        // 存储动画数据
        group.userData = {
            bodyGroup,
            headGroup,
            leftLeg,
            rightLeg,
            leftArm,
            rightArm,
            animationTime: Math.random() * Math.PI * 2,
            isBot
        };

        this.scene.add(group);
        this.players.set(id, group);
        return group;
    }

    // 角色动画更新
    updatePlayerAnimations(deltaTime) {
        this.players.forEach(player => {
            if (!player.userData) return;
            
            const data = player.userData;
            data.animationTime += deltaTime * 3;
            
            // 轻微的呼吸/idle 动画
            const breathe = Math.sin(data.animationTime * 0.5) * 0.02;
            data.bodyGroup.position.y = 0.7 + breathe;
            data.headGroup.position.y = 1.45 + breathe * 0.5;
            
            // 手臂轻微摆动
            data.leftArm.rotation.x = Math.sin(data.animationTime) * 0.1;
            data.rightArm.rotation.x = Math.sin(data.animationTime + Math.PI) * 0.1;
        });
    }

    removePlayer(id) {
        const player = this.players.get(id);
        if (player) {
            this.scene.remove(player);
            this.players.delete(id);
        }
    }

    updatePlayer(id, position, rotation) {
        const player = this.players.get(id);
        if (player) {
            player.position.set(position.x, 0, position.z);
            player.rotation.y = rotation;
        }
    }

    updateCamera(position, rotation) {
        this.camera.position.set(position.x, position.y + 1.7, position.z);
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.y = rotation;
    }

    // 特效接口
    createMuzzleFlash(position, direction) {
        if (this.effects) this.effects.createMuzzleFlash(position, direction);
    }
    createImpact(position, hitbox) {
        if (this.effects) this.effects.createImpact(position, hitbox);
    }
    createDeathEffect(position) {
        if (this.effects) this.effects.createDeathEffect(position);
    }
    createDamageNumber(position, damage, isHeadshot) {
        if (this.effects) this.effects.createDamageNumber(position, damage, isHeadshot);
    }
    createBulletTrail(from, to) {
        if (this.effects) this.effects.createBulletTrail(from, to);
    }

    update(deltaTime) {
        if (this.effects) this.effects.update(deltaTime);
        this.updatePlayerAnimations(deltaTime);
    }

    render() {
        const deltaTime = this.clock.getDelta();
        this.update(deltaTime);
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    dispose() {
        this.renderer.dispose();
        this.container.removeChild(this.renderer.domElement);
    }
}

window.Renderer = Renderer;
