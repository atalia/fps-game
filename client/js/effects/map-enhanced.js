// client/js/effects/map-enhanced.js
// 增强版地图渲染系统

console.log('[MAP] map-enhanced.js loading...')

class MapEnhanced {
    constructor(renderer) {
        this.renderer = renderer
        this.scene = renderer.scene
        this.decorations = []
        this.details = []
    }

    // 创建高质量地面
    createGround(size = 150, theme = 'tech') {
        console.log('[MAP] Creating enhanced ground, size:', size, 'theme:', theme)
        
        const canvas = document.createElement('canvas')
        canvas.width = 2048
        canvas.height = 2048
        const ctx = canvas.getContext('2d')
        
        // 主题配色
        const themes = {
            tech: {
                base: '#0a0a14',
                grid: '#1a1a2a',
                accent: '#00ff88',
                glow: '#00aa55'
            },
            desert: {
                base: '#c4a35a',
                grid: '#a08040',
                accent: '#d4b36a',
                glow: '#806020'
            },
            snow: {
                base: '#e8f0f8',
                grid: '#c8d8e8',
                accent: '#f0f8ff',
                glow: '#a8c8e8'
            },
            forest: {
                base: '#1a3a1a',
                grid: '#2a4a2a',
                accent: '#3a5a3a',
                glow: '#1a5a1a'
            }
        }
        
        const colors = themes[theme] || themes.tech
        
        // 基础颜色
        ctx.fillStyle = colors.base
        ctx.fillRect(0, 0, 2048, 2048)
        
        // 添加噪点纹理
        const imageData = ctx.getImageData(0, 0, 2048, 2048)
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 15
            imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise))
            imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise))
            imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise))
        }
        ctx.putImageData(imageData, 0, 0)
        
        // 网格线
        ctx.strokeStyle = colors.grid
        ctx.lineWidth = 2
        
        const gridSize = 128
        for (let i = 0; i <= 2048; i += gridSize) {
            ctx.beginPath()
            ctx.moveTo(i, 0)
            ctx.lineTo(i, 2048)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(0, i)
            ctx.lineTo(2048, i)
            ctx.stroke()
        }
        
        // 边缘渐变（深色边界）
        const gradient = ctx.createRadialGradient(1024, 1024, 512, 1024, 1024, 1448)
        gradient.addColorStop(0, 'transparent')
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.5)')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, 2048, 2048)
        
        const texture = new THREE.CanvasTexture(canvas)
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        texture.repeat.set(3, 3)
        
        const geometry = new THREE.PlaneGeometry(size, size, 100, 100)
        
        // 添加微小起伏
        const positions = geometry.attributes.position
        for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i)
            const y = positions.getY(i)
            positions.setZ(i, Math.sin(x * 0.1) * Math.cos(y * 0.1) * 0.3)
        }
        geometry.computeVertexNormals()
        
        const material = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.8,
            metalness: 0.1,
            envMapIntensity: 0.3
        })
        
        const ground = new THREE.Mesh(geometry, material)
        ground.rotation.x = -Math.PI / 2
        ground.receiveShadow = true
        this.scene.add(ground)
        
        this.ground = ground
        console.log('[MAP] Ground created')
        
        return ground
    }

    // 创建障碍物（增强版）
    createObstacle(x, z, w, h, d, color, options = {}) {
        const {
            style = 'box', // box, cylinder, hexagon
            bevel = true,
            glowEdge = false,
            details = true
        } = options
        
        let geometry
        let mesh
        
        if (style === 'cylinder') {
            geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, 16)
        } else if (style === 'hexagon') {
            geometry = new THREE.CylinderGeometry(w / 2, w / 2, h, 6)
        } else {
            geometry = new THREE.BoxGeometry(w, h, d)
        }
        
        // 卡通材质
        const material = new THREE.MeshToonMaterial({
            color: color,
            emissive: glowEdge ? color : 0x000000,
            emissiveIntensity: glowEdge ? 0.2 : 0
        })
        
        mesh = new THREE.Mesh(geometry, material)
        mesh.position.set(x, h / 2, z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        
        this.scene.add(mesh)
        
        // 添加边缘高亮
        if (bevel && glowEdge) {
            const edgeGeo = new THREE.EdgesGeometry(geometry)
            const edgeMat = new THREE.LineBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.3
            })
            const edges = new THREE.LineSegments(edgeGeo, edgeMat)
            mesh.add(edges)
        }
        
        // 添加顶部装饰
        if (details && Math.random() > 0.5) {
            this.addObstacleDetail(mesh, w, h, d, color)
        }
        
        return mesh
    }

    // 障碍物细节装饰
    addObstacleDetail(parent, w, h, d, baseColor) {
        const detailTypes = ['antenna', 'light', 'vent']
        const type = detailTypes[Math.floor(Math.random() * detailTypes.length)]
        
        if (type === 'antenna') {
            // 天线
            const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, 2)
            const poleMat = new THREE.MeshToonMaterial({ color: 0x333333 })
            const pole = new THREE.Mesh(poleGeo, poleMat)
            pole.position.y = h / 2 + 1
            parent.add(pole)
            
            // 顶部灯
            const lightGeo = new THREE.SphereGeometry(0.2)
            const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 })
            const light = new THREE.Mesh(lightGeo, lightMat)
            light.position.y = h / 2 + 2
            parent.add(light)
        } else if (type === 'light') {
            // 灯条
            const stripGeo = new THREE.BoxGeometry(w * 0.8, 0.2, 0.2)
            const stripMat = new THREE.MeshBasicMaterial({ color: 0x00ffff })
            const strip = new THREE.Mesh(stripGeo, stripMat)
            strip.position.y = h / 2
            parent.add(strip)
        }
    }

    // 创建装饰物
    createDecoration(x, z, type = 'rock') {
        let mesh
        
        if (type === 'rock') {
            const geometry = new THREE.DodecahedronGeometry(Math.random() * 1.5 + 0.5)
            const material = new THREE.MeshStandardMaterial({
                color: 0x555566,
                roughness: 0.9,
                flatShading: true
            })
            mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, 0.5, z)
            mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0)
        } else if (type === 'crate') {
            const geometry = new THREE.BoxGeometry(1, 1, 1)
            const material = new THREE.MeshToonMaterial({ color: 0x8b4513 })
            mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, 0.5, z)
        } else if (type === 'barrel') {
            const geometry = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12)
            const material = new THREE.MeshToonMaterial({ color: 0x4a4a4a })
            mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, 0.6, z)
            
            // 条纹
            const stripeGeo = new THREE.TorusGeometry(0.52, 0.05, 8, 16)
            const stripeMat = new THREE.MeshBasicMaterial({ color: 0xff6600 })
            const stripe = new THREE.Mesh(stripeGeo, stripeMat)
            stripe.rotation.x = Math.PI / 2
            stripe.position.y = 0.3
            mesh.add(stripe)
        } else if (type === 'cone') {
            const geometry = new THREE.ConeGeometry(0.3, 1, 8)
            const material = new THREE.MeshToonMaterial({ color: 0xff6600 })
            mesh = new THREE.Mesh(geometry, material)
            mesh.position.set(x, 0.5, z)
        }
        
        if (mesh) {
            mesh.castShadow = true
            this.scene.add(mesh)
            this.decorations.push(mesh)
        }
        
        return mesh
    }

    // 创建地图边界墙
    createBounds(minX, maxX, minZ, maxZ, height = 8) {
        const wallThickness = 2
        const wallColor = 0x222233
        
        // 北墙
        this.createWall(0, minZ - wallThickness / 2, maxX - minX, height, wallThickness, wallColor)
        // 南墙
        this.createWall(0, maxZ + wallThickness / 2, maxX - minX, height, wallThickness, wallColor)
        // 西墙
        this.createWall(minX - wallThickness / 2, 0, wallThickness, height, maxZ - minZ, wallColor)
        // 东墙
        this.createWall(maxX + wallThickness / 2, 0, wallThickness, height, maxZ - minZ, wallColor)
    }

    createWall(x, z, w, h, d, color) {
        const geometry = new THREE.BoxGeometry(w, h, d)
        const material = new THREE.MeshStandardMaterial({
            color: color,
            roughness: 0.9,
            metalness: 0.1
        })
        const wall = new THREE.Mesh(geometry, material)
        wall.position.set(x, h / 2, z)
        wall.castShadow = true
        wall.receiveShadow = true
        this.scene.add(wall)
        return wall
    }

    // 生成随机装饰
    generateDecorations(count = 30, bounds) {
        const { minX, maxX, minZ, maxZ } = bounds
        const types = ['rock', 'crate', 'barrel', 'cone']
        
        for (let i = 0; i < count; i++) {
            const x = minX + Math.random() * (maxX - minX)
            const z = minZ + Math.random() * (maxZ - minZ)
            const type = types[Math.floor(Math.random() * types.length)]
            
            // 避开中心区域
            if (Math.abs(x) < 10 && Math.abs(z) < 10) continue
            
            this.createDecoration(x, z, type)
        }
        
        console.log('[MAP] Generated', this.decorations.length, 'decorations')
    }

    // 清理
    clear() {
        this.decorations.forEach(d => {
            this.scene.remove(d)
            if (d.geometry) d.geometry.dispose()
            if (d.material) d.material.dispose()
        })
        this.decorations = []
        
        if (this.ground) {
            this.scene.remove(this.ground)
            this.ground = null
        }
    }
}

window.MapEnhanced = MapEnhanced
console.log('[MAP] MapEnhanced exported')
