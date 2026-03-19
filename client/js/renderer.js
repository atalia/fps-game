// renderer.js - Three.js 3D 渲染器
class Renderer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
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
        this.renderer.setClearColor(0x87ceeb); // 天空蓝
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);

        // 相机位置
        this.camera.position.set(0, 2, 5);

        // 光照
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // 创建地面
        this.createGround();

        // 创建简单的地图
        this.createMap();

        // 创建天空盒
        this.createSkybox();

        // 窗口大小调整
        window.addEventListener('resize', () => this.onResize());
    }

    createGround() {
        const geometry = new THREE.PlaneGeometry(100, 100);
        const material = new THREE.MeshStandardMaterial({
            color: 0x3d3d3d,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // 网格线
        const gridHelper = new THREE.GridHelper(100, 50, 0x555555, 0x333333);
        this.scene.add(gridHelper);
    }

    createMap() {
        // 创建一些简单的障碍物
        const obstacles = [
            { x: 10, z: 10, w: 4, h: 3, d: 4 },
            { x: -10, z: -10, w: 4, h: 3, d: 4 },
            { x: 15, z: -15, w: 6, h: 2, d: 2 },
            { x: -15, z: 15, w: 2, h: 2, d: 6 },
            { x: 0, z: 20, w: 8, h: 4, d: 2 },
            { x: 0, z: -20, w: 8, h: 4, d: 2 },
            { x: 20, z: 0, w: 2, h: 4, d: 8 },
            { x: -20, z: 0, w: 2, h: 4, d: 8 },
        ];

        obstacles.forEach(obs => {
            const geometry = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
            const material = new THREE.MeshStandardMaterial({
                color: 0x666666,
                roughness: 0.5
            });
            const box = new THREE.Mesh(geometry, material);
            box.position.set(obs.x, obs.h / 2, obs.z);
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);
        });
    }

    createSkybox() {
        const skyGeo = new THREE.SphereGeometry(500, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({
            color: 0x87ceeb,
            side: THREE.BackSide
        });
        const sky = new THREE.Mesh(skyGeo, skyMat);
        this.scene.add(sky);
        
        // 初始化完成，启动渲染循环
        this.running = true;
        this.animate();
    }

    animate() {
        if (this.running) {
            this.render();
            requestAnimationFrame(() => this.animate());
        }
    }

    addPlayer(id, position, isLocal = false) {
        // 玩家身体
        const bodyGeometry = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: isLocal ? 0x00ff00 : 0xff0000,
            roughness: 0.5
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);

        // 头部
        const headGeometry = new THREE.SphereGeometry(0.3, 16, 16);
        const head = new THREE.Mesh(headGeometry, bodyMaterial);
        head.position.y = 1.2;

        // 组合
        const playerGroup = new THREE.Group();
        playerGroup.add(body);
        playerGroup.add(head);
        playerGroup.position.set(position.x || 0, position.y || 0, position.z || 0);

        this.scene.add(playerGroup);
        this.players.set(id, playerGroup);

        return playerGroup;
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
            player.position.set(position.x, position.y, position.z);
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
