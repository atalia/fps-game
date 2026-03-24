// renderer.js - Three.js 3D 渲染器（全面优化版）
console.log('[RENDERER] renderer.js loading...');

class Renderer {
    constructor(containerId) {
        console.log('[RENDERER] Constructor called, containerId:', containerId);
        this.container = document.getElementById(containerId);
        console.log('[RENDERER] Container found:', !!this.container);

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });

        this.players = new Map();
        this.projectiles = [];
        this.clock = new THREE.Clock();
        this.time = 0;

        // 动态天空参数
        this.dayNightCycle = true;
        this.dayTime = 0.3; // 0-1, 0.5 = 正午

        // 粒子系统
        this.particles = [];

        // 后处理
        this.composer = null;
        this.bloomPass = null;

        // 增强版地图系统
        this.mapEnhanced = null;

        this.init();
    }

    init() {
        // 高质量渲染器设置
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.0;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.container.appendChild(this.renderer.domElement);

        // 相机位置
        this.camera.position.set(0, 2, 5);

        // 光照系统
        this.setupLighting();

        // 创建地面
        this.createGround();

        // 创建地图
        this.createMap();

        // 初始化增强版地图系统
        if (typeof MapEnhanced !== 'undefined') {
            this.mapEnhanced = new MapEnhanced(this);
            console.log('[RENDERER] MapEnhanced initialized');
        }

        // 创建天空盒
        this.createSkybox();

        // 创建粒子系统
        this.createParticles();

        // 创建环境反射
        this.createEnvironment();

        // 添加雾效
        this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

        // 窗口大小调整
        window.addEventListener('resize', () => this.onResize());

        console.log('[RENDERER] Initialization complete');
    }

    setupLighting() {
        // 环境光 - 动态变化
        this.ambientLight = new THREE.AmbientLight(0x4488ff, 0.2);
        this.scene.add(this.ambientLight);

        // 主光源（太阳）- 支持昼夜循环
        this.sunLight = new THREE.DirectionalLight(0xffeedd, 1.2);
        this.sunLight.position.set(50, 100, 50);
        this.sunLight.castShadow = true;
        this.sunLight.shadow.mapSize.width = 2048;
        this.sunLight.shadow.mapSize.height = 2048;
        this.sunLight.shadow.camera.near = 10;
        this.sunLight.shadow.camera.far = 300;
        this.sunLight.shadow.camera.left = -60;
        this.sunLight.shadow.camera.right = 60;
        this.sunLight.shadow.camera.top = 60;
        this.sunLight.shadow.camera.bottom = -60;
        this.sunLight.shadow.bias = -0.0001;
        this.scene.add(this.sunLight);

        // 月光（夜间）
        this.moonLight = new THREE.DirectionalLight(0x8888ff, 0.3);
        this.moonLight.position.set(-50, 80, -50);
        this.scene.add(this.moonLight);

        // 补光 - 蓝色调
        const fillLight = new THREE.DirectionalLight(0x4488ff, 0.3);
        fillLight.position.set(-30, 50, -30);
        this.scene.add(fillLight);

        // 半球光 - 模拟天空和地面反射
        this.hemisphereLight = new THREE.HemisphereLight(0x4488ff, 0x222233, 0.4);
        this.scene.add(this.hemisphereLight);

        // 点光源 - 增加氛围
        const pointLights = [
            { x: 25, z: 25, color: 0x4488ff, intensity: 0.5 },
            { x: -25, z: 25, color: 0xff8844, intensity: 0.5 },
            { x: 25, z: -25, color: 0x44ff88, intensity: 0.5 },
            { x: -25, z: -25, color: 0xff4488, intensity: 0.5 },
        ];

        pointLights.forEach(light => {
            const pointLight = new THREE.PointLight(light.color, light.intensity, 30);
            pointLight.position.set(light.x, 5, light.z);
            this.scene.add(pointLight);
        });
    }

    createGround() {
        // 使用增强版地图系统
        if (this.mapEnhanced) {
            this.mapEnhanced.createGround(150, 'tech')
            return
        }

        // 后备实现
        const size = 100;

        // 高质量地面纹理
        const canvas = document.createElement('canvas');
        canvas.width = 1024;
        canvas.height = 1024;
        const ctx = canvas.getContext('2d');

        // 基础颜色
        ctx.fillStyle = '#1a1a28';
        ctx.fillRect(0, 0, 1024, 1024);

        // 网格图案
        const gridSize = 64;
        ctx.strokeStyle = '#2a2a3a';
        ctx.lineWidth = 1;

        for (let i = 0; i <= 1024; i += gridSize) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, 1024);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(1024, i);
            ctx.stroke();
        }

        // 添加噪点纹理
        const imageData = ctx.getImageData(0, 0, 1024, 1024);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 20;
            imageData.data[i] += noise;
            imageData.data[i + 1] += noise;
            imageData.data[i + 2] += noise;
        }
        ctx.putImageData(imageData, 0, 0);

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);

        const geometry = new THREE.PlaneGeometry(size, size, 50, 50);
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.85,
            metalness: 0.05,
            envMapIntensity: 0.5
        });

        const ground = new THREE.Mesh(geometry, material);
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);

        this.ground = ground;
    }

    createMap() {
        // 使用增强版地图系统
        if (this.mapEnhanced) {
            // 中心建筑
            this.mapEnhanced.createObstacle(0, 0, 15, 5, 15, 0x555566, { glowEdge: true })

            // 四角掩体
            const corners = [
                { x: 25, z: 25, color: 0x44cc66 },
                { x: -25, z: 25, color: 0xcc4466 },
                { x: 25, z: -25, color: 0x4466cc },
                { x: -25, z: -25, color: 0xcccc44 }
            ]

            corners.forEach(c => {
                this.mapEnhanced.createObstacle(c.x, c.z, 6, 3, 6, c.color, { details: true })
            })

            // 走廊掩体
            const corridors = [
                { x: 35, z: 0, w: 2, h: 4, d: 20, color: 0x444455 },
                { x: -35, z: 0, w: 2, h: 4, d: 20, color: 0x444455 },
                { x: 0, z: 35, w: 20, h: 4, d: 2, color: 0x444455 },
                { x: 0, z: -35, w: 20, h: 4, d: 2, color: 0x444455 }
            ]

            corridors.forEach(c => {
                this.mapEnhanced.createObstacle(c.x, c.z, c.w, c.h, c.d, c.color, { details: false })
            })

            // 生成随机装饰物
            this.mapEnhanced.generateDecorations(40, { minX: -70, maxX: 70, minZ: -70, maxZ: 70 })

            // 创建边界墙
            this.mapEnhanced.createBounds(-70, 70, -70, 70, 10)

            console.log('[RENDERER] Enhanced map created')
            return
        }

        // 后备实现 - 卡通风格障碍物
        const obstacles = [
            { x: 10, z: 10, w: 4, h: 3, d: 4, color: 0x44cc66 },
            { x: -10, z: -10, w: 4, h: 3, d: 4, color: 0xcc4466 },
            { x: 15, z: -15, w: 6, h: 2, d: 2, color: 0x4466cc },
            { x: -15, z: 15, w: 2, h: 2, d: 6, color: 0xcccc44 },
            { x: 0, z: 20, w: 8, h: 4, d: 2, color: 0x44cccc },
            { x: 0, z: -20, w: 8, h: 4, d: 2, color: 0xcc44cc },
            { x: 20, z: 0, w: 2, h: 4, d: 8, color: 0xee8844 },
            { x: -20, z: 0, w: 2, h: 4, d: 8, color: 0x8844ee },
        ];

        obstacles.forEach(obs => {
            const geometry = new THREE.BoxGeometry(obs.w, obs.h, obs.d);
            // 使用 MeshToonMaterial 实现卡通风格
            const material = new THREE.MeshToonMaterial({
                color: obs.color,
            });
            const box = new THREE.Mesh(geometry, material);
            box.position.set(obs.x, obs.h / 2, obs.z);
            box.castShadow = true;
            box.receiveShadow = true;
            this.scene.add(box);

            // 添加发光边缘效果
            const edgeGeometry = new THREE.EdgesGeometry(geometry);
            const edgeMaterial = new THREE.LineBasicMaterial({
                color: obs.color,
                transparent: true,
                opacity: 0.5
            });
            const edges = new THREE.LineSegments(edgeGeometry, edgeMaterial);
            box.add(edges);
        });

        // 装饰性柱子
        const pillarPositions = [
            { x: 25, z: 25 },
            { x: -25, z: 25 },
            { x: 25, z: -25 },
            { x: -25, z: -25 },
        ];

        pillarPositions.forEach(pos => {
            // 柱子主体
            const geometry = new THREE.CylinderGeometry(1, 1.2, 6, 8);
            const material = new THREE.MeshToonMaterial({
                color: 0x666688,
            });
            const pillar = new THREE.Mesh(geometry, material);
            pillar.position.set(pos.x, 3, pos.z);
            pillar.castShadow = true;
            pillar.receiveShadow = true;
            this.scene.add(pillar);

            // 顶部发光球
            const glowGeometry = new THREE.SphereGeometry(0.5, 16, 16);
            const glowMaterial = new THREE.MeshBasicMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.8
            });
            const glowSphere = new THREE.Mesh(glowGeometry, glowMaterial);
            glowSphere.position.set(pos.x, 6.5, pos.z);
            this.scene.add(glowSphere);

            // 点光源
            const light = new THREE.PointLight(0x4488ff, 0.5, 15);
            light.position.set(pos.x, 6.5, pos.z);
            this.scene.add(light);
        });
    }

    createSkybox() {
        // 动态天空着色器
        const skyGeometry = new THREE.SphereGeometry(400, 32, 32);

        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0a2a) },
                bottomColor: { value: new THREE.Color(0x1a1a3a) },
                offset: { value: 33 },
                exponent: { value: 0.6 },
                time: { value: 0 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform float offset;
                uniform float exponent;
                uniform float time;
                varying vec3 vWorldPosition;

                float random(vec2 st) {
                    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
                }

                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    float t = max(pow(max(h, 0.0), exponent), 0.0);
                    vec3 skyColor = mix(bottomColor, topColor, t);

                    // 添加星星
                    vec2 starUV = vWorldPosition.xz * 0.01;
                    float star = step(0.998, random(floor(starUV * 100.0)));
                    float twinkle = sin(time * 2.0 + random(starUV) * 6.28) * 0.5 + 0.5;
                    skyColor += vec3(star * twinkle * (1.0 - t));

                    gl_FragColor = vec4(skyColor, 1.0);
                }
            `,
            side: THREE.BackSide
        });

        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);
    }

    createParticles() {
        // 灰尘粒子
        const dustCount = 200;
        const dustGeometry = new THREE.BufferGeometry();
        const dustPositions = new Float32Array(dustCount * 3);
        const dustSizes = new Float32Array(dustCount);

        for (let i = 0; i < dustCount; i++) {
            dustPositions[i * 3] = (Math.random() - 0.5) * 100;
            dustPositions[i * 3 + 1] = Math.random() * 20;
            dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 100;
            dustSizes[i] = Math.random() * 2 + 0.5;
        }

        dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
        dustGeometry.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1));

        const dustMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            transparent: true,
            opacity: 0.3,
            sizeAttenuation: true
        });

        this.dustParticles = new THREE.Points(dustGeometry, dustMaterial);
        this.scene.add(this.dustParticles);

        // 光斑粒子
        const glowCount = 50;
        const glowGeometry = new THREE.BufferGeometry();
        const glowPositions = new Float32Array(glowCount * 3);

        for (let i = 0; i < glowCount; i++) {
            glowPositions[i * 3] = (Math.random() - 0.5) * 80;
            glowPositions[i * 3 + 1] = Math.random() * 10 + 2;
            glowPositions[i * 3 + 2] = (Math.random() - 0.5) * 80;
        }

        glowGeometry.setAttribute('position', new THREE.BufferAttribute(glowPositions, 3));

        const glowMaterial = new THREE.PointsMaterial({
            color: 0x4488ff,
            size: 0.3,
            transparent: true,
            opacity: 0.6,
            sizeAttenuation: true
        });

        this.glowParticles = new THREE.Points(glowGeometry, glowMaterial);
        this.scene.add(this.glowParticles);
    }

    createEnvironment() {
        // 创建环境贴图
        const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
        const cubeCamera = new THREE.CubeCamera(0.1, 1000, cubeRenderTarget);
        this.scene.add(cubeCamera);

        this.envMap = cubeRenderTarget.texture;
        this.cubeCamera = cubeCamera;
    }

    updateDayNight(deltaTime) {
        if (!this.dayNightCycle) return;

        this.dayTime += deltaTime * 0.01; // 缓慢循环
        if (this.dayTime > 1) this.dayTime = 0;

        // 太阳位置
        const sunAngle = this.dayTime * Math.PI * 2 - Math.PI / 2;
        this.sunLight.position.x = Math.cos(sunAngle) * 100;
        this.sunLight.position.y = Math.sin(sunAngle) * 100;

        // 光照强度随时间变化
        const dayFactor = Math.max(0, Math.sin(this.dayTime * Math.PI));
        this.sunLight.intensity = dayFactor * 1.5;
        this.moonLight.intensity = (1 - dayFactor) * 0.5;
        this.ambientLight.intensity = 0.1 + dayFactor * 0.2;

        // 天空颜色变化
        const nightTop = new THREE.Color(0x050510);
        const nightBottom = new THREE.Color(0x0a0a1a);
        const dayTop = new THREE.Color(0x1a3a6a);
        const dayBottom = new THREE.Color(0x3a5a8a);

        const topColor = new THREE.Color().lerpColors(nightTop, dayTop, dayFactor);
        const bottomColor = new THREE.Color().lerpColors(nightBottom, dayBottom, dayFactor);

        this.sky.material.uniforms.topColor.value = topColor;
        this.sky.material.uniforms.bottomColor.value = bottomColor;
    }

    updateParticles(deltaTime) {
        // 更新灰尘粒子
        if (this.dustParticles) {
            const positions = this.dustParticles.geometry.attributes.position.array;
            for (let i = 0; i < positions.length; i += 3) {
                positions[i] += Math.sin(this.time + i) * 0.01;
                positions[i + 1] += Math.cos(this.time * 0.5 + i) * 0.005;
                positions[i + 2] += Math.cos(this.time + i) * 0.01;

                // 边界检查
                if (positions[i + 1] > 20) positions[i + 1] = 0;
                if (positions[i + 1] < 0) positions[i + 1] = 20;
            }
            this.dustParticles.geometry.attributes.position.needsUpdate = true;
        }

        // 更新光斑粒子
        if (this.glowParticles) {
            this.glowParticles.material.opacity = 0.4 + Math.sin(this.time * 2) * 0.2;
        }
    }

    createPlayer(id, position, isBot = false) {
        // 卡通风格角色
        const bodyColor = isBot ? 0xff5533 : 0x3399ff;
        const headColor = isBot ? 0xffaa88 : 0xffddaa;

        const bodyMaterial = new THREE.MeshToonMaterial({ color: bodyColor });
        const headMaterial = new THREE.MeshToonMaterial({ color: headColor });

        const bodyGroup = new THREE.Group();

        // 大头小身比例（卡通风格）
        // 躯干
        const torsoGeometry = new THREE.CapsuleGeometry(0.35, 0.6, 8, 16);
        const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
        torso.position.y = 0.7;
        torso.castShadow = true;
        bodyGroup.add(torso);

        // 头部（略大）
        const headGeometry = new THREE.SphereGeometry(0.38, 16, 16);
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.y = 1.45;
        head.castShadow = true;
        bodyGroup.add(head);

        // 眼睛
        const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
        const eyeMaterial = new THREE.MeshBasicMaterial({
            color: isBot ? 0xff0000 : 0x000000
        });

        const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        leftEye.position.set(-0.12, 1.5, 0.3);
        bodyGroup.add(leftEye);

        const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
        rightEye.position.set(0.12, 1.5, 0.3);
        bodyGroup.add(rightEye);

        // 机器人天线
        if (isBot) {
            const antennaGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
            const antennaMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
            const antenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
            antenna.position.set(0, 1.85, 0);
            bodyGroup.add(antenna);

            const antennaBall = new THREE.Mesh(
                new THREE.SphereGeometry(0.05, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0xff0000 })
            );
            antennaBall.position.set(0, 2.0, 0);
            bodyGroup.add(antennaBall);
        }

        bodyGroup.position.set(position.x || 0, 0, position.z || 0);
        this.scene.add(bodyGroup);
        this.players.set(id, bodyGroup);

        return bodyGroup;
    }

    // 添加玩家（兼容 main.js 调用）
    addPlayer(id, position, isBot = false) {
        return this.createPlayer(id, position, isBot);
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
        const geometry = new THREE.SphereGeometry(0.08, 8, 8);
        const material = new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.9
        });
        const bullet = new THREE.Mesh(geometry, material);

        bullet.position.set(from.x, from.y, from.z);
        this.scene.add(bullet);

        // 子弹轨迹光效
        const trailGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
        const trailMaterial = new THREE.MeshBasicMaterial({
            color: 0xffaa00,
            transparent: true,
            opacity: 0.5
        });
        const trail = new THREE.Mesh(trailGeometry, trailMaterial);
        bullet.add(trail);

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
    
    // 清除所有其他玩家
    clearPlayers() {
        this.players.forEach((player, id) => {
            this.scene.remove(player);
        });
        this.players.clear();
        console.log('[RENDERER] Cleared all players');
    }
    
    update() {
        const deltaTime = this.clock.getDelta();
        this.time += deltaTime;

        // 更新昼夜循环
        this.updateDayNight(deltaTime);

        // 更新粒子
        this.updateParticles(deltaTime);

        // 更新天空着色器时间
        if (this.sky) {
            this.sky.material.uniforms.time.value = this.time;
        }

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
        this.update();
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
console.log('[RENDERER] renderer.js loaded');
