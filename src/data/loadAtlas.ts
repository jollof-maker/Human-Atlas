import type { Manifest, ManifestEntry, SystemId, Vec3 } from '../types/anatomy'
import { computeAtlasLayout } from '../lib/atlasLayout'
import { indexManifest, type AtlasData } from './atlasData'
import { SYSTEMS } from './systems'

/**
 * Loader contract
 * ---------------
 * The app reads `public/anatomy/manifest.json` (written by
 * `npm run build:anatomy`). Each entry names a GLB in `public/anatomy/` that
 * contains a node whose name equals the entry id. To swap in other assets,
 * produce GLBs + a manifest with the same shape (src/types/anatomy.ts) and
 * drop them into public/anatomy/. No code changes are needed.
 *
 * If the manifest is missing, a clearly-labelled placeholder dataset of
 * abstract boxes is generated so the interface still runs.
 */
export async function loadAtlas(): Promise<AtlasData> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}anatomy/manifest.json`)
    if (!res.ok || !res.headers.get('content-type')?.includes('json')) throw new Error(`HTTP ${res.status}`)
    const manifest = (await res.json()) as Manifest
    return indexManifest(manifest)
  } catch (err) {
    console.warn('[Human Atlas] Anatomy manifest not found; using placeholder geometry. Run `npm run build:anatomy`.', err)
    return indexManifest(placeholderManifest(), true)
  }
}

function placeholderManifest(): Manifest {
  const entries: ManifestEntry[] = []
  SYSTEMS.forEach((sys, si) => {
    for (let i = 0; i < 6; i++) {
      const side = i % 3 === 0 ? 'midline' : i % 3 === 1 ? 'left' : 'right'
      const x = side === 'midline' ? 0 : (side === 'left' ? 1 : -1) * (0.08 + si * 0.02)
      const pos: Vec3 = [x, 0.7 - si * 0.2 - Math.floor(i / 3) * 0.08, 0]
      entries.push({
        id: `PH-${sys.id}-${i}`,
        name: `${side === 'midline' ? '' : side === 'left' ? 'Left ' : 'Right '}placeholder ${sys.label.toLowerCase()} block ${Math.floor(i / 3) + 1}`.trim(),
        system: sys.id as SystemId,
        category: 'Placeholder',
        region: 'Placeholder',
        side,
        sideSource: side === 'midline' ? 'none' : 'name',
        meshFile: '',
        assembledPosition: pos,
        explodedPosition: pos,
        size: [0.05 + (i % 2) * 0.03, 0.06 + (si % 3) * 0.05, 0.04],
        volume: null,
        concept: '',
        isA: [],
        partOf: [],
        collections: [],
        nearby: [],
        triangles: 12,
      })
    }
  })
  const layout = computeAtlasLayout(entries.map((e) => ({ id: e.id, size: e.size, system: e.system, name: e.name })))
  for (const e of entries) e.explodedPosition = layout.positions.get(e.id)!
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: { name: 'Placeholder', attribution: 'Placeholder geometry, no anatomical data.', license: '', licenseUrl: '' },
    bounds: { min: [-0.3, -0.9, -0.15], max: [0.3, 0.9, 0.15] },
    sheet: { width: layout.width, height: layout.height },
    systems: Object.fromEntries(
      SYSTEMS.map((s) => [s.id, { count: entries.filter((e) => e.system === s.id).length, file: '' }]),
    ) as Manifest['systems'],
    entries,
  }
}
