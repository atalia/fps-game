import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

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
    MeshStandardMaterial,
    MeshToonMaterial: MeshStandardMaterial,
    MeshBasicMaterial,
    CapsuleGeometry,
    SphereGeometry,
    CylinderGeometry,
    BoxGeometry,
    TorusGeometry,
  };
}

function loadCharacterKit() {
  const context = {
    window: {},
    THREE: createThreeMock(),
    console,
  };
  const fn = new Function("window", "THREE", "console", characterKitCode);
  fn(context.window, context.THREE, context.console);
  return context.window.CharacterKit;
}

function findPart(root, partName) {
  return root.children.find((child) => child.userData?.part === partName) || null;
}

describe("CharacterKit", () => {
  it("applies a semi-realistic tactical silhouette with restrained CT/T accents", () => {
    const CharacterKit = loadCharacterKit();
    const kit = new CharacterKit({});

    const ct = kit.buildPlayer({ team: "ct", isBot: false });
    const t = kit.buildPlayer({ team: "t", isBot: true });

    expect(ct.userData.visualProfile).toBe("semi-realistic-tactical");
    expect(ct.userData.teamAccent).not.toBe(t.userData.teamAccent);
    expect(ct.children.length).toBeGreaterThan(4);
  });

  it("adds layered tactical gear breakup without whole-body team recolors", () => {
    const CharacterKit = loadCharacterKit();
    const kit = new CharacterKit({});
    const ct = kit.buildPlayer({ team: "ct", isBot: false });

    const parts = ct.children.map((child) => child.userData?.part).filter(Boolean);

    expect(parts).toContain("chest-rig");
    expect(parts).toContain("belt");
    expect(parts).toContain("thigh-rig-left");
    expect(parts).toContain("back-panel");
    expect(parts).not.toContain("full-body-team-shell");
  });

  it("separates cloth, armor, gear, and accent material families", () => {
    const CharacterKit = loadCharacterKit();
    const kit = new CharacterKit({});
    const ct = kit.buildPlayer({ team: "ct", isBot: false });

    const torso = findPart(ct, "torso");
    const chestRig = findPart(ct, "chest-rig");
    const belt = findPart(ct, "belt");
    const accent = findPart(ct, "team-accent-left");

    expect(torso.material.options.color).not.toBe(chestRig.material.options.color);
    expect(chestRig.material.options.color).not.toBe(belt.material.options.color);
    expect(chestRig.material.options.roughness).toBeLessThan(torso.material.options.roughness);
    expect(accent.material.options.emissiveIntensity).toBeLessThanOrEqual(0.08);
  });
});
