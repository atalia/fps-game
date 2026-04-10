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
});
