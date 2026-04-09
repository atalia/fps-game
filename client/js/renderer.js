// renderer.js - Three.js 3D 渲染器（全面优化版）
console.log("[RENDERER] renderer.js loading...");

const REMOTE_PLAYER_INTERPOLATION_MIN_MS = 30;
const REMOTE_PLAYER_INTERPOLATION_MAX_MS = 100;
const REMOTE_PLAYER_DEFAULT_INTERVAL_MS = 50;

function getRendererNowMs() {
  if (window.FrameTiming?.nowMs) {
    return window.FrameTiming.nowMs();
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function cloneRemoteVector(source, fallbackY = 0) {
  return {
    x: Number(source?.x) || 0,
    y: Number(source?.y ?? fallbackY) || 0,
    z: Number(source?.z) || 0,
  };
}

function lerpRemoteVector(from, to, alpha) {
  return {
    x: from.x + (to.x - from.x) * alpha,
    y: from.y + (to.y - from.y) * alpha,
    z: from.z + (to.z - from.z) * alpha,
  };
}

function normalizeAngle(angle) {
  let normalized = Number(angle) || 0;
  while (normalized > Math.PI) normalized -= Math.PI * 2;
  while (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function lerpAngle(from, to, alpha) {
  const start = normalizeAngle(from);
  const end = normalizeAngle(to);
  let delta = end - start;

  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;

  return normalizeAngle(start + delta * alpha);
}

class RemotePlayerState {
  constructor(initialPosition = { x: 0, y: 0, z: 0 }, rotation = 0) {
    this.snapshots = [];
    this.maxExtrapolationMs = REMOTE_PLAYER_INTERPOLATION_MAX_MS;
    this.interpolationDelayMs = REMOTE_PLAYER_DEFAULT_INTERVAL_MS;
    this.lastPose = {
      position: cloneRemoteVector(initialPosition),
      rotation: Number(rotation) || 0,
    };
  }

  pushSnapshot(position, rotation = 0, velocity = null, receivedAt = getRendererNowMs()) {
    const normalizedSnapshot = {
      position: cloneRemoteVector(position),
      rotation: Number(rotation) || 0,
      velocity: cloneRemoteVector(velocity),
      receivedAt,
    };
    const previous = this.snapshots[this.snapshots.length - 1] || null;

    this.snapshots.push(normalizedSnapshot);
    if (this.snapshots.length > 2) {
      this.snapshots.shift();
    }

    if (previous) {
      const intervalMs = normalizedSnapshot.receivedAt - previous.receivedAt;
      if (intervalMs > 0) {
        this.interpolationDelayMs = Math.max(
          REMOTE_PLAYER_INTERPOLATION_MIN_MS,
          Math.min(REMOTE_PLAYER_INTERPOLATION_MAX_MS, intervalMs),
        );
      }
    }

    if (this.snapshots.length === 1) {
      this.lastPose = {
        position: cloneRemoteVector(normalizedSnapshot.position),
        rotation: normalizedSnapshot.rotation,
      };
    }
  }

  getLatestSnapshot() {
    return this.snapshots[this.snapshots.length - 1] || null;
  }

  getStalenessMs(nowMs = getRendererNowMs()) {
    const latest = this.getLatestSnapshot();
    if (!latest) {
      return 0;
    }
    return Math.max(0, nowMs - latest.receivedAt);
  }

  isDegraded(nowMs = getRendererNowMs()) {
    return this.getStalenessMs(nowMs) > this.maxExtrapolationMs;
  }

  sample(nowMs = getRendererNowMs()) {
    const latest = this.getLatestSnapshot();
    if (!latest) {
      return {
        position: cloneRemoteVector(this.lastPose.position),
        rotation: this.lastPose.rotation,
        staleMs: 0,
        degraded: false,
      };
    }

    const previous = this.snapshots[this.snapshots.length - 2] || null;
    const renderAt = nowMs - this.interpolationDelayMs;
    let nextPose = {
      position: cloneRemoteVector(latest.position),
      rotation: latest.rotation,
    };

    if (previous && renderAt <= latest.receivedAt) {
      const intervalMs = Math.max(1, latest.receivedAt - previous.receivedAt);
      const alpha = clamp01((renderAt - previous.receivedAt) / intervalMs);
      nextPose = {
        position: lerpRemoteVector(previous.position, latest.position, alpha),
        rotation: lerpAngle(previous.rotation, latest.rotation, alpha),
      };
    } else {
      const extrapolationMs = Math.max(0, renderAt - latest.receivedAt);
      const cappedExtrapolationMs = Math.min(
        extrapolationMs,
        this.maxExtrapolationMs,
      );
      const seconds = cappedExtrapolationMs / 1000;
      nextPose = {
        position: {
          x: latest.position.x + latest.velocity.x * seconds,
          y: latest.position.y + latest.velocity.y * seconds,
          z: latest.position.z + latest.velocity.z * seconds,
        },
        rotation: latest.rotation,
      };
    }

    this.lastPose = nextPose;
    return {
      ...nextPose,
      staleMs: this.getStalenessMs(nowMs),
      degraded: this.isDegraded(nowMs),
    };
  }
}

class Renderer {
  constructor(containerId) {
    console.log("[RENDERER] Constructor called, containerId:", containerId);
    this.container = document.getElementById(containerId);
    console.log("[RENDERER] Container found:", !!this.container);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });

    this.players = new Map();
    this.remotePlayerStates = new Map();
    this.projectiles = [];
    this.clock = new THREE.Clock();
    this.time = 0;
    this.onResizeHandler = () => this.onResize();

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
    if (typeof MapEnhanced !== "undefined") {
      this.mapEnhanced = new MapEnhanced(this);
      console.log("[RENDERER] MapEnhanced initialized");
    }

    const testMode =
      typeof window !== "undefined" && window.__FPS_RENDERER_TEST_MODE__;

    // 创建天空盒
    if (!testMode) {
      this.createSkybox();
    }

    // 创建粒子系统
    if (!testMode) {
      this.createParticles();
    }

    // 创建环境反射
    if (!testMode) {
      this.createEnvironment();
    }

    // 添加雾效
    this.scene.fog = new THREE.FogExp2(0x1a1a2e, 0.015);

    // 窗口大小调整
    window.addEventListener("resize", this.onResizeHandler);

    console.log("[RENDERER] Initialization complete");
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

    pointLights.forEach((light) => {
      const pointLight = new THREE.PointLight(light.color, light.intensity, 30);
      pointLight.position.set(light.x, 5, light.z);
      this.scene.add(pointLight);
    });
  }

  createGround() {
    // 使用增强版地图系统
    if (this.mapEnhanced) {
      this.mapEnhanced.createGround(150, "tech");
      return;
    }

    // 后备实现
    const size = 100;

    // 高质量地面纹理
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    // 基础颜色
    ctx.fillStyle = "#1a1a28";
    ctx.fillRect(0, 0, 1024, 1024);

    // 网格图案
    const gridSize = 64;
    ctx.strokeStyle = "#2a2a3a";
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
      envMapIntensity: 0.5,
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
      this.mapEnhanced.createObstacle(0, 0, 15, 5, 15, 0x555566, {
        glowEdge: true,
      });

      // 四角掩体
      const corners = [
        { x: 25, z: 25, color: 0x44cc66 },
        { x: -25, z: 25, color: 0xcc4466 },
        { x: 25, z: -25, color: 0x4466cc },
        { x: -25, z: -25, color: 0xcccc44 },
      ];

      corners.forEach((c) => {
        this.mapEnhanced.createObstacle(c.x, c.z, 6, 3, 6, c.color, {
          details: true,
        });
      });

      // 走廊掩体
      const corridors = [
        { x: 35, z: 0, w: 2, h: 4, d: 20, color: 0x444455 },
        { x: -35, z: 0, w: 2, h: 4, d: 20, color: 0x444455 },
        { x: 0, z: 35, w: 20, h: 4, d: 2, color: 0x444455 },
        { x: 0, z: -35, w: 20, h: 4, d: 2, color: 0x444455 },
      ];

      corridors.forEach((c) => {
        this.mapEnhanced.createObstacle(c.x, c.z, c.w, c.h, c.d, c.color, {
          details: false,
        });
      });

      // 生成随机装饰物
      this.mapEnhanced.generateDecorations(40, {
        minX: -70,
        maxX: 70,
        minZ: -70,
        maxZ: 70,
      });

      // 创建边界墙
      this.mapEnhanced.createBounds(-70, 70, -70, 70, 10);

      console.log("[RENDERER] Enhanced map created");
      return;
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

    obstacles.forEach((obs) => {
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
        opacity: 0.5,
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

    pillarPositions.forEach((pos) => {
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
        opacity: 0.8,
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
        time: { value: 0 },
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
      side: THREE.BackSide,
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

    dustGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(dustPositions, 3),
    );
    dustGeometry.setAttribute("size", new THREE.BufferAttribute(dustSizes, 1));

    const dustMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.1,
      transparent: true,
      opacity: 0.3,
      sizeAttenuation: true,
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

    glowGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(glowPositions, 3),
    );

    const glowMaterial = new THREE.PointsMaterial({
      color: 0x4488ff,
      size: 0.3,
      transparent: true,
      opacity: 0.6,
      sizeAttenuation: true,
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
    const bottomColor = new THREE.Color().lerpColors(
      nightBottom,
      dayBottom,
      dayFactor,
    );

    if (this.sky?.material?.uniforms) {
      this.sky.material.uniforms.topColor.value = topColor;
      this.sky.material.uniforms.bottomColor.value = bottomColor;
    }
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

  resolvePlayerOptions(isBotOrOptions = false, teamId = "") {
    if (typeof isBotOrOptions === "object" && isBotOrOptions !== null) {
      return {
        isBot: Boolean(isBotOrOptions.isBot),
        teamId: String(isBotOrOptions.team || teamId || "").toLowerCase(),
      };
    }

    return {
      isBot: Boolean(isBotOrOptions),
      teamId: String(teamId || "").toLowerCase(),
    };
  }

  createPlayer(id, position, isBotOrOptions = false, teamId = "") {
    const { isBot, teamId: resolvedTeam } = this.resolvePlayerOptions(
      isBotOrOptions,
      teamId,
    );
    const normalizedTeam =
      resolvedTeam === "blue"
        ? "ct"
        : resolvedTeam === "red"
          ? "t"
          : resolvedTeam;
    const isCT = normalizedTeam === "ct";
    const isT = normalizedTeam === "t";

    const bodyColor = isCT
      ? 0x2d7dd2
      : isT
        ? 0xbf2f2f
        : isBot
          ? 0xff5533
          : 0x7a7a7a;
    const headColor = isCT ? 0xcad9f1 : isT ? 0xd9b28f : 0xffddaa;
    const accentColor = isCT ? 0x0b1f3a : isT ? 0x4b140f : 0x3a3a3a;

    const bodyMaterial = new THREE.MeshToonMaterial({ color: bodyColor });
    const headMaterial = new THREE.MeshToonMaterial({ color: headColor });
    const accentMaterial = new THREE.MeshToonMaterial({ color: accentColor });

    const bodyGroup = new THREE.Group();

    // 大头小身比例（卡通风格）
    // 躯干
    const TorsoGeometry =
      typeof THREE.CapsuleGeometry === "function"
        ? new THREE.CapsuleGeometry(0.35, 0.6, 8, 16)
        : new THREE.CylinderGeometry(0.35, 0.38, 1.1, 12);
    const torso = new THREE.Mesh(TorsoGeometry, bodyMaterial);
    torso.position.y = 0.7;
    torso.castShadow = true;
    bodyGroup.add(torso);

    // 头部（略大）
    const headGeometry = new THREE.SphereGeometry(0.38, 16, 16);
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.45;
    head.castShadow = true;
    bodyGroup.add(head);

    if (isCT) {
      const helmetGeometry = new THREE.CylinderGeometry(0.34, 0.42, 0.18, 12);
      const helmet = new THREE.Mesh(helmetGeometry, accentMaterial);
      helmet.position.y = 1.72;
      bodyGroup.add(helmet);

      const vestGeometry = new THREE.BoxGeometry(0.8, 0.65, 0.42);
      const vest = new THREE.Mesh(vestGeometry, accentMaterial);
      vest.position.set(0, 0.75, 0);
      bodyGroup.add(vest);
    }

    if (isT) {
      const bandanaGeometry = new THREE.TorusGeometry(0.28, 0.05, 8, 16);
      const bandana = new THREE.Mesh(bandanaGeometry, accentMaterial);
      bandana.rotation.x = Math.PI / 2;
      bandana.position.y = 1.58;
      bodyGroup.add(bandana);

      const harnessGeometry = new THREE.BoxGeometry(0.75, 0.12, 0.42);
      const harness = new THREE.Mesh(harnessGeometry, accentMaterial);
      harness.position.set(0, 0.92, 0.03);
      bodyGroup.add(harness);
    }

    // 眼睛
    const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({
      color: isBot ? 0xff0000 : 0x000000,
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
        new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      );
      antennaBall.position.set(0, 2.0, 0);
      bodyGroup.add(antennaBall);
    }

    bodyGroup.position.set(position.x || 0, position.y ?? 0, position.z || 0);
    bodyGroup.userData = {
      isBot,
      team: normalizedTeam,
    };
    this.scene.add(bodyGroup);
    this.players.set(id, bodyGroup);
    if (!this.remotePlayerStates) {
      this.remotePlayerStates = new Map();
    }
    this.remotePlayerStates.set(id, new RemotePlayerState(position, 0));

    return bodyGroup;
  }

  // 添加玩家（兼容 main.js 调用）
  addPlayer(id, position, isBotOrOptions = false, teamId = "") {
    return this.createPlayer(id, position, isBotOrOptions, teamId);
  }

  removePlayer(id) {
    const player = this.players.get(id);
    if (player) {
      this.scene.remove(player);
      this.players.delete(id);
    }
    if (this.remotePlayerStates) {
      this.remotePlayerStates.delete(id);
    }
  }

  updatePlayer(id, position, rotation, velocity = null) {
    const player = this.players.get(id);
    if (player) {
      if (!this.remotePlayerStates) {
        this.remotePlayerStates = new Map();
      }
      let remoteState = this.remotePlayerStates.get(id);
      if (!remoteState) {
        remoteState = new RemotePlayerState(position, rotation);
        this.remotePlayerStates.set(id, remoteState);
      }
      remoteState.pushSnapshot(position, rotation, velocity);
      // 兼容旧行为：立即设置位置（update() 会用插值覆盖）
      player.position.set(position.x, position.y ?? 0, position.z);
      player.rotation.y = rotation;
    }
  }

  setPlayerTeam(id, teamId, isBot = false) {
    const existing = this.players.get(id);
    if (!existing) return;

    const position = {
      x: existing.position.x,
      y: existing.position.y,
      z: existing.position.z,
    };
    const rotation = existing.rotation.y || 0;

    this.removePlayer(id);
    const recreated = this.createPlayer(id, position, { isBot, team: teamId });
    recreated.rotation.y = rotation;
  }

  updateCamera(position, rotation) {
    this.camera.position.set(position.x, position.y + 1.7, position.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = rotation;
  }

  addProjectile(from, to) {
    const geometry = new THREE.SphereGeometry(0.08, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color: 0xffff00,
      transparent: true,
      opacity: 0.9,
    });
    const bullet = new THREE.Mesh(geometry, material);

    bullet.position.set(from.x, from.y, from.z);
    this.scene.add(bullet);

    // 子弹轨迹光效
    const trailGeometry = new THREE.CylinderGeometry(0.02, 0.02, 0.5, 8);
    const trailMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.5,
    });
    const trail = new THREE.Mesh(trailGeometry, trailMaterial);
    bullet.add(trail);

    const direction = new THREE.Vector3(
      to.x - from.x,
      to.y - from.y,
      to.z - from.z,
    ).normalize();

    this.projectiles.push({
      mesh: bullet,
      direction,
      distance: 0,
      maxDistance: 100,
    });
  }

  // 清除所有其他玩家
  clearPlayers() {
    this.players.forEach((player, id) => {
      this.scene.remove(player);
    });
    this.players.clear();
    this.remotePlayerStates.clear();
    console.log("[RENDERER] Cleared all players");
  }

  updateRemotePlayers(nowMs = getRendererNowMs()) {
    this.remotePlayerStates.forEach((remoteState, id) => {
      const player = this.players.get(id);
      if (!player) {
        return;
      }

      const sampledPose = remoteState.sample(nowMs);
      player.position.set(
        sampledPose.position.x,
        sampledPose.position.y,
        sampledPose.position.z,
      );
      player.rotation.y = sampledPose.rotation;
      player.userData.remoteSync = {
        staleMs: sampledPose.staleMs,
        degraded: sampledPose.degraded,
      };
    });
  }

  getRemoteSyncStatus(nowMs = getRendererNowMs()) {
    let degradedPlayers = 0;
    let maxStalenessMs = 0;

    this.remotePlayerStates.forEach((remoteState) => {
      const staleMs = remoteState.getStalenessMs(nowMs);
      maxStalenessMs = Math.max(maxStalenessMs, staleMs);
      if (remoteState.isDegraded(nowMs)) {
        degradedPlayers += 1;
      }
    });

    return {
      degradedPlayers,
      maxStalenessMs: Math.round(maxStalenessMs),
    };
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

    this.updateRemotePlayers();

    // 更新弹道
    const speed = 2;
    this.projectiles = this.projectiles.filter((p) => {
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
    window.removeEventListener("resize", this.onResizeHandler);
    if (typeof this.renderer.dispose === "function") {
      this.renderer.dispose();
    }
    if (this.container?.contains(this.renderer.domElement)) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

window.RemotePlayerState = RemotePlayerState;
window.Renderer = Renderer;
console.log("[RENDERER] renderer.js loaded");
