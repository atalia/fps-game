# No-Texture Visual Polish Design

**Date:** 2026-04-13

## Goal

Improve the FPS game's visual quality without relying on external textures or imported art assets.
The result should feel like a clean, shipped tactical FPS instead of a white-box prototype, while preserving combat readability and mid-range performance.

## Chosen Direction

- **Style:** light realistic competitive
- **Scope:** map presentation + character presentation + restrained lighting polish
- **Constraint:** no external textures for this phase
- **Technique mix:** geometry layering, procedural material detail, restrained lighting/post-processing
- **Performance target:** mid-range balanced
- **Priority:** readability and silhouette quality over cinematic flair

## Product Intent

The game should stop reading as placeholder geometry.
Even without real textures, players should feel that the arena, cover, and characters belong to a deliberate tactical world.
The presentation should stay clean, controlled, and readable under movement.

## Approved Approach

### Recommended approach: structure-first polish
This phase improves presentation in this order:

1. map structure and silhouette
2. character structure and silhouette
3. procedural material breakup
4. restrained lighting and post-processing tuning

This order is intentional.
Without textures, the fastest path away from a prototype look is stronger form language, clearer component breakup, and better lighting support.

## Design Principles

### 1. Structure before surface
Large primitive blocks should become layered tactical modules with readable hierarchy.
We should not try to fake quality through noisy materials alone.

### 2. Readability over spectacle
If an improvement makes the scene look richer but hurts enemy recognition, lane reading, or cover recognition, it is a failed trade.

### 3. Restraint over clutter
The map should feel designed, not busy.
Each upgraded module should gain only a few meaningful layers, not a pile of decorative fragments.

### 4. Unified world language
Map geometry, character gear, material palettes, and local lights should all reinforce the same clean tactical world.

### 5. Mid-range safe by default
Use low-cost geometry combinations and procedural material variation.
Avoid expensive art pipelines, dense meshes, and heavy post effects.

## Scope

This phase covers three presentation layers together.

### In scope
- map silhouette upgrade
- cover and core structure breakup
- boundary and floor presentation polish
- character silhouette and gear layering polish
- restrained material palette separation
- restrained lighting and post-processing rebalance
- regression tests for new presentation boundaries where practical

### Out of scope
- external texture packs
- imported production character models
- full environment asset replacement
- cinematic fog-heavy presentation
- high-cost VFX passes
- weapon art pipeline replacement

## Map Design

### Current problems
- core combat spaces still read like test boxes
- cover shapes are too primitive and lack hierarchy
- boundaries are functionally correct but visually plain
- floor and wall surfaces lack enough material separation

### Target map language
The arena should read as a designed tactical training or combat space, not a debug room.
Shapes should look intentional and modular.

### Map upgrade strategy

#### A. Cover modules
Replace single-block cover with layered cover clusters.
Each cluster should read as a functional tactical obstacle, not a single cube.

**Desired composition:**
- main body
- side wings or braces
- top cap or trim piece
- optional accent strip or identification line
- optional base plinth or support foot where useful

**Rules:**
- preserve readable cover footprint
- preserve lane clarity
- do not create visual clutter around line-of-sight edges

#### B. Core architecture
Upgrade center and lane-defining structures from simple masses into multi-part tactical modules.

**Desired composition:**
- base mass
- upper frame or overhead band
- trim pieces at edges or lane-facing faces
- support columns or anchor pieces
- restrained tactical signage or strip accents

#### C. Boundary walls
Boundary walls should stop reading as blank arena borders.

**Desired composition:**
- primary wall body
- top cap or pressure edge
- segmented rhythm along long spans
- occasional functional strip or inset panel treatment

The result should still clearly communicate map limits without drawing too much attention.

#### D. Ground treatment
Ground stays procedural, but should gain stronger zone identity.

**Additions allowed:**
- material bands
- lane framing
- border striping
- spawn or route markings
- restrained warning or tactical paint shapes
- low-strength procedural noise for breakup

**Avoid:**
- fake detailed grunge spam
- overly dirty surfaces
- noisy markings that obscure silhouettes

## Character Design

### Current problems
- player models still feel too close to placeholders
- torso and gear layering are shallow
- CT/T identity relies too much on broad tinting

### Character upgrade strategy
Characters should remain simple enough for gameplay, but feel like tactical operators instead of placeholders.

#### Silhouette goals
Strengthen:
- head, shoulder, chest breakup
- vest and torso layering
- waist and leg gear breakup
- clearer equipment structure from medium distance

#### Equipment layering goals
Add or improve:
- chest rig / vest presence
- shoulder shaping
- belt or waist breakup
- thigh or shin breakup where affordable
- more grounded weapon carry relationship

#### Team identity goals
CT/T readability should come from restrained structured cues:
- shoulder accents
- chest markers
- kit layout emphasis
- material/value differences
- small controlled color identity points

Avoid whole-body flat recolors.

## Material Design Without Textures

### Objective
Create enough material separation that the scene feels intentional and grounded, even without true texture maps.

### Material strategy
Use procedural or parameter-driven distinction across categories:
- ground
- structure
- cover
- trim
- boundary
- prop
- character armor/gear
- character accents

### Allowed material tools
- controlled color families
- roughness variation
- metalness variation
- emissive accents used sparingly
- canvas-driven or code-driven noise
- simple procedural banding, paneling, and line work

### Material rules
- broad readable value groups first
- small detail only after primary material contrast is clear
- tactical cleanliness over dirt-heavy realism
- no surface treatment should dominate silhouette recognition

## Lighting and Post-Processing

### Objective
Support volume, separation, and tactical clarity without turning the scene cinematic.

### Lighting layers
1. main directional light for shape definition
2. ambient or hemisphere fill to keep readability stable
3. restrained functional local lights at key spaces
4. optional accent highlights only where they reinforce navigation or form

### Functional-light placement priorities
- spawn framing
- central lane structure
- important cover clusters
- edge rhythm along boundary or flanks where helpful

### Post-processing rules
Allowed:
- restrained bloom
- mild contrast shaping
- balanced tone mapping
- slight atmosphere only if readability stays intact

Avoid:
- bloom halos
- crushed shadows
- fog-heavy distance masking
- aggressive color grading
- strong exposure swings

## Architecture and Code Boundaries

### Primary modules

#### `client/js/effects/map-enhanced.js`
Owns map-side presentation upgrades:
- cover cluster composition
- core structure layering
- boundary segmentation
- ground presentation polish
- decorative or tactical support details

This module should continue to be the main home for environment presentation logic.

#### `client/js/assets/character-kit.js`
Owns character silhouette and equipment presentation:
- body breakup
- vest / shoulder / gear layers
- restrained team identity cues
- simple fallback-safe tactical shapes

#### `client/js/renderer.js`
Owns scene assembly and presentation orchestration:
- map creation hookup
- character kit hookup
- light profile application
- post-processing profile selection

`renderer.js` should coordinate, not absorb large blocks of detailed geometry logic.

## Data Flow

1. renderer initializes map and character presentation layers
2. `MapEnhanced` builds upgraded arena structures and ground treatment
3. `CharacterKit` builds upgraded tactical silhouettes for players
4. renderer applies lighting profile and restrained post-processing settings
5. gameplay uses the same readable combat spaces, only with upgraded presentation

## Error Handling and Fallbacks

Because this phase still avoids external asset dependency, the system must remain robust under missing optional presentation pieces.

### Requirements
- map presentation should still render if any optional submodule is unavailable
- character presentation should still fall back to simpler tactical geometry if a higher-detail path fails
- lighting polish must degrade gracefully instead of producing black or blown-out scenes
- no visual enhancement may block gameplay initialization

## Performance Guardrails

### Budget philosophy
Prefer many low-cost wins over a few expensive showcase tricks.

### Guardrails
- keep new geometry modular and simple
- avoid high-fragment-cost materials
- avoid high-count decorative clutter
- keep local lights limited and purposeful
- keep post-processing at medium or below
- prefer reusable module composition over unique bespoke meshes everywhere

## Risks and Mitigations

### Risk 1: Scene becomes visually noisy
**Mitigation:** limit each structure to a few meaningful layers and keep accents restrained.

### Risk 2: Tactical readability drops
**Mitigation:** preserve broad value separation, keep lighting balanced, and treat silhouette clarity as a blocker.

### Risk 3: Performance regressions on mid-range machines
**Mitigation:** use simple geometry, restrained lights, and lightweight procedural material tricks.

## Validation Criteria

This phase succeeds if all of the following are true:

1. the arena no longer reads like a white-box prototype in screenshots
2. cover and core architecture show obvious layered structure instead of single primitive blocks
3. player characters read like tactical operators rather than placeholders at medium distance
4. CT/T readability remains fast and reliable
5. the visual language across map, characters, and lighting feels cohesive
6. client tests continue to pass, with new regression tests added where new boundaries are introduced
7. in-browser play still reads cleanly during movement and aiming

## Test Strategy

### Automated
Add or extend tests that verify:
- upgraded map module composition exists where expected
- category tagging and structural grouping remain correct
- character presentation still exposes the intended layered silhouette cues
- any added presentation helpers behave consistently

### Manual
Validate in browser:
- first impression on load
- center lane readability
- cover readability while strafing
- opponent silhouette readability in motion
- no obvious lighting or post-processing overload

## Recommended Planning Breakdown

The implementation plan should break into these work units:

1. map silhouette and cover-module upgrade
2. character silhouette and gear-layer upgrade
3. procedural material polish pass
4. lighting and restrained post-processing rebalance
5. verification, browser check, and cleanup

## Merge Readiness Definition

The implementation should only be considered complete when:
- the scene looks materially more finished without external textures
- the game remains readable and performant enough for the mid-range target
- automated checks pass
- browser validation confirms the arena and characters feel like a clean tactical FPS presentation rather than a prototype
