# Semi-Realistic Tactical Visual Upgrade Design

**Date:** 2026-04-10

## Goal

Upgrade the FPS game from the current lightweight competitive visual pass to a more realistic tactical presentation, while preserving gameplay readability. This phase should improve screenshot quality and in-match clarity at the same time.

## Chosen Direction

- **Style:** semi-realistic tactical
- **Scope:** scene + character upgrades together
- **Priority:** visual quality first
- **Post-processing:** medium intensity
- **Asset strategy:** introduce high-quality open-source / commercially usable free assets
- **First asset wave:** environment + characters together
- **Execution approach:** layered rollout, with core combat spaces and core character presentation upgraded first

## Product Intent

The game should no longer read like a procedural prototype arena with placeholder actors. It should feel closer to a shipped tactical FPS: more believable materials, stronger depth and lighting, upgraded silhouettes, and more convincing environmental structure.

At the same time, it must not become muddy, over-graded, or visually noisy. Enemy recognition, cover readability, and route comprehension remain mandatory.

## Phase 1 Outcomes

Phase 1 focuses on the highest-value upgrade points that affect both first impression and active combat:

1. **Core environment upgrade**
   - Replace key visible architecture with more believable tactical structures
   - Upgrade ground, wall, cover, pillar, and boundary presentation
   - Introduce stronger material separation and area identity

2. **Core character upgrade**
   - Replace simplified placeholder body language with more credible FPS combat silhouettes
   - Add layered tactical equipment cues
   - Preserve clear team readability without relying on flat toy-like coloration

3. **Lighting and post-processing upgrade**
   - Improve depth, contrast, and shape readability
   - Use controlled medium-strength post-processing
   - Increase visual richness without overwhelming combat visibility

4. **Readability guardrails**
   - Keep enemy and cover detection fast
   - Prevent realism improvements from reducing tactical clarity
   - Treat readability regressions as blockers, not polish bugs

## Visual Principles

### 1. Tactical realism over stylization
- Harder, more believable structure language
- Materials should feel grounded in concrete, coated metal, painted steel, tactical flooring, exposed utility surfaces
- Avoid cartoony color blocking and exaggerated form language

### 2. Readability under movement
- Silhouettes must still hold at combat speed
- Cover shapes must remain readable from medium distance
- Important routes and angles should stay legible during motion, recoil, and target tracking

### 3. Cohesive world language
- Environment, character, weapons, accents, and lights should feel like one world
- Imported assets must be normalized by material, scale, and lighting treatment
- No obvious “asset pack mismatch” between modules

### 4. Controlled atmosphere
- Richer presentation is good
- Heavy cinematic noise is not
- This should feel premium and tactical, not hazy or over-processed

## Environment Design

### Current problems
- Arena geometry still reads too much like a structured test map
- Ground, walls, and cover do not yet sell material authenticity
- Core combat spaces lack high-quality architectural identity
- Repeated primitive forms reveal the procedural origin too clearly

### Target environment approach

#### Core zones first
The first upgrade wave targets the zones that dominate player attention:
- main combat corridors
- center engagement lane
- high-frequency cover clusters
- spawn-adjacent framing structures
- boundary walls and skyline-defining massing

#### Environment asset priorities
Priority order:
1. ground and flooring kits
2. walls and structural framing
3. cover blocks and tactical obstacles
4. pillars, trims, rails, edge pieces
5. utility props and functional detail pieces

#### Material treatment
Primary environment materials:
- tactical concrete
- coated structural metal
- painted industrial panels
- anti-slip ground surfaces
- restrained warning markings and zone signage

Material rules:
- broad readable value groups first
- surface detail should support realism, not become noisy texture spam
- roughness and contrast should help shape reading
- repeated assets should be varied through placement and material tuning, not random clutter

#### Zone identity
Each key combat zone should become readable through a combination of:
- floor treatment
- structural rhythm
- local light placement
- restrained signage / markings
- silhouette cues at lane entrances

## Character Design

### Current problems
- Characters still read too close to placeholder geometry
- Equipment layering is too shallow
- Character quality does not yet match the new environment target
- Team readability depends too much on broad color handling instead of structured tactical identity

### Target character approach

#### Silhouette goals
Characters should read as finished tactical FPS combatants at medium and long range:
- stronger head / torso / shoulder breakup
- clearer chest mass and tactical vest structure
- more believable limb proportion and separation
- more grounded posture language

#### Equipment layering
Add or improve:
- chest rig / vest presence
- shoulder protection or shoulder structure
- helmet / headgear silhouette cues
- arm / leg equipment breakup
- more convincing weapon carry relationship

#### Team identity strategy
Team identification should remain strong, but move away from flat saturated paint.
Use a mix of:
- shoulder or arm accents
- chest markers
- restrained emissive or reflective identifiers
- material/value separation
- faction-specific kit layout cues where practical

#### Readability rule
If a character looks more realistic but becomes harder to distinguish in combat, that is a failed trade.

## Lighting Strategy

### Goals
- stronger volume
- cleaner separation of planes
- clearer targets in combat spaces
- richer mood without darkening gameplay information

### Lighting layers
1. **Primary directional light**
   - establish form and overall scene direction
2. **Ambient / hemisphere fill**
   - preserve readability in shaded spaces
3. **Functional local lights**
   - reinforce zone identity, entrances, cover pockets, utility areas
4. **Accent lights**
   - used sparingly to support premium feel and navigation

### Guardrails
- avoid extreme contrast that hides opponents
- avoid dark corners that look dramatic but break combat fairness
- lighting must support, not compete with, player silhouettes

## Post-Processing Strategy

Chosen level: **medium**

### Allowed
- restrained bloom
- improved tone mapping
- moderate contrast shaping
- limited atmospheric depth cues
- slightly richer color separation

### Avoid
- aggressive bloom halos
- heavy filmic wash
- deep cinematic fog that obscures targets
- unstable exposure swings
- anything that makes screenshots impressive but gunfights worse

## Asset Strategy

### Source policy
Use higher-quality assets that are open-source or commercially usable free assets.

### Integration rules
- normalize scale across imported assets
- rebalance materials so imported pieces share one world language
- avoid dumping raw asset-pack visuals directly into the map
- prefer a curated set of modular pieces over a large incoherent asset flood

### Scope control
Even though higher-quality assets are allowed, phase 1 still focuses on the most visible and highest-value pieces first. Full-map replacement is not the goal of the first delivery.

## Non-Goals for Phase 1

- full map replacement everywhere
- final weapon and first-person hand pipeline
- hyper-cinematic visuals
- maximum realism at the expense of readability
- broad content expansion unrelated to visual quality

## Validation Criteria

Phase 1 is successful when all of the following are true:

1. Screenshots read like a real tactical FPS space, not a procedural prototype arena
2. Characters visually belong in the upgraded environment
3. Enemy and cover readability remain strong during active movement and aiming
4. Lighting and post-processing improve depth and quality without muddying the image
5. Imported assets do not feel visually disconnected from the rest of the game

## Technical Implementation Notes

- keep the existing Three.js-based rendering pipeline
- extend the current modular scene and renderer architecture rather than replacing the whole runtime
- make new visual systems degradable or switchable where practical, since the chosen direction intentionally pushes quality harder
- keep verification grounded in both automated checks and live browser validation
- preserve compatibility with existing renderer integration points and gameplay systems unless a clear visual-system contract change is required
