# Visual Asset Provenance

## Current status

This branch introduces the runtime loading boundary for higher quality tactical assets, but **no third-party GLB/GLTF files are checked into the repo yet**.
Current gameplay visuals are served by in-repo tactical kits plus graceful procedural fallback meshes.

## Asset usage table

| Asset / kit | Source | License / terms | Used for | Normalization notes |
|---|---|---|---|---|
| `RuntimeAssets` cache layer | In-repo runtime loader (`client/js/assets/runtime-assets.js`) | Project code | Shared loading + fallback boundary | Cache by logical key, return fallback on load failure |
| `EnvironmentKit` core-zone kit | In-repo tactical fallback geometry (`client/js/assets/environment-kit.js`) | Project code | Mid, flanks, spawn-adjacent combat spaces | Shared tactical scale, zone-tagged placement, `visualProfile=semi-realistic-tactical` |
| `CharacterKit` silhouette kit | In-repo tactical fallback geometry (`client/js/assets/character-kit.js`) | Project code | CT/T player silhouettes and bot fallback presentation | Shared origin, restrained team accents, layered torso/head/rig breakup |

## Sourcing rules for future imported assets

When real external assets are added, they must follow these rules:

1. Prefer open source or commercially usable free assets.
2. Record the exact source URL or package name here.
3. Record the license or usage terms here.
4. Normalize to shared gameplay scale before use.
5. Keep CT/T readability through accents and silhouette, not flat body recolors.
6. Preserve runtime fallback behavior so missing assets never break play.
