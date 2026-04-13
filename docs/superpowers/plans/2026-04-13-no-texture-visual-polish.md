# No-Texture Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the FPS game's map and character presentation into a cleaner light-realistic tactical style without external textures, while keeping mid-range performance and combat readability intact.

**Architecture:** Keep the existing `Renderer -> MapEnhanced / CharacterKit` runtime shape, and push most visual detail into focused presentation modules instead of bloating renderer orchestration. Build vertically in small TDD slices: map silhouette first, then character silhouette, then procedural material polish, then lighting/post-processing tuning, and finally browser verification plus docs updates.

**Tech Stack:** Three.js r128 globals, browser-side JavaScript modules loaded via `index.html`, Vitest, existing renderer/map test doubles, Git.

---

## File Structure

### Runtime files to modify
- Modify: `client/js/effects/map-enhanced.js` — stronger structural composition, reusable trim/support helpers, procedural ground/wall surface breakup, lightweight collision-safe module layering.
- Modify: `client/js/assets/character-kit.js` — improved tactical silhouette breakup, extra gear layers, restrained team-identity pieces, simplified material separation.
- Modify: `client/js/renderer.js` — updated light profile, local functional-light placement, post-processing tuning, orchestration of the new map/character presentation contracts.

### Test files to modify
- Modify: `client/js/__tests__/map-enhanced-visual.test.js` — verify upgraded structure categories, multi-part cover/core modules, and collision-safe boundary composition remain intact.
- Modify: `client/js/__tests__/character-kit.test.js` — verify stronger layered tactical silhouette and restrained CT/T cues.
- Modify: `client/js/__tests__/player-visuals.test.js` — verify rendered player shells use the upgraded parts and preserve readability.
- Modify: `client/js/__tests__/renderer.test.js` — verify updated tactical lighting profile and renderer integration contracts.

### Docs to modify at the end
- Modify: `README.md` — note the no-texture visual-polish pass and current visual direction.
- Modify: `docs/ARCHITECTURE.md` — describe the structure-first presentation approach and where map/character/light responsibilities live.

### Manual validation targets
- Local browser/runtime via the normal client flow.
- Deployed browser check at `http://101.33.117.73:8080` after the branch is deployed, per workspace rules.

---

## Chunk 1: Map and character presentation uplift

### Task 1: Strengthen map silhouettes so the arena stops reading like white-box geometry

**Files:**
- Modify: `client/js/effects/map-enhanced.js`
- Test: `client/js/__tests__/map-enhanced-visual.test.js`

- [ ] **Step 1: Write the failing map-structure regression test** using @test-driven-development

```javascript
it("builds layered cover and center structures instead of single primitive masses", () => {
  const added = [];
  const scene = { add(object) { added.push(object); } };
  const renderer = { scene, environmentKit: new EnvironmentKit({ scene }) };
  const map = new MapEnhanced(renderer);

  map.createCompetitiveArena();

  const coverParts = added.filter((item) => item?.userData?.category === "cover");
  const structureParts = added.filter((item) => item?.userData?.category === "structure");
  const trimParts = added.filter((item) => item?.userData?.category === "trim");

  expect(coverParts.length).toBeGreaterThanOrEqual(6);
  expect(structureParts.length).toBeGreaterThanOrEqual(6);
  expect(trimParts.length).toBeGreaterThanOrEqual(4);
});
```

- [ ] **Step 2: Run the map visual test to confirm the new expectation fails**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/map-enhanced-visual.test.js --reporter=verbose --no-color`
Expected: FAIL because current arena composition is not yet layered enough for the new structure thresholds.

- [ ] **Step 3: Add focused map-building helpers in `map-enhanced.js`**

Implement only the helpers needed for this slice, for example:
- `createTrimBand(...)`
- `createInsetPanel(...)`
- `createSupportFoot(...)`
- `createSegmentedBoundaryWall(...)`
- `createRaisedCoverCluster(...)`

Keep each helper focused on one visual job.

- [ ] **Step 4: Upgrade arena assembly with those helpers**

Change `createCompetitiveArena()` so it:
- turns central masses into base + frame + trim compositions
- makes cover clusters read as tactical obstacles instead of single boxes
- adds segmented rhythm to long walls
- keeps movement lanes and collision footprints readable

Do **not** add clutter props in this task.

- [ ] **Step 5: Re-run the same map visual test and confirm it passes**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/map-enhanced-visual.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 6: Commit the map silhouette slice**

```bash
git -C /home/node/projects/fps-game add client/js/effects/map-enhanced.js client/js/__tests__/map-enhanced-visual.test.js
git -C /home/node/projects/fps-game commit -m "feat: strengthen tactical arena silhouettes"
```

### Task 2: Upgrade character silhouettes so players stop looking like placeholders

**Files:**
- Modify: `client/js/assets/character-kit.js`
- Test: `client/js/__tests__/character-kit.test.js`
- Test: `client/js/__tests__/player-visuals.test.js`

- [ ] **Step 1: Write the failing character silhouette regression test** using @test-driven-development

```javascript
it("adds layered tactical gear breakup without whole-body team recolors", () => {
  const kit = new CharacterKit({});
  const ct = kit.buildPlayer({ team: "ct", isBot: false });

  const parts = ct.children.map((child) => child.userData?.part).filter(Boolean);

  expect(parts).toContain("chest-rig");
  expect(parts).toContain("belt");
  expect(parts).toContain("thigh-rig-left");
  expect(parts).toContain("back-panel");
  expect(parts).not.toContain("full-body-team-shell");
});
```

- [ ] **Step 2: Run the character-focused tests to confirm failure**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/character-kit.test.js js/__tests__/player-visuals.test.js --reporter=verbose --no-color`
Expected: FAIL because the new part expectations do not exist yet.

- [ ] **Step 3: Extend `character-kit.js` with low-cost silhouette layers**

Add only the minimal new pieces needed to sell the operator silhouette, for example:
- belt / waist layer
- back panel or hydration-pack block
- thigh rigs or shin guards
- restrained shoulder or chest markers
- slightly better helmet/headgear breakup

Keep CT/T differences restrained and part-based.

- [ ] **Step 4: Update the player-visual regression assertions if needed**

Make `player-visuals.test.js` assert the stronger layered silhouette still preserves readable accents instead of flat body recolors.

- [ ] **Step 5: Re-run the character-focused tests and confirm they pass**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/character-kit.test.js js/__tests__/player-visuals.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 6: Commit the character silhouette slice**

```bash
git -C /home/node/projects/fps-game add client/js/assets/character-kit.js client/js/__tests__/character-kit.test.js client/js/__tests__/player-visuals.test.js
git -C /home/node/projects/fps-game commit -m "feat: deepen tactical player silhouettes"
```

### Task 3: Add procedural material breakup without relying on texture assets

**Files:**
- Modify: `client/js/effects/map-enhanced.js`
- Modify: `client/js/assets/character-kit.js`
- Test: `client/js/__tests__/map-enhanced-visual.test.js`
- Test: `client/js/__tests__/character-kit.test.js`

- [ ] **Step 1: Write a failing procedural-material regression test**

```javascript
it("assigns distinct tactical material families for ground, structure, trim, cover, and accents", () => {
  const map = new MapEnhanced({ scene: { add() {} } });

  const ground = map.createMaterial("ground");
  const structure = map.createMaterial("structure");
  const trim = map.createMaterial("trim");
  const cover = map.createMaterial("cover");

  expect(ground.options.roughness).not.toBe(structure.options.roughness);
  expect(trim.options.metalness).toBeGreaterThan(structure.options.metalness);
  expect(cover.options.color).not.toBe(structure.options.color);
});
```

- [ ] **Step 2: Run the targeted material tests and confirm failure**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/map-enhanced-visual.test.js js/__tests__/character-kit.test.js --reporter=verbose --no-color`
Expected: FAIL if the new material-family expectations are not yet met.

- [ ] **Step 3: Upgrade map-side procedural material treatment**

In `map-enhanced.js`:
- deepen ground zoning with cleaner bands and tactical markings
- add restrained procedural line work or panels where useful
- widen the value/roughness split between cover, trim, boundary, and structure
- keep noise low enough that silhouettes stay clean

- [ ] **Step 4: Upgrade character-side material separation**

In `character-kit.js`:
- split body / cloth / armor / gear / accent more clearly
- keep emissive accents minimal
- keep team identity tied to small structured accents only

- [ ] **Step 5: Re-run the targeted material tests and confirm they pass**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/map-enhanced-visual.test.js js/__tests__/character-kit.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 6: Commit the material-polish slice**

```bash
git -C /home/node/projects/fps-game add client/js/effects/map-enhanced.js client/js/assets/character-kit.js client/js/__tests__/map-enhanced-visual.test.js client/js/__tests__/character-kit.test.js
git -C /home/node/projects/fps-game commit -m "feat: add no-texture tactical material polish"
```

---

## Chunk 2: Lighting, verification, and documentation

### Task 4: Rebalance renderer lighting and post-processing for clean tactical readability

**Files:**
- Modify: `client/js/renderer.js`
- Modify: `client/js/effects/map-enhanced.js`
- Test: `client/js/__tests__/renderer.test.js`

- [ ] **Step 1: Write the failing renderer-light profile test** using @test-driven-development

```javascript
it("tracks a clean tactical lighting profile with restrained post-processing", () => {
  const renderer = new Renderer("game-container");

  expect(renderer.tacticalLightingProfile.postProcessingLevel).toBe("medium");
  expect(renderer.tacticalLightingProfile.localFunctionalLights).toBeGreaterThanOrEqual(4);
  expect(renderer.postProcessingProfile.bloomStrength).toBeLessThanOrEqual(0.35);
  expect(renderer.tacticalLightingProfile.readabilityGuardrails).toContain("cover-definition");
});
```

- [ ] **Step 2: Run the renderer test and confirm failure**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/renderer.test.js --reporter=verbose --no-color`
Expected: FAIL if the updated lighting/profile contract is not yet reflected.

- [ ] **Step 3: Implement the minimal lighting rebalance**

In `renderer.js`:
- rebalance ambient/fill/directional strengths for cleaner form definition
- keep local lights purposeful and limited
- keep bloom/contrast restrained
- keep profile metadata updated for regression tests

In `map-enhanced.js`:
- adjust functional-light anchors only if needed to support the new profile

- [ ] **Step 4: Re-run the renderer test and confirm it passes**

Run: `cd /home/node/projects/fps-game/client && npm test -- --run js/__tests__/renderer.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 5: Commit the lighting slice**

```bash
git -C /home/node/projects/fps-game add client/js/renderer.js client/js/effects/map-enhanced.js client/js/__tests__/renderer.test.js
git -C /home/node/projects/fps-game commit -m "feat: rebalance no-texture tactical lighting"
```

### Task 5: Run full verification and perform browser validation

**Files:**
- Modify: none unless fixes are required
- Test: existing client test suite

- [ ] **Step 1: Run the full client suite** using @verification-before-completion

Run: `cd /home/node/projects/fps-game/client && npm test -- --run`
Expected: PASS, with all client tests green.

- [ ] **Step 2: If any tests fail, fix one root cause at a time and re-run the exact failing command**

Do not bundle unrelated cleanup into this step.

- [ ] **Step 3: Start the app in the normal validation environment**

Run the repo’s normal local or deployed flow that exposes the FPS client. If deployment is part of the current workflow, deploy the branch build before the browser check.

- [ ] **Step 4: Validate in browser with the required front-end checks**

Confirm all of the following manually:
- enter the game with a player name
- quick join works
- add a bot
- movement and shooting still work
- no obvious JS console errors
- map no longer reads like plain white boxes
- cover clusters, center structure, and player models all look more finished

If available, capture a screenshot of the upgraded scene for review.

- [ ] **Step 5: Commit only if fixes were needed during verification**

```bash
git -C /home/node/projects/fps-game add <files-fixed-during-verification>
git -C /home/node/projects/fps-game commit -m "fix: address no-texture polish verification issues"
```

### Task 6: Document the new presentation direction

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Update README with the current visual direction**

Add a short section that explains:
- the game now uses a no-texture light-realistic tactical visual pass
- presentation quality currently comes from modular geometry, procedural material breakup, and restrained lighting
- external texture assets are intentionally deferred

- [ ] **Step 2: Update architecture docs with clear module ownership**

Document:
- `MapEnhanced` owns map-side presentation composition
- `CharacterKit` owns player silhouette composition
- `Renderer` owns orchestration plus lighting/post-processing profile

- [ ] **Step 3: Run a quick doc sanity check**

Run: `git -C /home/node/projects/fps-game diff -- README.md docs/ARCHITECTURE.md`
Expected: concise, accurate documentation with no placeholder wording.

- [ ] **Step 4: Commit the docs update**

```bash
git -C /home/node/projects/fps-game add README.md docs/ARCHITECTURE.md
git -C /home/node/projects/fps-game commit -m "docs: record no-texture visual polish architecture"
```

---

## Final verification checklist

- [ ] `client/js/effects/map-enhanced.js` produces layered cover, center, wall, and floor presentation without cluttering combat readability.
- [ ] `client/js/assets/character-kit.js` produces stronger tactical silhouettes with restrained CT/T cues.
- [ ] `client/js/renderer.js` keeps the lighting and post-processing profile readable and medium-strength.
- [ ] `cd /home/node/projects/fps-game/client && npm test -- --run` passes.
- [ ] Browser validation confirms the arena and characters look materially less like placeholders.
- [ ] README and architecture docs describe the new no-texture presentation direction accurately.

Plan complete and saved to `docs/superpowers/plans/2026-04-13-no-texture-visual-polish.md`. Ready to execute?
