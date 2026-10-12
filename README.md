# Human Atlas

A full-screen 3D human anatomy explorer built on the BodyParts3D dataset. You can orbit the assembled body, toggle eight systems, open specimen collections region by region, and explode every piece onto a catalogued specimen sheet.

React · TypeScript · Vite · three.js · @react-three/fiber · drei · Framer Motion

## Quick start (PowerShell)

```powershell
npm install
npm run build:anatomy   # OBJ → GLB + manifest (about 25 s). Needs assets/anatomy/raw, see below
npm run dev             # http://localhost:5173
```

Other scripts: `npm run build` (type-check + production bundle), `npm run preview`, `npm run lint`.

## Controls

| Action | Mouse / touch | Keyboard |
| --- | --- | --- |
| Orbit · pan · zoom | drag · right-drag · scroll (pinch on touch) | `O` orbit tool, `P` pan tool, `+` / `−` |
| Inspect a structure | click / tap | |
| Search | | `/` |
| Front view · reset camera | toolbar | `F` · `R` |
| Isolate selection | info panel | `I` |
| Step back (close / un-isolate / deselect / leave collection) | click empty space | `Esc` |

## Anatomy asset pipeline

`scripts/build-anatomy.ts` reads the raw BodyParts3D 4.0 download:

```
assets/anatomy/raw/
  isa_BP3D_4.0_obj_99/FJ*.obj        one mesh per element file id (FJ…M = mirrored partner)
  isa_element_parts.txt              FJ id → is_a concept
  partof_element_parts.txt           FJ id → part_of concept
  isa_parts_list_e.txt               concept → English name
  partof_parts_list_e.txt            concept → English name
  *_inclusion_relation_list.txt      concept hierarchies
```

For each OBJ it:

1. **Parses** the mesh and its header (English name, FMA concept, volume). It converts BodyParts3D millimetres (+X patient-left, −Y anterior, +Z up) to scene metres (+Y up, +Z anterior) and repairs inconsistent winding. Unnamed files fall back to the most specific concept in the element tables.
2. **Classifies** the piece into one of 8 systems: skeleton, muscles, heart, sensory organs, arteries, veins, nervous system, respiratory. Ordered rules in `scripts/lib/classify.ts` match the name and the FMA `is_a` / `part_of` ancestors. Nothing is guessed. Pieces outside those systems (digestive, urogenital, endocrine/lymphoid, integument) are written to `assets/anatomy/build-logs/unclassified.json` with the reason and their ancestors. In the current build that is 136 pieces.
3. **Detects side** from the name ("left"/"right"). Only for the dataset's explicit unnamed mirror pairs (`FJxxxx` / `FJxxxxM`) is side read from geometry; the manifest records this as `sideSource: "mirror"`.
4. **Applies hand-checked corrections** from `scripts/anatomy-corrections.json`, where BodyParts3D's name or side is clearly wrong for the geometry (for example the swapped flexor pollicis brevis pair). Each entry records its evidence, and the build refuses a correction that contradicts the mesh position. The original BodyParts3D name stays in the manifest (`correction.originalName`) and appears in the info panel.
5. **Drops exact duplicates** (identical meshes filed under two ids) to prevent z-fighting, logging them to `build-logs/duplicates.json`.
6. **Assigns a coarse region** (Head, Thorax, Forearm, Hand …) and **specimen collections** from skeletal landmarks found in the data (`scripts/lib/regions.ts`).
7. **Computes "nearby" structures** from sampled surface proximity (< 4 mm). This is geometry only and is never presented as an anatomical connection.
8. **Lays out the atlas sheet** (`src/lib/atlasLayout.ts`, shared with the app) to produce `explodedPosition`.
9. **Writes one GLB per system**: welded, simplified with meshoptimizer, quantized, and meshopt-compressed. 2,092 pieces, about 1.48 M triangles, about 17 MB in total. The simplification error is adjustable: `npm run build:anatomy -- --error 0.004` (fraction of each piece's radius).

`build-logs/build-report.txt` lists counts per system, region, collection, side and category.

### Manifest and loader contract

`public/anatomy/manifest.json` (types in `src/types/anatomy.ts`):

```ts
{ id, name, system, category, region, side, sideSource, meshFile,
  assembledPosition, explodedPosition, size, volume, concept, isA, partOf,
  collections, nearby, triangles }
```

`meshFile` names a GLB in `public/anatomy/` that contains a node whose name is the entry `id`. To use other assets, produce GLBs and a manifest of the same shape and drop them in; no code changes are needed. The loader (`src/data/loadAtlas.ts`) fetches the manifest. If the manifest is missing, it falls back to clearly labelled placeholder boxes (`src/scene/Placeholder.tsx`) so the interface still runs. These boxes are not anatomy.

## Data honesty

- **Descriptions** are composed only from data the build has: category, region, the FMA `is_a` / `part_of` ancestors, piece count, measured size and reported volume (`src/data/knowledge.ts`).
- **Attachments** (origin, insertion, arterial supply, plus the reverse "attached muscles" on bones) come from a small hand-curated table of textbook-standard limb and girdle anatomy in `src/data/attachments.ts`. It is resolved against manifest names, and unresolved names are dropped. The UI labels this data "Curated". **Have an anatomist review this table before relying on it.**
- **Nearby** chips are dashed and captioned "Proximity only, not a verified connection".
- Regions are topographic labels derived from landmarks, not anatomical claims.

## Architecture

```
scripts/                 asset build (Node, tsx)
src/types/anatomy.ts     manifest types (shared with scripts)
src/lib/atlasLayout.ts   specimen-sheet layout (shared with scripts)
src/data/                manifest indexing, systems, curated attachments, descriptions
src/state/store.ts       zustand UI state (never updated per frame)
src/state/runtime.ts     mutable per-frame runtime: explode tween, camera API, layout cache
src/state/actions.ts     choreographed actions (collections, reveal-and-select)
src/scene/AnatomyModel   GLB → per-piece meshes; one useFrame drives position, fade, dim, hover
src/scene/CameraRig      OrbitControls (damped), tweens, focusOnObject, UI-aware framing
src/ui/                  floating panels
```

- **Structures:** pieces sharing a name and side, for example the 13 segments of one artery, form a structure. Hover, selection, search and isolation work on structures.
- **Camera framing:** framing fits boxes into the screen area not covered by panels, so specimens never sit under the UI. `runtime.camera.focusStructure(key)` computes bounds at the structure's destination, picks a viewing distance from the field of view, and tweens `camera.position` and `controls.target` (easeInOutCubic, about 850 ms). The projection is also offset while the info panel is open.
- **Explode:** a linear global tween is re-eased per piece with a size-ordered stagger, so large specimens lead. Pieces that are hidden collapse while invisible, so they never pop in at stale positions. Collections get their own sheet, centred on the region.
- **Selection:** dims everything else and draws a faint x-ray silhouette, so structures behind other anatomy stay legible.

### Performance

- **Caching:** GLBs are cached and preloaded via `useGLTF`.
- **Raycasting:** geometry is baked to Float32 for raycasting, and BVHs (three-mesh-bvh) are built in idle time.
- **Per-frame work:** it lives in one `useFrame` loop over mutable objects. Matrices are updated only when a piece moves, and hidden pieces skip both rendering and raycasting.
- **Culling:** frustum culling is on. Instancing does not apply because every mesh is unique; the build-time simplification budget serves as the LOD.
- **Adaptive quality:** `PerformanceMonitor` lowers the DPR and drops ambient occlusion (N8AO) when frame rate falls; AO is always off on phones.

## Credits

Anatomical models:

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International

License: [BodyParts3D license page](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html) (updated 2025-02-27) · [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The GLBs in `public/anatomy/` are modified from the original OBJ files: converted, simplified, recentred, recoloured and grouped. The in-app **Sources & credits** panel shows the same attribution.

The OBJ headers in older downloads still cite CC BY-SA 2.1 Japan; the current license page supersedes them.
