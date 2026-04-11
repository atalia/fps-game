# Semi-Realistic Tactical Visual Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the FPS game into a semi-realistic tactical presentation by integrating higher-quality environment and character assets, then unifying them with improved lighting, materials, and medium-strength post-processing without sacrificing combat readability.

**Architecture:** Keep the current Three.js runtime and renderer entry points, but add a thin asset-loading layer so imported environment and character kits can be normalized before use. Build the work in vertical slices: asset pipeline and scene contracts first, then environment integration, then character integration, then lighting/post-processing tuning, and finally live validation and docs.

**Tech Stack:** Three.js r128, browser-side JS globals, GLTF/texture asset loading, Vitest, existing Go server/runtime, GitHub issue workflow.

---

## File Structure

### Runtime files to create
- Create: `client/js/assets/runtime-assets.js` — shared loader/cache for imported tactical assets, fallback-safe wrappers, scale normalization helpers
- Create: `client/js/assets/environment-kit.js` — environment asset registry and scene assembly helpers for imported tactical structures
- Create: `client/js/assets/character-kit.js` — character asset registry, team accent application, fallback mesh helpers
- Create: `client/assets/models/README.md` — provenance/license notes for imported environment and character assets

### Runtime files to modify
- Modify: `client/index.html` — load any required Three.js example loaders before the renderer and ensure new asset scripts are included in stable order
- Modify: `client/js/renderer.js` — integrate loader layer, environment/character kits, lighting rebalance, post-processing toggles, fallback logic
- Modify: `client/js/effects/map-enhanced.js` — replace procedural placeholders in high-value areas with imported kit placement plus normalized material treatment
- Modify: `client/js/game.js` — only if runtime hooks are needed for first-person/character asset sync or quality toggles
- Modify: `README.md` — note upgraded semi-realistic tactical visual direction and asset-source policy
- Modify: `docs/ARCHITECTURE.md` — document asset pipeline, scene composition path, and fallback behavior

### Tests to create or extend
- Modify: `client/js/__tests__/renderer.test.js` — renderer fallback and asset-ready integration coverage
- Modify: `client/js/__tests__/map-enhanced-visual.test.js` — verify imported tactical scene categories replace placeholder-heavy geometry in core zones
- Modify: `client/js/__tests__/player-visuals.test.js` — verify upgraded character silhouette layers and team accent rules still hold
- Create: `client/js/__tests__/runtime-assets.test.js` — loader/cache/fallback tests for imported assets
- Create: `client/js/__tests__/environment-kit.test.js` — environment kit registration and scene placement tests
- Create: `client/js/__tests__/character-kit.test.js` — character kit registration, team variant, and fallback tests

---

## Chunk 1: Semi-realistic tactical visual upgrade

### Task 1: Add an imported-asset runtime layer with graceful fallback

**Files:**
- Create: `client/js/assets/runtime-assets.js`
- Modify: `client/index.html`
- Test: `client/js/__tests__/runtime-assets.test.js`

- [ ] **Step 1: Write the failing loader test**

```javascript
test('runtime asset loader caches imported assets and falls back when a source is missing', async () => {
  const runtime = new RuntimeAssets({
    loader: fakeLoader,
    fallbackFactory: () => ({ id: 'fallback' }),
  })

  fakeLoader.mockResolvedValueOnce({ id: 'env-kit' })

  const first = await runtime.load('arena-core', '/assets/models/arena-core.glb')
  const second = await runtime.load('arena-core', '/assets/models/arena-core.glb')
  const fallback = await runtime.load('missing-kit', '/assets/models/missing.glb')

  expect(first).toEqual({ id: 'env-kit' })
  expect(second).toBe(first)
  expect(fallback).toEqual({ id: 'fallback' })
  expect(fakeLoader).toHaveBeenCalledTimes(2)
})
```

- [ ] **Step 2: Run the loader test to verify it fails**

Run: `cd client && npm test -- --run js/__tests__/runtime-assets.test.js --reporter=verbose --no-color`
Expected: FAIL because `RuntimeAssets` does not exist yet.

- [ ] **Step 3: Add minimal runtime asset loader implementation**

Implement in `client/js/assets/runtime-assets.js`:
```javascript
class RuntimeAssets {
  constructor({ loader, fallbackFactory }) {
    this.loader = loader
    this.fallbackFactory = fallbackFactory
    this.cache = new Map()
  }

  async load(key, source) {
    if (this.cache.has(key)) return this.cache.get(key)
    try {
      const loaded = await this.loader(source)
      this.cache.set(key, loaded)
      return loaded
    } catch (error) {
      const fallback = this.fallbackFactory(key, source, error)
      this.cache.set(key, fallback)
      return fallback
    }
  }
}

window.RuntimeAssets = RuntimeAssets
```

- [ ] **Step 4: Load the asset runtime before `renderer.js` in `client/index.html`**

Add script tags for:
- required Three.js loader helpers (for example `GLTFLoader` and `DRACOLoader` if used)
- `runtime-assets.js`

Keep order stable so renderer code can rely on globals.

- [ ] **Step 5: Re-run the loader test to verify it passes**

Run: `cd client && npm test -- --run js/__tests__/runtime-assets.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/index.html client/js/assets/runtime-assets.js client/js/__tests__/runtime-assets.test.js
git commit -m "feat: add tactical asset runtime loader"
```

### Task 2: Upgrade core combat spaces with imported environment kits

**Files:**
- Create: `client/js/assets/environment-kit.js`
- Modify: `client/js/effects/map-enhanced.js`
- Modify: `client/js/renderer.js`
- Test: `client/js/__tests__/environment-kit.test.js`
- Test: `client/js/__tests__/map-enhanced-visual.test.js`

- [ ] **Step 1: Write the failing environment-kit test**

```javascript
test('environment kit assembles imported tactical structures for core combat zones', () => {
  const renderer = createRendererDouble()
  const kit = new EnvironmentKit(renderer)

  const sceneObjects = kit.buildCoreZones()

  expect(sceneObjects.some((obj) => obj.userData.zone === 'mid-lane')).toBe(true)
  expect(sceneObjects.some((obj) => obj.userData.category === 'cover')).toBe(true)
  expect(sceneObjects.some((obj) => obj.userData.category === 'boundary')).toBe(true)
})
```

- [ ] **Step 2: Run the environment-kit and map visual tests to verify they fail**

Run: `cd client && npm test -- --run js/__tests__/environment-kit.test.js js/__tests__/map-enhanced-visual.test.js --reporter=verbose --no-color`
Expected: FAIL because `EnvironmentKit` and the new core-zone contract do not exist yet.

- [ ] **Step 3: Implement `EnvironmentKit` with imported-asset registration and placement helpers**

Add helpers for:
- core zone registry (`spawn`, `mid-lane`, `cover-cluster`, `boundary-frame`)
- asset normalization (scale, rotation, material overrides)
- fallback primitive generation when imported kits are unavailable

- [ ] **Step 4: Replace placeholder-heavy core-zone generation in `map-enhanced.js`**

Refactor the scene build to:
- route primary combat spaces through `EnvironmentKit`
- keep peripheral filler geometry lightweight
- tag imported/fallback structures with `userData.category`, `userData.zone`, and `userData.visualProfile`

- [ ] **Step 5: Re-run the environment-kit and map visual tests to verify they pass**

Run: `cd client && npm test -- --run js/__tests__/environment-kit.test.js js/__tests__/map-enhanced-visual.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add client/js/assets/environment-kit.js client/js/effects/map-enhanced.js client/js/renderer.js client/js/__tests__/environment-kit.test.js client/js/__tests__/map-enhanced-visual.test.js
git commit -m "feat: integrate imported tactical environment kits"
```

### Task 3: Upgrade character silhouettes and team identity with imported kits

**Files:**
- Create: `client/js/assets/character-kit.js`
- Modify: `client/js/renderer.js`
- Test: `client/js/__tests__/character-kit.test.js`
- Test: `client/js/__tests__/player-visuals.test.js`
- Test: `client/js/__tests__/renderer.test.js`

- [ ] **Step 1: Write the failing character-kit test**

```javascript
test('character kit applies a semi-realistic tactical silhouette with restrained CT/T accents', () => {
  const kit = new CharacterKit({ fallbackFactory: createFallbackCharacter })

  const ct = kit.buildPlayer({ team: 'ct', isBot: false })
  const t = kit.buildPlayer({ team: 't', isBot: true })

  expect(ct.userData.visualProfile).toBe('semi-realistic-tactical')
  expect(ct.userData.teamAccent).not.toBe(t.userData.teamAccent)
  expect(ct.children.length).toBeGreaterThan(4)
})
```

- [ ] **Step 2: Run character and renderer tests to verify they fail**

Run: `cd client && npm test -- --run js/__tests__/character-kit.test.js js/__tests__/player-visuals.test.js js/__tests__/renderer.test.js --reporter=verbose --no-color`
Expected: FAIL because `CharacterKit` and the new silhouette contract do not exist yet.

- [ ] **Step 3: Implement `CharacterKit` and wire it into `renderer.addPlayer()` / `renderer.updatePlayer()` compatibility paths**

Requirements:
- imported character assets normalized to one shared scale/origin
- fallback mesh path still available for tests or missing assets
- team identity handled by restrained tactical accents, not flat full-body paint
- existing renderer player map keys and update paths remain unchanged

- [ ] **Step 4: Re-run character and renderer tests to verify they pass**

Run: `cd client && npm test -- --run js/__tests__/character-kit.test.js js/__tests__/player-visuals.test.js js/__tests__/renderer.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/js/assets/character-kit.js client/js/renderer.js client/js/__tests__/character-kit.test.js client/js/__tests__/player-visuals.test.js client/js/__tests__/renderer.test.js
git commit -m "feat: upgrade tactical character presentation"
```

### Task 4: Rebalance lighting and add medium-strength post-processing guardrails

**Files:**
- Modify: `client/js/renderer.js`
- Modify: `client/js/effects/map-enhanced.js`
- Test: `client/js/__tests__/renderer.test.js`

- [ ] **Step 1: Write the failing renderer-lighting test**

```javascript
test('renderer configures semi-realistic tactical lighting with restrained post-processing', () => {
  const renderer = new Renderer('game-container')

  expect(renderer.renderer.toneMapping).toBe(THREE.ACESFilmicToneMapping)
  expect(renderer.tacticalLightingProfile.primaryDirectionalLights).toBe(1)
  expect(renderer.tacticalLightingProfile.postProcessingLevel).toBe('medium')
  expect(renderer.tacticalLightingProfile.readabilityGuardrails).toContain('target-visibility')
})
```

- [ ] **Step 2: Run the renderer test to verify it fails**

Run: `cd client && npm test -- --run js/__tests__/renderer.test.js --reporter=verbose --no-color`
Expected: FAIL because the tactical lighting profile contract does not exist yet.

- [ ] **Step 3: Implement the lighting/post-processing profile**

Requirements:
- directional + ambient + local functional lights stay explicit in renderer state
- bloom remains medium-strength and toggleable
- tone mapping / exposure tuned for semi-realistic tactical presentation
- readability guardrails captured in one renderer config object for regression tests

- [ ] **Step 4: Re-run renderer test to verify it passes**

Run: `cd client && npm test -- --run js/__tests__/renderer.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add client/js/renderer.js client/js/effects/map-enhanced.js client/js/__tests__/renderer.test.js
git commit -m "feat: rebalance tactical lighting and post-processing"
```

### Task 5: Validate the visual slice end-to-end and document the architecture

**Files:**
- Create: `client/assets/models/README.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`

- [ ] **Step 1: Record imported asset provenance and usage rules**

Document in `client/assets/models/README.md`:
- source URL / package name
- license or usage terms
- which scene or character role each asset serves
- any normalization notes (scale, materials, team accents)

- [ ] **Step 2: Run focused visual regression tests**

Run: `cd client && npm test -- --run js/__tests__/runtime-assets.test.js js/__tests__/environment-kit.test.js js/__tests__/character-kit.test.js js/__tests__/map-enhanced-visual.test.js js/__tests__/player-visuals.test.js js/__tests__/renderer.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 3: Run broader client regression coverage**

Run: `cd client && npm test -- --run js/__tests__/main-player-list.test.js js/__tests__/main-voice-handlers.test.js tests/ui.test.js tests/game.test.js --reporter=verbose --no-color`
Expected: PASS.

- [ ] **Step 4: Run full local CI**

Run: `make ci-local`
Expected: PASS.

- [ ] **Step 5: Perform live browser validation**

Open the running game and verify:
- core combat spaces no longer look like placeholder architecture
- imported environment kits feel consistent with the map
- upgraded characters are readable in motion and match scene quality
- lighting and medium-strength post-processing improve depth without hiding opponents

- [ ] **Step 6: Update docs for the new visual pipeline**

Document:
- asset-loading and fallback path
- environment and character kit boundaries
- realism/readability guardrails

- [ ] **Step 7: Commit**

```bash
git add client/assets/models/README.md README.md docs/ARCHITECTURE.md
git commit -m "docs: record semi-realistic tactical visual pipeline"
```

---

## Review checklist for this plan chunk

- Imported assets must always have a fallback path so browser validation and tests do not depend on external availability.
- Environment upgrades should focus on core combat spaces first, not full-map replacement.
- Character upgrades must preserve existing renderer integration points.
- Medium-strength post-processing must remain subordinate to target visibility.
- Asset provenance and usage rights must be documented before claiming completion.
