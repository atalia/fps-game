import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const rendererCode = readFileSync(`${__dirname}/../renderer.js`, "utf8");
const characterKitCode = readFileSync(
  `${__dirname}/../assets/character-kit.js`,
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
  const characterKitFn = new Function(
    "window",
    "THREE",
    "console",
    characterKitCode,
  );
  characterKitFn(context.window, context.THREE, context.console);
  const fn = new Function("window", "THREE", "console", rendererCode);
  fn(context.window, context.THREE, context.console);
  return context.window.Renderer;
}

function collectParts(root) {
  const parts = [];
  const visit = (node) => {
    if (node?.userData?.part) {
      parts.push(node.userData.part);
    }
    for (const child of node?.children || []) {
      visit(child);
    }
  };
  visit(root);
  return parts;
}

function findPart(root, partName) {
  let match = null;
  const visit = (node) => {
    if (node?.userData?.part === partName) {
      match = node;
      return;
    }
    for (const child of node?.children || []) {
      if (!match) visit(child);
    }
  };
  visit(root);
  return match;
}

const Renderer = loadRenderer();

describe("Renderer competitive player visuals", () => {
  it("builds a layered silhouette instead of a placeholder body", () => {
    const renderer = Object.create(Renderer.prototype);
    renderer.scene = { add() {} };
    renderer.players = new Map();

    const player = renderer.addPlayer(
      "ct-1",
      { x: 1, y: 1.25, z: 2 },
      { team: "ct" },
    );
    const parts = collectParts(player);

    expect(parts).toEqual(
      expect.arrayContaining([
        "torso",
        "head",
        "chest-rig",
        "pelvis",
        "belt",
        "back-panel",
        "thigh-rig-left",
        "thigh-rig-right",
        "shoulder-left",
        "shoulder-right",
        "leg-left",
        "leg-right",
        "team-accent-left",
        "team-accent-right",
      ]),
    );
    expect(player.userData.visualProfile).toBe("semi-realistic-tactical");
  });

  it("uses restrained team accents instead of painting the whole model", () => {
    const renderer = Object.create(Renderer.prototype);
    renderer.scene = { add() {} };
    renderer.players = new Map();

    const ctPlayer = renderer.addPlayer(
      "ct-2",
      { x: 0, y: 1.25, z: 0 },
      { team: "ct" },
    );
    const tPlayer = renderer.addPlayer(
      "t-2",
      { x: 0, y: 1.25, z: 0 },
      { team: "t" },
    );

    const ctAccent = findPart(ctPlayer, "team-accent-left");
    const tAccent = findPart(tPlayer, "team-accent-left");
    const ctTorso = findPart(ctPlayer, "torso");
    const tTorso = findPart(tPlayer, "torso");

    expect(ctAccent).toBeTruthy();
    expect(tAccent).toBeTruthy();
    expect(ctAccent.material.options.color).not.toBe(tAccent.material.options.color);
    expect(ctTorso.material.options.color).not.toBe(ctAccent.material.options.color);
    expect(tTorso.material.options.color).not.toBe(tAccent.material.options.color);
  });
});
