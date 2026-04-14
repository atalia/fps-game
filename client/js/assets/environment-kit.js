// client/js/assets/environment-kit.js
// 半写实战术风环境资产套件

console.log("[ENV-KIT] environment-kit.js loading...");

class EnvironmentKit {
  constructor(renderer, options = {}) {
    this.renderer = renderer;
    this.scene = renderer.scene;
    this.runtimeAssets = options.runtimeAssets || renderer.runtimeAssets || null;
    this.registry = new Map();
    this.placedStructures = [];
    this.visualProfile = "semi-realistic-tactical";
    this.registerDefaultAssets();
  }

  registerAsset(key, descriptor) {
    this.registry.set(key, {
      key,
      category: "structure",
      zone: "neutral",
      dimensions: { width: 6, height: 3, depth: 2 },
      position: { x: 0, y: 0, z: 0 },
      material: {},
      ...descriptor,
    });
    return this.registry.get(key);
  }

  isCollidableCategory(category) {
    return ["structure", "cover", "boundary"].includes(category);
  }

  createCollisionVolume(descriptor) {
    return {
      assetKey: descriptor.key,
      category: descriptor.category,
      zone: descriptor.zone,
      minX: descriptor.position.x - descriptor.dimensions.width / 2,
      maxX: descriptor.position.x + descriptor.dimensions.width / 2,
      minZ: descriptor.position.z - descriptor.dimensions.depth / 2,
      maxZ: descriptor.position.z + descriptor.dimensions.depth / 2,
    };
  }

  registerDefaultAssets() {
    this.registerAsset("spawn-ct-anchor", {
      category: "accent",
      zone: "spawn-ct",
      dimensions: { width: 7, height: 3.2, depth: 14 },
      position: { x: -52, y: 1.6, z: 0 },
      material: { color: 0x375f9b, emissive: 0x1f3f6f, emissiveIntensity: 0.22 },
    });
    this.registerAsset("spawn-t-anchor", {
      category: "accent",
      zone: "spawn-t",
      dimensions: { width: 7, height: 3.2, depth: 14 },
      position: { x: 52, y: 1.6, z: 0 },
      material: { color: 0x8b5b37, emissive: 0x4a2913, emissiveIntensity: 0.22 },
    });
    this.registerAsset("mid-lane-bulkhead-north", {
      category: "structure",
      zone: "mid-lane",
      dimensions: { width: 20, height: 4.8, depth: 2.2 },
      position: { x: 0, y: 2.4, z: 28 },
      material: { color: 0x646e7d },
    });
    this.registerAsset("mid-lane-bulkhead-south", {
      category: "structure",
      zone: "mid-lane",
      dimensions: { width: 20, height: 4.8, depth: 2.2 },
      position: { x: 0, y: 2.4, z: -28 },
      material: { color: 0x646e7d },
    });
    this.registerAsset("mid-lane-cover-east", {
      category: "cover",
      zone: "mid-lane",
      dimensions: { width: 5.4, height: 2.4, depth: 1.8 },
      position: { x: 22, y: 1.2, z: 22 },
      material: { color: 0x525b68 },
    });
    this.registerAsset("mid-lane-cover-west", {
      category: "cover",
      zone: "mid-lane",
      dimensions: { width: 5.4, height: 2.4, depth: 1.8 },
      position: { x: -22, y: 1.2, z: 22 },
      material: { color: 0x525b68 },
    });
    this.registerAsset("boundary-north", {
      category: "boundary",
      zone: "boundary-ring",
      dimensions: { width: 140, height: 10, depth: 2.4 },
      position: { x: 0, y: 5, z: -71.2 },
      material: { color: 0x3b4450 },
    });
    this.registerAsset("boundary-south", {
      category: "boundary",
      zone: "boundary-ring",
      dimensions: { width: 140, height: 10, depth: 2.4 },
      position: { x: 0, y: 5, z: 71.2 },
      material: { color: 0x3b4450 },
    });
  }

  createMaterial(category, overrides = {}) {
    const presets = {
      structure: { color: 0x6b7280, roughness: 0.82, metalness: 0.08 },
      cover: { color: 0x4b5563, roughness: 0.78, metalness: 0.12 },
      boundary: { color: 0x374151, roughness: 0.88, metalness: 0.1 },
      accent: { color: 0x3b82f6, roughness: 0.35, metalness: 0.55, emissive: 0x15233d, emissiveIntensity: 0.24 },
    };
    const MaterialCtor =
      THREE.MeshStandardMaterial ||
      THREE.MeshToonMaterial ||
      THREE.MeshBasicMaterial;
    return new MaterialCtor({ ...(presets[category] || presets.structure), ...overrides });
  }

  normalizeObject(object, descriptor) {
    object.position.set(
      descriptor.position.x,
      descriptor.position.y,
      descriptor.position.z,
    );
    object.userData = {
      ...(object.userData || {}),
      assetKey: descriptor.key,
      category: descriptor.category,
      zone: descriptor.zone,
      visualProfile: this.visualProfile,
      source: descriptor.source || "fallback",
    };
    object.castShadow = true;
    object.receiveShadow = true;
    return object;
  }

  createFallbackStructure(descriptor) {
    const geometry = new THREE.BoxGeometry(
      descriptor.dimensions.width,
      descriptor.dimensions.height,
      descriptor.dimensions.depth,
    );
    const mesh = new THREE.Mesh(
      geometry,
      this.createMaterial(descriptor.category, descriptor.material),
    );
    return this.normalizeObject(mesh, descriptor);
  }

  placeStructure(key) {
    const descriptor = this.registry.get(key);
    if (!descriptor) {
      throw new Error(`Unknown environment asset: ${key}`);
    }
    const object = this.createFallbackStructure(descriptor);
    this.scene.add?.(object);
    this.placedStructures.push(object);
    return object;
  }

  getCollisionVolumes() {
    return this.placedStructures
      .filter((object) => this.isCollidableCategory(object?.userData?.category))
      .map((object) => this.createCollisionVolume(this.registry.get(object.userData.assetKey)));
  }

  buildCoreZones() {
    this.placedStructures = [];

    const orderedKeys = [
      "spawn-ct-anchor",
      "spawn-t-anchor",
      "mid-lane-bulkhead-north",
      "mid-lane-bulkhead-south",
      "mid-lane-cover-east",
      "mid-lane-cover-west",
      "boundary-north",
      "boundary-south",
    ];

    return orderedKeys.map((key) => this.placeStructure(key));
  }
}

window.EnvironmentKit = EnvironmentKit;
console.log("[ENV-KIT] EnvironmentKit exported");
