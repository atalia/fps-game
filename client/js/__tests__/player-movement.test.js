// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const playerCode = readFileSync(new URL("../player.js", import.meta.url), "utf8");

function loadPlayerController(window, document) {
  const fn = new Function("window", "document", playerCode);
  fn(window, document);
  return window.PlayerController;
}

describe("Player movement direction", () => {
  it("W movement aligns with the default camera/shoot forward direction", () => {
    const dom = new JSDOM(`<!doctype html><body></body>`);
    const { window } = dom;
    const { document } = window;
    window.roundState = { can_move: true };

    const PlayerController = loadPlayerController(window, document);
    const player = new PlayerController();
    player.position = { x: 0, y: 0, z: 0 };
    player.rotation = 0;
    player.keys["KeyW"] = true;

    const before = { ...player.position };
    const { position } = player.update();

    expect(position.z).toBeLessThan(before.z);
    expect(position.x).toBe(before.x);

    player.destroy();
  });

  it("S movement goes opposite to the default camera/shoot forward direction", () => {
    const dom = new JSDOM(`<!doctype html><body></body>`);
    const { window } = dom;
    const { document } = window;
    window.roundState = { can_move: true };

    const PlayerController = loadPlayerController(window, document);
    const player = new PlayerController();
    player.position = { x: 0, y: 0, z: 0 };
    player.rotation = 0;
    player.keys["KeyS"] = true;

    const before = { ...player.position };
    const { position } = player.update();

    expect(position.z).toBeGreaterThan(before.z);
    expect(position.x).toBe(before.x);

    player.destroy();
  });

  it("W movement still aligns with shoot forward after turning right", () => {
    const dom = new JSDOM(`<!doctype html><body></body>`);
    const { window } = dom;
    const { document } = window;
    window.roundState = { can_move: true };

    const PlayerController = loadPlayerController(window, document);
    const player = new PlayerController();
    player.position = { x: 0, y: 0, z: 0 };
    player.rotation = Math.PI / 2;
    player.keys["KeyW"] = true;

    const before = { ...player.position };
    const { position } = player.update();

    // rotation = PI/2 时，shoot direction 的 forward x 应为负方向
    expect(position.x).toBeLessThan(before.x);
    expect(position.z).toBeCloseTo(before.z, 5);

    player.destroy();
  });
});
