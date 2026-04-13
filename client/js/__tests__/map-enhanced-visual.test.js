import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const mapCode = readFileSync(`${__dirname}/../effects/map-enhanced.js`, "utf8");
const environmentKitCode = readFileSync(
  `${__dirname}/../assets/environment-kit.js`,
  "utf8",
);

function createThreeMock() {
  class MockObject3D {
    constructor() {
      this.children = [];
      this.userData = {};
      this.rotation = { x: 0, y: 0, z: 0 };
      this.position = {
        x: 0,
        y: 0,
        z: 0,
        set: (x, y, z) => {
          this.position.x = x;
          this.position.y = y;
          this.position.z = z;
        },
      };
    }

    add(child) {
      this.children.push(child);
    }
  }

  class Mesh extends MockObject3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }

  class Group extends MockObject3D {}
  class MeshToonMaterial {
    constructor(options = {}) {
      this.options = options;
    }
  }
  class MeshStandardMaterial {
    constructor(options = {}) {
      this.options = options;
    }
  }
  class MeshBasicMaterial {
    constructor(options = {}) {
      this.options = options;
    }
  }
  class BoxGeometry {
    constructor(...args) {
      this.args = args;
    }
  }
  class CylinderGeometry {
    constructor(...args) {
      this.args = args;
    }
  }
  class PlaneGeometry {
    constructor(...args) {
      this.args = args;
      this.attributes = {
        position: {
          count: 0,
          getX() {
            return 0;
          },
          getY() {
            return 0;
          },
          setZ() {},
        },
      };
    }
    computeVertexNormals() {}
  }
  class CanvasTexture {
    constructor(canvas) {
      this.canvas = canvas;
      this.repeat = { set() {} };
    }
  }

  return {
    Mesh,
    Group,
    MeshToonMaterial,
    MeshStandardMaterial,
    MeshBasicMaterial,
    BoxGeometry,
    CylinderGeometry,
    PlaneGeometry,
    CanvasTexture,
    RepeatWrapping: "RepeatWrapping",
  };
}

function createDocumentMock() {
  return {
    createElement(type) {
      if (type !== "canvas") {
        throw new Error(`Unexpected element type: ${type}`);
      }
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillStyle: "",
            strokeStyle: "",
            lineWidth: 0,
            fillRect() {},
            beginPath() {},
            moveTo() {},
            lineTo() {},
            stroke() {},
            createRadialGradient() {
              return { addColorStop() {} };
            },
            getImageData() {
              return { data: new Uint8ClampedArray(4) };
            },
            putImageData() {},
          };
        },
      };
    },
  };
}

function loadMapEnhanced() {
  const context = {
    window: {},
    document: createDocumentMock(),
    console,
    THREE: createThreeMock(),
  };
  const environmentKitFn = new Function(
    "window",
    "THREE",
    "console",
    environmentKitCode,
  );
  environmentKitFn(context.window, context.THREE, context.console);
  const fn = new Function("window", "document", "THREE", "console", mapCode);
  fn(context.window, context.document, context.THREE, context.console);
  return {
    MapEnhanced: context.window.MapEnhanced,
    EnvironmentKit: context.window.EnvironmentKit,
  };
}

const { MapEnhanced, EnvironmentKit } = loadMapEnhanced();

describe("MapEnhanced competitive scene kit", () => {
  it("builds a modular arena with structural categories instead of loose boxes", () => {
    const added = [];
    const scene = {
      add(object) {
        added.push(object);
      },
    };
    const renderer = { scene };
    renderer.environmentKit = new EnvironmentKit(renderer);
    const map = new MapEnhanced(renderer);

    const summary = map.createCompetitiveArena();
    const categories = new Set(
      added.map((item) => item?.userData?.category).filter(Boolean),
    );
    const zones = new Set(added.map((item) => item?.userData?.zone).filter(Boolean));

    expect(summary.style).toBe("competitive-light-realistic");
    expect(summary.modules).toBeGreaterThanOrEqual(10);
    expect(categories.has("structure")).toBe(true);
    expect(categories.has("cover")).toBe(true);
    expect(categories.has("accent")).toBe(true);
    expect(categories.has("boundary")).toBe(true);
    expect(zones.has("mid-lane")).toBe(true);
    expect(zones.has("spawn-ct")).toBe(true);
    expect(zones.has("spawn-t")).toBe(true);
  });

  it("does not duplicate north or south boundary walls when environment kit provides them", () => {
    const added = [];
    const scene = {
      add(object) {
        added.push(object);
      },
    };
    const renderer = { scene };
    renderer.environmentKit = new EnvironmentKit(renderer);
    const map = new MapEnhanced(renderer);

    map.createCompetitiveArena();

    const northLikeBoundaries = added.filter(
      (item) =>
        item?.userData?.category === "boundary" &&
        item?.position?.z < -60,
    );
    const southLikeBoundaries = added.filter(
      (item) =>
        item?.userData?.category === "boundary" &&
        item?.position?.z > 60,
    );

    expect(northLikeBoundaries).toHaveLength(1);
    expect(southLikeBoundaries).toHaveLength(1);
  });

  it("builds layered cover and center structures instead of single primitive masses", () => {
    const added = [];
    const scene = {
      add(object) {
        added.push(object);
      },
    };
    const renderer = { scene };
    renderer.environmentKit = new EnvironmentKit(renderer);
    const map = new MapEnhanced(renderer);

    map.createCompetitiveArena();

    const coverParts = added.filter((item) => item?.userData?.category === "cover");
    const structureParts = added.filter((item) => item?.userData?.category === "structure");
    const trimParts = added.filter((item) => item?.userData?.category === "trim");
    const boundaryParts = added.filter((item) => item?.userData?.category === "boundary");

    expect(coverParts.length).toBeGreaterThanOrEqual(10);
    expect(structureParts.length).toBeGreaterThanOrEqual(12);
    expect(trimParts.length).toBeGreaterThanOrEqual(10);
    expect(boundaryParts.length).toBeGreaterThanOrEqual(6);
  });

  it("assigns restrained no-texture material families across arena surfaces", () => {
    const map = new MapEnhanced({ scene: { add() {} } });

    const ground = map.createMaterial("ground");
    const structure = map.createMaterial("structure");
    const cover = map.createMaterial("cover");
    const trim = map.createMaterial("trim");
    const accent = map.createMaterial("accent");
    const boundary = map.createMaterial("boundary");

    expect(ground.options.roughness).toBeGreaterThan(0.9);
    expect(structure.options.roughness).toBeLessThan(0.76);
    expect(cover.options.roughness).toBeGreaterThan(structure.options.roughness);
    expect(trim.options.metalness).toBeGreaterThanOrEqual(0.42);
    expect(accent.options.emissiveIntensity).toBeLessThanOrEqual(0.18);
    expect(boundary.options.roughness).toBeGreaterThan(structure.options.roughness);
  });
});
