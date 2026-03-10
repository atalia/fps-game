// Renderer module - Three.js rendering
class Renderer {
    constructor(container) {
        this.container = container;
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.players = new Map();
        this.bullets = [];
        this.map = null;

        this.init();
    }

    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.fog = new THREE.Fog(0x87CEEB, 50, 200);

        // Camera (First Person)
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 2, 0);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Create map
        this.createMap();

        // Handle resize
        window.addEventListener('resize', () => this.onResize());
    }

    createMap() {
        // Ground
        const groundGeometry = new THREE.PlaneGeometry(200, 200);
        const groundMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x3a5a40,
            roughness: 0.8
        });
        const ground = new THREE.Mesh(groundGeometry, groundMaterial);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        // Create some buildings/obstacles
        const boxGeometry = new THREE.BoxGeometry(5, 5, 5);
        const boxMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });

        const positions = [
            { x: 20, z: 20 },
            { x: -20, z: 20 },
            { x: 20, z: -20 },
            { x: -20, z: -20 },
            { x: 0, z: 30 },
            { x: 0, z: -30 },
            { x: 30, z: 0 },
            { x: -30, z: 0 },
        ];

        positions.forEach(pos => {
            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            box.position.set(pos.x, 2.5, pos.z);
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);
        });

        // Walls
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });
        const wallPositions = [
            { x: 0, y: 2, z: -50, rx: 0 },
            { x: 0, y: 2, z: 50, rx: 0 },
            { x: -50, y: 2, z: 0, rx: Math.PI / 2 },
            { x: 50, y: 2, z: 0, rx: Math.PI / 2 },
        ];

        wallPositions.forEach(pos => {
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(100, 4, 1),
                wallMaterial
            );
            wall.position.set(pos.x, pos.y, pos.z);
            wall.rotation.y = pos.rx;
            this.scene.add(wall);
        });
    }

    addPlayer(id, position = { x: 0, y: 0, z: 0 }, isLocal = false) {
        if (this.players.has(id)) return;

        // Player mesh (simple box for now)
        const geometry = new THREE.BoxGeometry(1, 2, 1);
        const material = new THREE.MeshStandardMaterial({ 
            color: isLocal ? 0x00ff00 : 0xff0000 
        });
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(position.x, position.y + 1, position.z);
        mesh.castShadow = true;
        this.scene.add(mesh);

        this.players.set(id, {
            mesh,
            position,
            rotation: 0
        });

        console.log(`Player ${id} added`);
    }

    removePlayer(id) {
        const player = this.players.get(id);
        if (player) {
            this.scene.remove(player.mesh);
            this.players.delete(id);
            console.log(`Player ${id} removed`);
        }
    }

    updatePlayer(id, position, rotation) {
        const player = this.players.get(id);
        if (player) {
            player.mesh.position.set(position.x, position.y + 1, position.z);
            player.mesh.rotation.y = rotation;
            player.position = position;
            player.rotation = rotation;
        }
    }

    updateCamera(position, rotation) {
        this.camera.position.set(position.x, position.y + 2, position.z);
        this.camera.rotation.y = rotation;
    }

    addBullet(from, to) {
        const geometry = new THREE.SphereGeometry(0.1);
        const material = new THREE.MeshBasicMaterial({ color: 0xffff00 });
        const bullet = new THREE.Mesh(geometry, material);
        bullet.position.set(from.x, from.y + 1.5, from.z);

        // Direction
        const direction = new THREE.Vector3(to.x, to.y, to.z)
            .sub(new THREE.Vector3(from.x, from.y, from.z))
            .normalize();

        this.scene.add(bullet);
        this.bullets.push({ mesh: bullet, direction, life: 100 });
    }

    update() {
        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.mesh.position.add(bullet.direction.clone().multiplyScalar(2));
            bullet.life--;
            
            if (bullet.life <= 0) {
                this.scene.remove(bullet.mesh);
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
