import type { CollectionId, Manifest, ManifestEntry, Side, SystemId } from '../types/anatomy'
import { SYSTEM_IDS } from './systems'

/**
 * A "structure" is what a person means by one anatomical thing: every piece
 * that shares an English name and side. BodyParts3D often splits a structure
 * into several element files (e.g. 13 segments of one cerebellar artery);
 * hover, selection, search and isolation all work on structures.
 */
export interface Structure {
  key: string
  name: string
  title: string
  side: Side
  system: SystemId
  category: string
  region: string
  pieces: ManifestEntry[]
  collections: Set<CollectionId>
  volume: number | null
}

export interface AtlasData {
  manifest: Manifest
  entries: ManifestEntry[]
  byId: Map<string, ManifestEntry>
  structures: Structure[]
  structureByKey: Map<string, Structure>
  structureOfPiece: Map<string, Structure>
  /** Lower-case name (side included) -> structure, for resolving curated references. */
  structureByName: Map<string, Structure>
  systemCounts: Record<SystemId, number>
  placeholder: boolean
}

const MINOR = new Set(['of', 'the', 'and', 'to', 'with', 'in', 'on', 'for', 'a', 'an', 'at', 'from', 'by'])
const ROMAN = /^(i|ii|iii|iv|v|vi|vii|viii|ix|x|xi|xii)$/i

/** Editorial title case: "long head of right biceps brachii" -> "Long Head of Right Biceps Brachii". */
export function titleCase(name: string): string {
  return name
    .split(' ')
    .map((w, i) => {
      if (ROMAN.test(w)) return w.toUpperCase()
      if (i > 0 && MINOR.has(w.toLowerCase())) return w.toLowerCase()
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}

export const structureKey = (e: Pick<ManifestEntry, 'name' | 'side'>) => `${e.name.toLowerCase()}|${e.side}`

export function indexManifest(manifest: Manifest, placeholder = false): AtlasData {
  const entries = manifest.entries
  const byId = new Map(entries.map((e) => [e.id, e]))
  const structureByKey = new Map<string, Structure>()
  const structureOfPiece = new Map<string, Structure>()

  for (const e of entries) {
    const key = structureKey(e)
    let s = structureByKey.get(key)
    if (!s) {
      s = {
        key,
        name: e.name,
        title: titleCase(e.name),
        side: e.side,
        system: e.system,
        category: e.category,
        region: e.region,
        pieces: [],
        collections: new Set(),
        volume: null,
      }
      structureByKey.set(key, s)
    }
    s.pieces.push(e)
    for (const c of e.collections) s.collections.add(c)
    if (e.volume != null) s.volume = (s.volume ?? 0) + e.volume
    structureOfPiece.set(e.id, s)
  }

  // Region of a multi-piece structure = the region holding most of its pieces.
  for (const s of structureByKey.values()) {
    if (s.pieces.length < 2) continue
    const tally = new Map<string, number>()
    for (const p of s.pieces) tally.set(p.region, (tally.get(p.region) ?? 0) + 1)
    s.region = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  const structures = [...structureByKey.values()].sort((a, b) => a.name.localeCompare(b.name))
  const structureByName = new Map(structures.map((s) => [s.name.toLowerCase(), s]))
  const systemCounts = Object.fromEntries(SYSTEM_IDS.map((id) => [id, 0])) as Record<SystemId, number>
  for (const e of entries) systemCounts[e.system]++

  return {
    manifest,
    entries,
    byId,
    structures,
    structureByKey,
    structureOfPiece,
    structureByName,
    systemCounts,
    placeholder,
  }
}
