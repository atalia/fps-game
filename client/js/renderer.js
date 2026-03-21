// renderer.js - Three.js 3D 渲染器
console.log('[RENDERER] renderer.js loading...');

class Renderer {
    constructor(containerId) {
        console.log('[RENDERER] Constructor called, containerId:', containerId);
        this.container = document.getElementById(containerId);
        console.log('[RENDERER] Container found:', !!this.container);
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.players = new Map();
        this.projectiles = [];

        this.init();
    }

    init() {
        // 渲染器设置
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.container.appendChild(this.renderer.domElement);

        // 相机位置
        this.camera.position.set(0, 2, 5);

        // 光照
        this.setupLighting();

        // 创建地面
        this.createGround();

        // 创建简单的地图
        this.createMap();

        // 创建天空盒
        this.createSkybox();

        // 添加雾效
        this.scene.fog = new THREE.Fog(0x1a1a2e, 50, 150);

        // 窗口大小调整
        window.addEventListener('resize', () => this.onResize());
    }

    setupLighting() {
        // 环境光 - 冷色调
        const ambientLight = new THREE.AmbientLight(0x4488ff, 0.3);
        this.scene.add(ambientLight);

        // 主光源 - 暖色调
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
        mainLight.shadow.bias = -0.0001;
        this.scene.add(mainLight);

        // 补光 - 蓝色调
        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.4);
        fillLight.position.set(-30, 50, -30);
        this.scene.add(fillLight);

        // 地面反射光
        const groundLight = new THREE.HemisphereLight(0x4488ff, 0x222233, 0.3);
        this.scene.add(groundLight);
    }

    createGround() {
        // 棋盘格地面
        const size = 100;
        const divisions = 20;
        const halfSize = size / 2;
        const squareSize = size / divisions;

        // 创建棋盘格纹理
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

        // 添加网格线
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
        // 创建障碍物，不同颜色区分
        const obstacles = [
            { x: 10, z: 10, w: 4, h: 3, d: 4, color: 0x44aa44 },      // 绿色
            { x: -10, z: -10, w: 4, h: 3, d: 4, color: 0xaa4444 },     // 红色
            { x: 15, z: -15, w: 6, h: 2, d: 2, color: 0x4444aa },      // 蓝色
            { x: -15, z: 15, w: 2, h: 2, d: 6, color: 0xaaaa44 },      // 黄色
            { x: 0, z: 20, w: 8, h: 4, d: 2, color: 0x44aaaa },        // 青色
            { x: 0, z: -20, w: 8, h: 4, d: 2, color: 0xaa44aa },       // 紫色
            { x: 20, z: 0, w: 2, h: 4, d: 8, color: 0xdd8844 },        // 橙色
            { x: -20, z: 0, w: 2, h: 4, d: 8, color: 0x8844dd },       // 紫罗兰
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

        // 添加一些装饰性的柱子
        const pillarPositions = [
            { x: 25, z: 25 },
            { x: -25, z: 25 },
            { x: 25, z: -25 },
            { x: -25, z: -25 },
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
        // 渐变天空盒
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        // 创建渐变
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#0a0a1a');      // 深蓝黑（顶部）
        gradient.addColorStop(0.3, '#1a1a3a');    // 深蓝紫
        gradient.addColorStop(0.6, '#2a2a4a');    // 蓝紫
        gradient.addColorStop(1, '#1a1a2e');      // 深紫蓝（地平线）

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 添加星星效果
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
        const skyMat = new THREE.MeshBasicMaterial({
            map: texture,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
    }

    createPlayer(id, position, isBot = false) {
        // 玩家颜色
        const bodyColor = isBot ? 0xff6644 : 0x44aaff;
        const headColor = isBot ? 0xff4422 : 0x2288ff;
        
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: bodyColor,
            roughness: 0.5,
            metalness: 0.3
        });
        
        const headMaterial = new THREE.MeshStandardMaterial({
            color: headColor,
            roughness: 0.3,
            metalness: 0.5
        });

        // 身体 - 更立体的胶囊形状
        const bodyGroup = new THREE.Group();
        
        // 躯干
        const torsoGeometry = new THREE.CylinderGeometry(0.35, 0.4, 1.2, 8);
        const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
        torso.position.y = 0.8;
        bodyGroup.add(torso);

        // 腿部
        const legGeometry = new THREE.CylinderGeometry(0.15, 0.12, 0.6, 6);
        const leftLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        leftLeg.position.set(-0.15, 0.3, 0);
        bodyGroup.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeometry, bodyMaterial);
        rightLeg.position.set(0.15, 0.3, 0);
        bodyGroup.add(rightLeg);

        // 头部
        const headGeometry = new THREE.SphereGeometry(0.28, 16, 16);
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.6;
        bodyGroup.add(head);

        // 眼睛（机器人特征）
        if (isBot) {
            const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
            const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            leftEye.position.set(-0.1, 1.65, 0.22);
            bodyGroup.add(leftEye);
            
            const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
            rightEye.position.set(0.1, 1.65, 0.22);
            bodyGroup.add(rightEye);
        }

        // 设置位置
        bodyGroup.position.set(position.x || 0, 0, position.z || 0);
        bodyGroup.castShadow = true;
        bodyGroup.children.forEach(child => {
            child.castShadow = true;
        });

        this.scene.add(bodyGroup);
        this.players.set(id, bodyGroup);

        return bodyGroup;
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

    addProjectile(from, to) {
        const geometry = new THREE.SphereGeometry(0.05, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(geometry, material);

        bullet.position.set(from.x, from.y, from.z);
        this.scene.add(bullet);

        const direction = new THREE.Vector3(
            to.x - from.x,
            to.y - from.y,
            to.z - from.z
        ).normalize();

        this.projectiles.push({
            mesh: bullet,
            direction,
            distance: 0,
            maxDistance: 100
        });
    }

    update() {
        // 更新弹道
        const speed = 2;
        this.projectiles = this.projectiles.filter(p => {
            p.mesh.position.add(p.direction.clone().multiplyScalar(speed));
            p.distance += speed;

            if (p.distance >= p.maxDistance) {
                this.scene.remove(p.mesh);
                return false;
            }
            return true;
        });
    }

    render() {
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
