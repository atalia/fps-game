import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalWindow = global.window
const originalTHREE = global.THREE
const originalGetContext = HTMLCanvasElement.prototype.getContext

function createMockMesh() {
  return {
    position: { set: vi.fn(), x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
    scale: { set: vi.fn() },
    add: vi.fn(),
    remove: vi.fn(),
    castShadow: false,
    receiveShadow: false,
    userData: {}
  }
}

function createCanvasContextMock() {
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(1024 * 1024 * 4) })),
    putImageData: vi.fn()
  }
}

function createThreeMock() {
  class MockScene {
    constructor() {
      this.add = vi.fn()
      this.remove = vi.fn()
      this.fog = null
    }
  }

  class MockPerspectiveCamera {
    constructor() {
      this.position = { set: vi.fn(), x: 0, y: 0, z: 0 }
      this.rotation = { x: 0, y: 0, z: 0 }
      this.aspect = 1
      this.lookAt = vi.fn()
      this.updateProjectionMatrix = vi.fn()
    }
  }

  class MockWebGLRenderer {
    constructor() {
      this.domElement = document.createElement('canvas')
      this.shadowMap = { enabled: false, type: null }
      this.setSize = vi.fn()
      this.setPixelRatio = vi.fn()
      this.render = vi.fn()
      this.dispose = vi.fn()
    }
  }

  class MockClock {
    getDelta() {
      return 0.016
    }
  }

  class MockColor {
    constructor(value) {
      this.value = value
    }
    setHSL() {}
    copy() { return this }
    lerp() { return this }
  }

  class MockVector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x
      this.y = y
      this.z = z
    }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this }
    copy(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this }
    clone() { return new MockVector3(this.x, this.y, this.z) }
    add(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this }
    subVectors(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this }
    multiplyScalar(s) { this.x *= s; this.y *= s; this.z *= s; return this }
    normalize() { return this }
    lerpVectors(a, b) { this.x = (a.x + b.x) / 2; this.y = (a.y + b.y) / 2; this.z = (a.z + b.z) / 2; return this }
  }

  return {
    Scene: MockScene,
    PerspectiveCamera: MockPerspectiveCamera,
    WebGLRenderer: MockWebGLRenderer,
    Clock: MockClock,
    AmbientLight: class { constructor() {} },
    DirectionalLight: class { constructor() { this.position = { set: vi.fn() }; this.shadow = { mapSize: {}, camera: {} } } },
    HemisphereLight: class { constructor() {} },
    PointLight: class { constructor() { this.position = { set: vi.fn() } } },
    FogExp2: class { constructor() {} },
    PlaneGeometry: class { constructor() {} },
    BoxGeometry: class { constructor() {} },
    SphereGeometry: class { constructor() {} },
    CylinderGeometry: class { constructor() {} },
    CapsuleGeometry: class { constructor() {} },
    EdgesGeometry: class { constructor() {} },
    LineBasicMaterial: class { constructor() {} },
    LineSegments: class { constructor() { return createMockMesh() } },
    MeshStandardMaterial: class { constructor() {} },
    MeshToonMaterial: class { constructor() {} },
    MeshBasicMaterial: class { constructor() {} },
    ShaderMaterial: class { constructor() {} },
    CanvasTexture: class { constructor() { this.wrapS = null; this.wrapT = null; this.repeat = { set: vi.fn() } } },
    Mesh: class { constructor() { return createMockMesh() } },
    Group: class { constructor() { return createMockMesh() } },
    Color: MockColor,
    Vector3: MockVector3,
    RepeatWrapping: 'RepeatWrapping',
    PCFSoftShadowMap: 'PCFSoftShadowMap',
    ACESFilmicToneMapping: 'ACESFilmicToneMapping',
    sRGBEncoding: 'sRGBEncoding'
  }
}

async function loadRenderer() {
  vi.resetModules()

  document.body.innerHTML = '<div id="game-container"></div>'

  HTMLCanvasElement.prototype.getContext = vi.fn(() => createCanvasContextMock())

  global.window = {
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    __FPS_RENDERER_TEST_MODE__: true
  }

  global.THREE = createThreeMock()

  const mod = await import('../js/renderer.js')
  return mod.default || window.Renderer
}

describe('Renderer', () => {
  let Renderer

  beforeEach(async () => {
    Renderer = await loadRenderer()
  })

  afterEach(() => {
    global.window = originalWindow
    global.THREE = originalTHREE
    HTMLCanvasElement.prototype.getContext = originalGetContext
  })

  it('constructs against the real module and attaches a canvas to the container', () => {
    const renderer = new Renderer('game-container')
    const container = document.getElementById('game-container')

    expect(renderer.container).toBe(container)
    expect(container.querySelector('canvas')).not.toBeNull()
    expect(renderer.players).toBeInstanceOf(Map)
  })

  it('tracks players through add/update/remove flow', () => {
    const renderer = new Renderer('game-container')

    renderer.addPlayer('p1', { x: 1, y: 2, z: 3 }, false)
    expect(renderer.players.has('p1')).toBe(true)

    renderer.updatePlayer('p1', { x: 4, y: 5, z: 6 }, 0.75)
    const player = renderer.players.get('p1')
    expect(player).toBeTruthy()

    renderer.removePlayer('p1')
    expect(renderer.players.has('p1')).toBe(false)
  })

  it('renders without invoking a second update pass', () => {
    const renderer = new Renderer('game-container')
    const updateSpy = vi.spyOn(renderer, 'update')

    renderer.render()

    expect(updateSpy).not.toHaveBeenCalled()
    expect(renderer.renderer.render).toHaveBeenCalledWith(renderer.scene, renderer.camera)
  })

  it('removes the resize listener when disposed', () => {
    const renderer = new Renderer('game-container')

    renderer.dispose()

    expect(window.removeEventListener).toHaveBeenCalledWith('resize', expect.any(Function))
    expect(renderer.renderer.dispose).toHaveBeenCalled()
  })
})
