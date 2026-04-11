import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
  class MeshStandardMaterial {
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

  return {
    Mesh,
    Group,
    MeshStandardMaterial,
    MeshToonMaterial: MeshStandardMaterial,
    MeshBasicMaterial: MeshStandardMaterial,
    BoxGeometry,
    CylinderGeometry,
  };
}

function loadEnvironmentKit() {
  const context = {
    window: {},
    THREE: createThreeMock(),
    console,
  };
  const fn = new Function("window", "THREE", "console", environmentKitCode);
  fn(context.window, context.THREE, context.console);
  return context.window.EnvironmentKit;
}

describe("EnvironmentKit", () => {
  it("assembles imported tactical structures for core combat zones", () => {
    const EnvironmentKit = loadEnvironmentKit();
    const renderer = {
      scene: {
        add() {},
      },
    };
    const kit = new EnvironmentKit(renderer);

    const sceneObjects = kit.buildCoreZones();

    expect(sceneObjects.some((obj) => obj.userData.zone === "mid-lane")).toBe(true);
    expect(sceneObjects.some((obj) => obj.userData.category === "cover")).toBe(true);
    expect(sceneObjects.some((obj) => obj.userData.category === "boundary")).toBe(true);
    expect(
      sceneObjects.every(
        (obj) => obj.userData.visualProfile === "semi-realistic-tactical",
      ),
    ).toBe(true);
  });
});
