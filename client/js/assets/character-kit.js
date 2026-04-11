// client/js/assets/character-kit.js
// 半写实战术风角色资产套件

console.log("[CHAR-KIT] character-kit.js loading...");

class CharacterKit {
  constructor(renderer, options = {}) {
    this.renderer = renderer;
    this.visualProfile = "semi-realistic-tactical";
    this.options = options;
  }

  createMaterial(options = {}) {
    const MaterialCtor =
      THREE.MeshStandardMaterial ||
      THREE.MeshToonMaterial ||
      THREE.MeshBasicMaterial;
    return new MaterialCtor(options);
  }

  buildPlayer({ team = "", isBot = false }) {
    const normalizedTeam = String(team || "").toLowerCase();
    const isCT = normalizedTeam === "ct";
    const isT = normalizedTeam === "t";

    const bodyColor = isCT
      ? 0x505a68
      : isT
        ? 0x655348
        : isBot
          ? 0x666d76
          : 0x626a73;
    const headColor = isCT ? 0xd6c5b5 : isT ? 0xcaa07e : 0xd6b998;
    const gearColor = isCT ? 0x2f3945 : isT ? 0x3d2c25 : 0x3b4048;
    const accentColor = isCT ? 0x5fa8ff : isT ? 0xf5a623 : 0xa3a3a3;

    const bodyMaterial = this.createMaterial({
      color: bodyColor,
      roughness: 0.8,
      metalness: 0.08,
    });
    const headMaterial = this.createMaterial({
      color: headColor,
      roughness: 0.92,
      metalness: 0.02,
    });
    const gearMaterial = this.createMaterial({
      color: gearColor,
      roughness: 0.7,
      metalness: 0.18,
    });
    const accentMaterial = this.createMaterial({
      color: accentColor,
      roughness: 0.42,
      metalness: 0.28,
      emissive: accentColor,
      emissiveIntensity: 0.12,
    });

    const bodyGroup = new THREE.Group();
    bodyGroup.userData = {
      isBot,
      team: normalizedTeam,
      visualProfile: this.visualProfile,
      teamAccent: accentColor,
    };

    const addPart = (partName, mesh) => {
      mesh.userData = {
        ...(mesh.userData || {}),
        part: partName,
      };
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      bodyGroup.add(mesh);
      return mesh;
    };

    const torsoGeometry =
      typeof THREE.CapsuleGeometry === "function"
        ? new THREE.CapsuleGeometry(0.28, 0.82, 8, 16)
        : new THREE.CylinderGeometry(0.3, 0.34, 1.3, 12);
    const torso = new THREE.Mesh(torsoGeometry, bodyMaterial);
    torso.position.y = 1.02;
    addPart("torso", torso);

    const chestRig = new THREE.Mesh(
      new THREE.BoxGeometry(0.82, 0.56, 0.36),
      gearMaterial,
    );
    chestRig.position.set(0, 1.04, 0.12);
    addPart("chest-rig", chestRig);

    const pelvis = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.3, 0.3),
      gearMaterial,
    );
    pelvis.position.set(0, 0.36, 0);
    addPart("pelvis", pelvis);

    const leftShoulder = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      gearMaterial,
    );
    leftShoulder.position.set(-0.42, 1.18, 0);
    addPart("shoulder-left", leftShoulder);

    const rightShoulder = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.24, 0.24),
      gearMaterial,
    );
    rightShoulder.position.set(0.42, 1.18, 0);
    addPart("shoulder-right", rightShoulder);

    const leftAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.34, 0.1),
      accentMaterial,
    );
    leftAccent.position.set(-0.44, 1.02, 0.22);
    addPart("team-accent-left", leftAccent);

    const rightAccent = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.34, 0.1),
      accentMaterial,
    );
    rightAccent.position.set(0.44, 1.02, 0.22);
    addPart("team-accent-right", rightAccent);

    const leftLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.9, 0.24),
      bodyMaterial,
    );
    leftLeg.position.set(-0.16, -0.18, 0);
    addPart("leg-left", leftLeg);

    const rightLeg = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.9, 0.24),
      bodyMaterial,
    );
    rightLeg.position.set(0.16, -0.18, 0);
    addPart("leg-right", rightLeg);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 16, 16),
      headMaterial,
    );
    head.position.y = 1.72;
    addPart("head", head);

    const helmet = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.28, 0.18, 12),
      gearMaterial,
    );
    helmet.position.y = 1.95;
    addPart(isCT ? "helmet" : "headgear", helmet);

    if (isCT) {
      const visor = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.08, 0.08),
        accentMaterial,
      );
      visor.position.set(0, 1.72, 0.24);
      addPart("visor", visor);
    }

    if (isT) {
      const bandana = new THREE.Mesh(
        new THREE.TorusGeometry(0.22, 0.04, 8, 16),
        accentMaterial,
      );
      bandana.rotation.x = Math.PI / 2;
      bandana.position.y = 1.83;
      addPart("bandana", bandana);
    }

    const eyeGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const eyeMaterial = new THREE.MeshBasicMaterial({
      color: isBot ? 0xff0000 : 0x000000,
    });

    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.09, 1.75, 0.21);
    addPart("eye-left", leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.09, 1.75, 0.21);
    addPart("eye-right", rightEye);

    if (isBot) {
      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8),
        new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      );
      antenna.position.set(0, 2.15, 0);
      addPart("antenna", antenna);

      const antennaBall = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xff0000 }),
      );
      antennaBall.position.set(0, 2.32, 0);
      addPart("antenna-tip", antennaBall);
    }

    return bodyGroup;
  }
}

window.CharacterKit = CharacterKit;
console.log("[CHAR-KIT] CharacterKit exported");
