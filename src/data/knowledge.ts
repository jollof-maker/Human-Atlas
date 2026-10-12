import type { AtlasData, Structure } from './atlasData'
import { ATTACHMENTS } from './attachments'
import { SYSTEM_BY_ID } from './systems'

/**
 * Descriptions are composed only from data we actually have: the category and
 * region, the FMA is_a / part_of ancestors shipped with BodyParts3D, piece
 * count, measured size and reported volume. No free-form prose is invented.
 */
export function describe(s: Structure): string[] {
  const first = s.pieces[0]
  const plain = s.name.toLowerCase().replace(/\b(left|right) /, '')
  const kind = first.isA.find((n) => n.toLowerCase() !== plain && n.toLowerCase() !== s.name.toLowerCase())
  const part = first.partOf.find((n) => n.toLowerCase() !== plain)
  const region = s.region.toLowerCase()
  const side = s.side === 'midline' ? '' : `, ${s.side} side`
  const system = SYSTEM_BY_ID[s.system].noun

  const lines: string[] = []
  lines.push(`${article(s.category)} ${s.category.toLowerCase()} of the ${system}, in the ${region}${side}.`)
  if (kind || part) {
    const bits = [kind && `a kind of ${kind}`, part && `part of the ${part}`].filter(Boolean)
    lines.push(`The Foundational Model of Anatomy classifies it as ${bits.join(', and ')}.`)
  }

  const size = extent(s)
  const n = s.pieces.length
  const pieces = n === 1 ? 'one piece' : `${n} pieces`
  const vol = s.volume != null && s.volume > 0.05 ? `, ${formatVolume(s.volume)}` : ''
  lines.push(`Modeled as ${pieces}, about ${Math.round(size * 1000)} mm across${vol}.`)
  return lines
}

function article(word: string) {
  return /^[aeiou]/i.test(word) ? 'An' : 'A'
}

function formatVolume(v: number) {
  return v >= 10 ? `${Math.round(v)} cm³` : `${v.toFixed(1)} cm³`
}

/** Largest dimension of the structure's assembled bounding box, in metres. */
export function extent(s: Structure): number {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (const p of s.pieces) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], p.assembledPosition[k] - p.size[k] / 2)
      max[k] = Math.max(max[k], p.assembledPosition[k] + p.size[k] / 2)
    }
  }
  return Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2])
}

// ---------------------------------------------------------------- relations --

export interface Relations {
  origin: Structure[]
  insertion: Structure[]
  supply: Structure[]
  /** For bones: muscles whose curated attachments include this bone. */
  attachedMuscles: Structure[]
  /** Geometric proximity only. */
  nearby: Structure[]
}

interface RelationIndex {
  muscles: Map<string, { origin: Structure[]; insertion: Structure[]; supply: Structure[] }>
  bones: Map<string, Set<Structure>>
}

const indexCache = new WeakMap<AtlasData, RelationIndex>()

function relationIndex(data: AtlasData): RelationIndex {
  const cached = indexCache.get(data)
  if (cached) return cached
  const muscles: RelationIndex['muscles'] = new Map()
  const bones: RelationIndex['bones'] = new Map()
  const find = (name: string, side: string) => data.structureByName.get(name.replace('{side}', side).toLowerCase())
  const resolve = (names: string[], side: string) =>
    names.map((n) => find(n, side)).filter((s): s is Structure => Boolean(s))

  for (const rec of ATTACHMENTS) {
    for (const side of ['left', 'right']) {
      const muscle = find(rec.muscle, side)
      if (!muscle) continue
      const entry = {
        origin: resolve(rec.origin, side),
        insertion: resolve(rec.insertion, side),
        supply: resolve(rec.supply, side),
      }
      muscles.set(muscle.key, entry)
      for (const b of [...entry.origin, ...entry.insertion]) {
        if (!bones.has(b.key)) bones.set(b.key, new Set())
        bones.get(b.key)!.add(muscle)
      }
    }
  }
  const index = { muscles, bones }
  indexCache.set(data, index)
  return index
}

export function relationsFor(data: AtlasData, s: Structure): Relations {
  const idx = relationIndex(data)
  const m = idx.muscles.get(s.key)
  const attached = [...(idx.bones.get(s.key) ?? [])].sort((a, b) => a.name.localeCompare(b.name))

  const verified = new Set<string>([
    ...(m ? [...m.origin, ...m.insertion, ...m.supply].map((x) => x.key) : []),
    ...attached.map((x) => x.key),
  ])
  const nearby: Structure[] = []
  const seen = new Set<string>([s.key])
  for (const p of s.pieces) {
    for (const id of p.nearby) {
      const other = data.structureOfPiece.get(id)
      if (!other || seen.has(other.key) || verified.has(other.key)) continue
      seen.add(other.key)
      nearby.push(other)
    }
  }

  return {
    origin: m?.origin ?? [],
    insertion: m?.insertion ?? [],
    supply: m?.supply ?? [],
    attachedMuscles: attached,
    nearby: nearby.slice(0, 6),
  }
}
