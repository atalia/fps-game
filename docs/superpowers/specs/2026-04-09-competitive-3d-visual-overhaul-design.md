# Competitive 3D Visual Overhaul Design

**Date:** 2026-04-09

## Goal

Rebuild the FPS game's 3D presentation around a light-realistic competitive style, with the first delivery focused on scene architecture and character visuals. The result should feel substantially more premium while preserving readability, team identification, and gameplay clarity.

## Direction

Chosen style: **light-realistic competitive**

Priorities:
1. **Buildings and scene architecture**
2. **Player character visuals**
3. Keep the overall work **quality-first** rather than performance-first

## Visual Pillars

- **Readable at combat speed**: silhouettes, cover shapes, and team identity must stay clear during active play
- **Modular and intentional**: scene pieces should feel designed, not randomly stacked primitives
- **Cohesive world**: buildings, characters, props, and lighting should share one visual language
- **Premium but clean**: no heavy grime-pass or filmic clutter that hurts competitive readability

## Scene / Building Design

### Current problems
- Buildings look like temporary whitebox geometry with weak shape language
- Cover pieces do not form a believable competitive environment
- Ground, walls, and key areas lack hierarchy and material separation
- Scene details do not support navigation, callouts, or team-side recognition

### Target structure
The environment should be rebuilt in layered form:

1. **Foundation layer**
   - Ground planes, main walls, boundaries, and major massing
   - Correct proportions and lane readability first
2. **Gameplay layer**
   - Cover, corridors, choke points, platforms, pillars, door openings
   - Shapes tuned for combat clarity, not decoration first
3. **Identity layer**
   - CT/T side recognition through architecture, lighting accents, signage, and color placement
   - Functional zones should be recognizable at a glance
4. **Detail layer**
   - Trims, railings, vents, light fixtures, warning markings, edge framing, steps, structural repeats
   - Enough detail to remove the prototype feel without bloating the frame

### Building style rules
- Favor **modular kits** over ad hoc geometry piles
- Favor **hard, clear, believable forms** over toy-like stylization
- Use **material contrast** and **structural repetition** to create quality
- Keep sightlines and cover readability more important than ornament

## Character Design

### Current problems
- Characters read like placeholder geometry instead of finished FPS actors
- Body proportions and silhouette are too crude
- Team identity depends too much on broad color assignment
- Characters do not visually match the environment quality target

### Target character language
- Strong competitive silhouette readable at medium and long distance
- Cleaner human proportions with visible shoulder line, torso mass, leg separation, and equipment layering
- Distinct but restrained team identification via shoulder, chest, helmet/armband, emissive or accent elements
- Tactical equipment cues without going full gritty military sim

### Character style rules
- Do not use exaggerated cartoon anatomy
- Do not use heavy realistic grime and noise
- Focus on **shape, layering, and readability** first, micro-detail later

## Rendering and Material Design

### Material classes
1. **Environment materials**
   - Concrete, coated metal, tactical flooring, painted surfaces
   - Clear roughness/value separation, limited noise, strong broad forms
2. **Character materials**
   - Fabric, armor plates, helmet surfaces, weapon finishes
   - Large readable value groups, consistent highlight behavior
3. **Accent materials**
   - Team accents, area lights, signage, critical visual markers
   - Controlled use only, never noisy or over-glowy

### Lighting strategy
- Key directional light for volume and structure
- Controlled ambient fill for readability
- Local functional lights for zone identity and premium feel
- Avoid deep darkness that hides targets

### Post-processing strategy
Allowed in phase 1:
- restrained tone mapping
- restrained bloom
- stronger value separation and color control

Avoid in phase 1:
- heavy depth of field
- aggressive bloom
- cinematic color grading that hurts aim/readability
- excessive screen-space clutter

## Delivery Phases

### Phase 1: Remove the prototype feel
- Rebuild main map block language
- Replace primitive-looking cover and wall shapes with modular structures
- Add ground zoning and key-area identity
- Rebuild player silhouette and layered body/equipment forms
- Improve CT/T identification without overpainting characters
- Unify material and lighting rules across scene and characters

### Phase 2: Complete the atmosphere
- Add structural detail systems and local lighting language
- Refine character materials and equipment identity
- Improve environmental storytelling and area distinction
- Bring weapons into the same visual language

### Phase 3: Premium polish
- Add higher-quality detail assets where needed
- Expand set dressing and advanced composition
- Improve presentation layers selectively without hurting gameplay readability

## Phase 1 Success Criteria

1. Scene screenshots no longer look like a test map or greybox arena
2. Character screenshots clearly read as competitive FPS actors, not placeholder geometry
3. Team identity remains readable at mid and long distance
4. Live gameplay still feels clear during aiming, movement, and target acquisition

## Technical Notes for Implementation

- Stay within the current Three.js pipeline and existing gameplay architecture
- Rework the renderer, map-enhanced scene generation, and player construction together instead of applying isolated polish
- Keep new visual systems modular so scene kit pieces, accents, and character layers can be tuned independently
- Validate each phase with real browser screenshots and live gameplay checks, not code-only review
