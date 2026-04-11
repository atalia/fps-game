// client/js/effects/map-enhanced.js
// 轻写实竞技风地图模块化渲染系统

console.log('[MAP] map-enhanced.js loading...')

class MapEnhanced {
    constructor(renderer) {
        this.renderer = renderer
        this.scene = renderer.scene
        this.decorations = []
        this.details = []
        this.structures = []
    }

    createMaterial(kind, overrides = {}) {
        const presets = {
            ground: { color: 0x2f343d, roughness: 0.95, metalness: 0.02 },
            structure: { color: 0x6b7280, roughness: 0.82, metalness: 0.08 },
            cover: { color: 0x4b5563, roughness: 0.78, metalness: 0.12 },
            trim: { color: 0x9aa4b2, roughness: 0.55, metalness: 0.35 },
            accent: { color: 0x3b82f6, roughness: 0.35, metalness: 0.55, emissive: 0x15233d, emissiveIntensity: 0.35 },
            boundary: { color: 0x374151, roughness: 0.88, metalness: 0.1 },
            prop: { color: 0x7c5d3c, roughness: 0.86, metalness: 0.06 },
        }

        const MaterialCtor = THREE.MeshStandardMaterial || THREE.MeshToonMaterial || THREE.MeshBasicMaterial
        return new MaterialCtor({ ...(presets[kind] || presets.structure), ...overrides })
    }

    tagMesh(mesh, category, variant = '', zone = 'peripheral') {
        mesh.userData = {
            ...(mesh.userData || {}),
            category,
            variant,
            zone,
            visualProfile: 'semi-realistic-tactical',
        }
        this.structures.push(mesh)
        return mesh
    }

    createGround(size = 150, theme = 'competitive') {
        console.log('[MAP] Creating competitive ground, size:', size, 'theme:', theme)

        const canvas = document.createElement('canvas')
        canvas.width = 2048
        canvas.height = 2048
        const ctx = canvas.getContext('2d')

        ctx.fillStyle = '#2b3139'
        ctx.fillRect(0, 0, 2048, 2048)

        ctx.fillStyle = '#343c47'
        ctx.fillRect(260, 0, 1528, 2048)
        ctx.fillRect(0, 260, 2048, 1528)

        ctx.fillStyle = '#262b33'
        ctx.fillRect(760, 760, 528, 528)

        ctx.strokeStyle = '#505b6a'
        ctx.lineWidth = 6
        for (let i = 0; i <= 2048; i += 256) {
            ctx.beginPath()
            ctx.moveTo(i, 0)
            ctx.lineTo(i, 2048)
            ctx.stroke()
            ctx.beginPath()
            ctx.moveTo(0, i)
            ctx.lineTo(2048, i)
            ctx.stroke()
        }

        ctx.strokeStyle = '#7a8698'
        ctx.lineWidth = 10
        ctx.strokeRect(350, 350, 1348, 1348)

        ctx.fillStyle = 'rgba(32, 95, 184, 0.22)'
        ctx.fillRect(120, 840, 300, 360)
        ctx.fillStyle = 'rgba(161, 84, 46, 0.22)'
        ctx.fillRect(1628, 840, 300, 360)

        ctx.strokeStyle = 'rgba(180, 195, 214, 0.35)'
        ctx.lineWidth = 14
        ctx.strokeRect(872, 872, 304, 304)

        const imageData = ctx.getImageData(0, 0, 2048, 2048)
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 10
            imageData.data[i] = Math.max(0, Math.min(255, imageData.data[i] + noise))
            imageData.data[i + 1] = Math.max(0, Math.min(255, imageData.data[i + 1] + noise))
            imageData.data[i + 2] = Math.max(0, Math.min(255, imageData.data[i + 2] + noise))
        }
        ctx.putImageData(imageData, 0, 0)

        const texture = new THREE.CanvasTexture(canvas)
        texture.wrapS = THREE.RepeatWrapping
        texture.wrapT = THREE.RepeatWrapping
        if (texture.repeat?.set) {
            texture.repeat.set(3, 3)
        }

        const geometry = new THREE.PlaneGeometry(size, size, 100, 100)
        const positions = geometry.attributes?.position
        if (positions && typeof positions.count === 'number') {
            for (let i = 0; i < positions.count; i++) {
                const x = positions.getX(i)
                const y = positions.getY(i)
                positions.setZ(i, Math.sin(x * 0.045) * Math.cos(y * 0.04) * 0.18)
            }
            geometry.computeVertexNormals?.()
        }

        const material = this.createMaterial('ground', {
            map: texture,
            envMapIntensity: 0.18,
        })

        const ground = new THREE.Mesh(geometry, material)
        ground.rotation.x = -Math.PI / 2
        ground.receiveShadow = true
        this.tagMesh(ground, 'ground', 'arena-floor', 'arena-floor')
        this.scene.add(ground)

        this.ground = ground
        return ground
    }

    createModule(x, y, z, w, h, d, kind, variant = '', materialOverrides = {}) {
        const geometry = new THREE.BoxGeometry(w, h, d)
        const mesh = new THREE.Mesh(geometry, this.createMaterial(kind, materialOverrides))
        mesh.position.set(x, y, z)
        mesh.castShadow = true
        mesh.receiveShadow = true
        this.tagMesh(mesh, kind, variant)
        this.scene.add(mesh)
        return mesh
    }

    createAccentStrip(parent, y, width, depth, color) {
        const strip = new THREE.Mesh(
            new THREE.BoxGeometry(width, 0.08, depth),
            this.createMaterial('accent', { color, emissive: color, emissiveIntensity: 0.28 }),
        )
        strip.position.set(0, y, 0)
        strip.userData = { ...(strip.userData || {}), category: 'accent', part: 'light-strip' }
        parent.add(strip)
        return strip
    }

    createColumn(x, z, height = 5.2) {
        const column = new THREE.Mesh(
            new THREE.CylinderGeometry(0.85, 1, height, 10),
            this.createMaterial('structure', { color: 0x767f8c }),
        )
        column.position.set(x, height / 2, z)
        column.castShadow = true
        column.receiveShadow = true
        this.tagMesh(column, 'structure', 'column')
        this.scene.add(column)

        const cap = new THREE.Mesh(
            new THREE.BoxGeometry(2.2, 0.28, 2.2),
            this.createMaterial('trim', { color: 0xb6c0cd }),
        )
        cap.position.set(0, height / 2 - 0.35, 0)
        cap.userData = { ...(cap.userData || {}), category: 'trim', part: 'column-cap' }
        column.add(cap)
        return column
    }

    createCoverCluster(x, z, rotation = 0, accentColor = 0x4f87ff) {
        const group = new THREE.Group()
        group.position.set(x, 0, z)
        group.rotation.y = rotation
        group.userData = {
            category: 'cover',
            variant: 'cluster',
            visualProfile: 'competitive-light-realistic',
        }
        this.scene.add(group)
        this.structures.push(group)

        const core = new THREE.Mesh(
            new THREE.BoxGeometry(5.4, 2.4, 1.8),
            this.createMaterial('cover', { color: 0x525b68 }),
        )
        core.position.y = 1.2
        core.castShadow = true
        core.receiveShadow = true
        core.userData = { category: 'cover', part: 'core' }
        group.add(core)

        const side = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 1.7, 3.6),
            this.createMaterial('cover', { color: 0x626d7b }),
        )
        side.position.set(2.1, 0.85, 0)
        side.userData = { category: 'cover', part: 'wing' }
        side.castShadow = true
        side.receiveShadow = true
        group.add(side)

        const mirrorSide = new THREE.Mesh(
            new THREE.BoxGeometry(1.4, 1.7, 3.6),
            this.createMaterial('cover', { color: 0x626d7b }),
        )
        mirrorSide.position.set(-2.1, 0.85, 0)
        mirrorSide.userData = { category: 'cover', part: 'wing' }
        mirrorSide.castShadow = true
        mirrorSide.receiveShadow = true
        group.add(mirrorSide)

        this.createAccentStrip(core, 0.7, 4.2, 0.18, accentColor)
        return group
    }

    createBoundaryWall(x, z, w, h, d, variant = 'wall') {
        return this.createModule(x, h / 2, z, w, h, d, 'boundary', variant, { color: 0x3b4450 })
    }

    createBounds(minX, maxX, minZ, maxZ, height = 8) {
        const wallThickness = 2.4
        this.createBoundaryWall(0, minZ - wallThickness / 2, maxX - minX, height, wallThickness, 'north')
        this.createBoundaryWall(0, maxZ + wallThickness / 2, maxX - minX, height, wallThickness, 'south')
        this.createBoundaryWall(minX - wallThickness / 2, 0, wallThickness, height, maxZ - minZ, 'west')
        this.createBoundaryWall(maxX + wallThickness / 2, 0, wallThickness, height, maxZ - minZ, 'east')
    }

    getFunctionalLightAnchors() {
        return [
            { x: -48, z: 0, color: 0x60a5fa, intensity: 0.65, height: 5.5, zone: 'spawn-ct' },
            { x: 48, z: 0, color: 0xf59e0b, intensity: 0.65, height: 5.5, zone: 'spawn-t' },
            { x: 0, z: 28, color: 0xcbd5e1, intensity: 0.3, height: 6.5, zone: 'lane-north' },
            { x: 0, z: -28, color: 0xcbd5e1, intensity: 0.3, height: 6.5, zone: 'lane-south' },
        ]
    }

    createCompetitiveArena() {
        const summary = {
            style: 'competitive-light-realistic',
            modules: 0,
        }

        if (this.renderer.environmentKit?.buildCoreZones) {
            const coreZones = this.renderer.environmentKit.buildCoreZones()
            coreZones.forEach((item) => this.structures.push(item))
            summary.modules += coreZones.length
        }

        const centralBase = this.createModule(0, 2.2, 0, 18, 4.4, 18, 'structure', 'central-core', { color: 0x707987 })
        centralBase.userData.zone = 'mid-lane'
        this.createAccentStrip(centralBase, 1.45, 11.5, 0.2, 0x8fb4ff)

        const upperFrame = this.createModule(0, 4.75, 0, 14, 0.4, 14, 'trim', 'upper-frame', { color: 0xc7d0db })
        upperFrame.userData.zone = 'mid-lane'
        summary.modules += 2

        const trims = [
            [0, 3.9, 28, 18, 0.18, 0.4, 'trim', 'north-trim', 'mid-lane'],
            [0, 3.9, -28, 18, 0.18, 0.4, 'trim', 'south-trim', 'mid-lane'],
            [28, 3.9, 0, 0.4, 0.18, 18, 'trim', 'east-trim', 'mid-lane'],
            [-28, 3.9, 0, 0.4, 0.18, 18, 'trim', 'west-trim', 'mid-lane'],
        ]
        trims.forEach(([x, y, z, w, h, d, kind, variant, zone]) => {
            const trim = this.createModule(x, y, z, w, h, d, kind, variant, { color: 0xb8c2cf })
            trim.userData.zone = zone
            summary.modules += 1
        })

        const coverClusters = [
            [22, -22, -Math.PI / 4, 0xf59e0b, 'flank-east'],
            [-22, -22, Math.PI / 4, 0xf59e0b, 'flank-west'],
            [0, 38, 0, 0x93c5fd, 'spawn-ct'],
            [0, -38, 0, 0xfbbf24, 'spawn-t'],
            [38, 0, Math.PI / 2, 0x93c5fd, 'lane-east'],
            [-38, 0, Math.PI / 2, 0xfbbf24, 'lane-west'],
        ]
        coverClusters.forEach(([x, z, rotation, accentColor, zone]) => {
            const cluster = this.createCoverCluster(x, z, rotation, accentColor)
            cluster.userData.zone = zone
            summary.modules += 1
        })

        ;[
            [16, 16],
            [-16, 16],
            [16, -16],
            [-16, -16],
        ].forEach(([x, z]) => {
            const column = this.createColumn(x, z)
            column.userData.zone = 'mid-lane'
            summary.modules += 1
        })

        this.createBounds(-70, 70, -70, 70, 10)
        summary.modules += 4

        return summary
    }

    createDecoration(x, z, type = 'crate') {
        let mesh
        if (type === 'crate') {
            mesh = new THREE.Mesh(
                new THREE.BoxGeometry(1.2, 1.2, 1.2),
                this.createMaterial('prop', { color: 0x7c6551 }),
            )
            mesh.position.set(x, 0.6, z)
        } else {
            mesh = new THREE.Mesh(
                new THREE.CylinderGeometry(0.55, 0.55, 1.4, 10),
                this.createMaterial('prop', { color: 0x4b5563 }),
            )
            mesh.position.set(x, 0.7, z)
        }

        mesh.castShadow = true
        mesh.receiveShadow = true
        this.tagMesh(mesh, 'prop', type)
        this.scene.add(mesh)
        this.decorations.push(mesh)
        return mesh
    }

    generateDecorations(count = 16, bounds) {
        const { minX, maxX, minZ, maxZ } = bounds
        const points = []
        for (let i = 0; i < count; i++) {
            const x = minX + ((i * 37) % 100) / 100 * (maxX - minX)
            const z = minZ + ((i * 53) % 100) / 100 * (maxZ - minZ)
            if (Math.abs(x) < 12 && Math.abs(z) < 12) continue
            if (Math.abs(x) < 30 && Math.abs(z) < 30) continue
            points.push([x, z])
        }

        points.slice(0, count).forEach(([x, z], index) => {
            this.createDecoration(x, z, index % 2 === 0 ? 'crate' : 'barrel')
        })

        return this.decorations
    }

    clear() {
        ;[...this.decorations, ...this.structures].forEach((item) => {
            this.scene.remove?.(item)
            item.geometry?.dispose?.()
            if (Array.isArray(item.material)) {
                item.material.forEach((mat) => mat?.dispose?.())
            } else {
                item.material?.dispose?.()
            }
        })
        this.decorations = []
        this.structures = []
        if (this.ground) {
            this.scene.remove?.(this.ground)
            this.ground = null
        }
    }
}

window.MapEnhanced = MapEnhanced
console.log('[MAP] MapEnhanced exported')
