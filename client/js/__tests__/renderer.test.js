// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rendererCode = readFileSync(new URL("../renderer.js", import.meta.url), "utf8");

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

  class Group extends MockObject3D {}
  class Mesh extends MockObject3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
      this.castShadow = false;
      this.receiveShadow = false;
    }
  }

  class MeshToonMaterial {
    constructor(options = {}) {
      this.options = options;
    }
  }

  class MeshBasicMaterial {
    constructor(options = {}) {
      this.options = options;
    }
  }

  class CapsuleGeometry {
    constructor(...args) {
      this.args = args;
    }
  }

  class SphereGeometry {
    constructor(...args) {
      this.args = args;
    }
  }

  class CylinderGeometry {
    constructor(...args) {
      this.args = args;
    }
  }

  class BoxGeometry {
    constructor(...args) {
      this.args = args;
    }
  }

  class TorusGeometry {
    constructor(...args) {
      this.args = args;
    }
  }

  return {
    Group,
    Mesh,
    MeshToonMaterial,
    MeshBasicMaterial,
    CapsuleGeometry,
    SphereGeometry,
    CylinderGeometry,
    BoxGeometry,
    TorusGeometry,
  };
}

function loadRenderer(threeOverride) {
  const context = {
    window: {},
    console,
    THREE: threeOverride || createThreeMock(),
  };
  const fn = new Function("window", "THREE", "console", rendererCode);
  fn(context.window, context.THREE, context.console);
  return context.window.Renderer;
}

const Renderer = loadRenderer();

describe("Renderer remote player positioning", () => {
  it("preserves server-provided Y when adding a remote player", () => {
    const renderer = Object.create(Renderer.prototype);
    renderer.scene = { add() {} };
    renderer.players = new Map();

    renderer.addPlayer("remote-1", { x: 12, y: 1.25, z: -8 }, false);

    const remote = renderer.players.get("remote-1");
    expect(remote.position.x).toBe(12);
    expect(remote.position.y).toBe(1.25);
    expect(remote.position.z).toBe(-8);
  });

  it("preserves server-provided Y when updating a remote player", () => {
    const renderer = Object.create(Renderer.prototype);
    renderer.scene = { add() {} };
    renderer.players = new Map();

    renderer.addPlayer("remote-2", { x: 0, y: 1.25, z: 0 }, false);
    renderer.updatePlayer("remote-2", { x: 20, y: 1.25, z: 30 }, Math.PI / 2);

    const remote = renderer.players.get("remote-2");
    expect(remote.position.x).toBe(20);
    expect(remote.position.y).toBe(1.25);
    expect(remote.position.z).toBe(30);
    expect(remote.rotation.y).toBe(Math.PI / 2);
  });

  it("falls back when CapsuleGeometry is unavailable", () => {
    const three = createThreeMock();
    delete three.CapsuleGeometry;
    const FallbackRenderer = loadRenderer(three);
    const renderer = Object.create(FallbackRenderer.prototype);
    renderer.scene = { add() {} };
    renderer.players = new Map();

    renderer.addPlayer("remote-3", { x: 5, y: 1.25, z: 6 }, false);

    const remote = renderer.players.get("remote-3");
    expect(remote).toBeTruthy();
    expect(remote.position.y).toBe(1.25);
  });
});
