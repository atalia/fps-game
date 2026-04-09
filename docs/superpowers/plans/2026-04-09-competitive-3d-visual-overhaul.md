# Competitive 3D Visual Overhaul Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the FPS game's scene architecture and player visuals into a light-realistic competitive style, then verify the result with automated tests and live browser checks.

**Architecture:** Keep the current Three.js pipeline, but replace the scene and character visual language with modular systems. Phase 1 work should focus on renderer, modular scene kit generation, and player mesh construction together so buildings, characters, materials, and lighting all converge to one coherent look.

**Tech Stack:** Three.js, browser-side JS modules, Vitest, Go backend unchanged except for deployment/test flow.

---

## File Structure

### Visual systems to modify
- Modify: `client/js/renderer.js` — central rendering, player construction, lighting, materials, and scene composition
- Modify: `client/js/effects/map-enhanced.js` — modular map kit, walls, trims, cover, repeated structural pieces
- Modify: `client/js/game.js` — integration points if player/scene updates need additional runtime sync
- Modify: `client/index.html` — only if new script ordering or style hooks are required

### Tests to extend
- Modify: `client/js/__tests__/renderer.test.js` — renderer/player mesh regression tests
- Create: `client/js/__tests__/map-enhanced-visual.test.js` — modular scene generation regression tests
- Create or modify: `client/js/__tests__/player-visuals.test.js` — player silhouette/team-accent regression tests

### Docs to update
- Modify: `README.md` — update visual feature notes if user-visible presentation changes are significant
- Modify: `docs/ARCHITECTURE.md` — refresh renderer/scene notes if architecture changes materially

---

## Chunk 1: Baseline and test harness

### Task 1: Lock renderer visual expectations with tests

**Files:**
- Modify: `client/js/__tests__/renderer.test.js`
- Create: `client/js/__tests__/player-visuals.test.js`

- [ ] **Step 1: Write failing tests for competitive player silhouette expectations**

Cover at least:
- player meshes expose distinct torso/head/accent layers
- CT/T variants resolve to different accent colors without changing identity wiring
- player root still registers under the same renderer player map IDs

- [ ] **Step 2: Run the new renderer/player tests to verify they fail**

Run: `cd client && npm test -- --run js/__tests__/renderer.test.js js/__tests__/player-visuals.test.js --reporter=verbose --no-color`
Expected: FAIL because the current player mesh composition is too primitive or the new assertions are not yet satisfied.

- [ ] **Step 3: Add a scene-kit test for modular buildings**

Create a test that exercises `MapEnhanced` and asserts the scene contains multiple structural categories, not just simple obstacle boxes.

- [ ] **Step 4: Run the scene-kit test to verify it fails**

Run: `cd client && npm test -- --run js/__tests__/map-enhanced-visual.test.js --reporter=verbose --no-color`
Expected: FAIL because the current scene kit does not yet expose the richer structure contract.

- [ ] **Step 5: Commit baseline failing-test scaffolding after implementation is complete for this task**

Commit message: `test: lock competitive visual renderer expectations`

## Chunk 2: Scene architecture overhaul

### Task 2: Rebuild the environment into a modular competitive scene kit

**Files:**
- Modify: `client/js/effects/map-enhanced.js`
- Modify: `client/js/renderer.js`
- Test: `client/js/__tests__/map-enhanced-visual.test.js`

- [ ] **Step 1: Implement modular structural helpers in `map-enhanced.js`**

Add focused helpers for:
- primary wall segments
- layered cover blocks
- trims/frame pieces
- zone accents / functional lighting anchors
- platform/stair/column variants where needed

- [ ] **Step 2: Replace the current ad hoc blockout generation with the modular kit**

Ensure the center structures, lanes, boundaries, and cover pieces share one architectural language instead of unrelated primitive placement.

- [ ] **Step 3: Add ground zoning and area identity accents**

Use material/value separation plus restrained accents so the arena reads as designed spaces rather than a flat plane with props.

- [ ] **Step 4: Run the scene-kit tests**

Run: `cd client && npm test -- --run js/__tests__/map-enhanced-visual.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: rebuild arena with modular competitive scene kit`

## Chunk 3: Player visual overhaul

### Task 3: Rebuild player meshes around a readable competitive silhouette

**Files:**
- Modify: `client/js/renderer.js`
- Test: `client/js/__tests__/renderer.test.js`
- Test: `client/js/__tests__/player-visuals.test.js`

- [ ] **Step 1: Replace the current player body composition with layered competitive forms**

Add clearer torso, shoulder, head, leg, and equipment masses. Keep the same player ID registration and renderer APIs.

- [ ] **Step 2: Add restrained CT/T identity accents**

Use accents on shoulders/chest/helmet-equivalent surfaces so teams remain readable without repainting the whole model.

- [ ] **Step 3: Preserve bot and remote-player compatibility**

Existing calls like `renderer.addPlayer(id, position, { isBot, team })` must continue to work.

- [ ] **Step 4: Run renderer/player tests**

Run: `cd client && npm test -- --run js/__tests__/renderer.test.js js/__tests__/player-visuals.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: rebuild player visuals for competitive readability`

## Chunk 4: Materials, lighting, and polish pass

### Task 4: Unify materials and lighting into one competitive visual language

**Files:**
- Modify: `client/js/renderer.js`
- Modify: `client/js/effects/map-enhanced.js`
- Test: `client/js/__tests__/renderer.test.js`

- [ ] **Step 1: Replace the current toon-heavy presentation with restrained light-realistic materials**

Keep broad forms readable. Reduce toy-like color blocking while preserving clear silhouettes.

- [ ] **Step 2: Rebalance directional, ambient, and local lighting**

Scene lighting should improve volume and premium feel without hiding targets.

- [ ] **Step 3: Keep post-processing restrained**

Use only limited bloom/tone adjustments that improve presentation without hurting combat readability.

- [ ] **Step 4: Run renderer regression tests again**

Run: `cd client && npm test -- --run js/__tests__/renderer.test.js js/__tests__/map-enhanced-visual.test.js js/__tests__/player-visuals.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 5: Commit**

Commit message: `feat: unify scene and character lighting/material language`

## Chunk 5: Verification and live visual QA

### Task 5: Verify phase 1 visually and document the change

**Files:**
- Modify: `docs/ARCHITECTURE.md` (if renderer architecture changed materially)
- Modify: `README.md` (if visual presentation notes need refresh)

- [ ] **Step 1: Run targeted client tests**

Run: `cd client && npm test -- --run js/__tests__/renderer.test.js js/__tests__/map-enhanced-visual.test.js js/__tests__/player-visuals.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 2: Run broader client regression coverage**

Run: `cd client && npm test -- --run js/__tests__/main-player-list.test.js js/__tests__/main-voice-handlers.test.js tests/ui.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 3: Verify production-facing build path if asset/script wiring changed**

Run: `cd /home/node/projects/fps-game && ./scripts/ci/test_deploy_prod_restores_index.sh`
Expected: PASS.

- [ ] **Step 4: Capture live browser validation evidence**

Open the running game, join a room, confirm:
- the environment no longer reads like greybox primitives
- characters feel upgraded and readable
- CT/T identity is still obvious in motion
- gameplay visibility remains clean during combat

- [ ] **Step 5: Commit docs and verification updates**

Commit message: `docs: record competitive 3d visual overhaul phase 1`

---

## Execution Notes

- Use TDD for every behavior-level change: write a failing visual regression test first, then implement the minimum needed to satisfy it.
- Do not change network or hit-registration behavior as part of this visual overhaul unless a visual change requires a compatibility fix.
- Prefer extending existing renderer/map systems over introducing a parallel rendering stack.
- Validate each chunk before moving on so the visual overhaul does not regress active gameplay behavior.
