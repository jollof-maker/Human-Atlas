import type { SystemId } from '../types/anatomy'
import type { AtlasData, Structure } from './atlasData'
import { ATTACHMENTS } from './attachments'
import { SYSTEM_BY_ID } from './systems'
import { isCardiac } from './cardiac'

/** Root word of each system's noun; a category sharing it makes "of the <system>" redundant. */
const SYSTEM_ROOT: Partial<Record<SystemId, RegExp>> = {
  heart: /\bheart\b/,
  arteries: /\barter/,
  veins: /\bvein/,
  muscles: /\bmuscle/,
  nervous: /\bnerve/,
}

/**
 * Categories that name a whole organ or structure while their pieces are parts
 * of it: a hippocampus is not "a brain", an epiglottis is not "a larynx", a
 * mitral leaflet is not "a heart valve". These pieces are described as part of
 * the whole. Categories naming a type (artery, muscle, bone, tooth …) are not
 * listed: each of their pieces is one of that type.
 */
const PART_OF_WHOLE: Record<string, string> = {
  Brain: 'A brain structure, part of the nervous system',
  'Spinal cord': 'A structure of the spinal cord',
  Larynx: 'A laryngeal structure, part of the respiratory system',
  Eye: 'A structure of the eye',
  Ear: 'A structure of the ear',
  // Walls and cavities of atria and ventricles.
  'Heart chamber': 'A structure of a heart chamber',
  // Cusps and leaflets of the cardiac valves.
  'Heart valve': 'A structure of a heart valve',
  // Interosseous membranes, parts of fibrous joints.
  Joint: 'A joint structure, part of the skeletal system',
}

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
  // Cardiac "left/right" names a chamber, not a body side: no side phrase for those.
  const side = s.side === 'midline' || s.pieces.some(isCardiac) ? '' : `, ${s.side} side`
  const category = s.category.toLowerCase()
  // "of the <system>" only when it adds something: "an artery of the arterial
  // system" or "a vein of the venous system" just repeats the category.
  const repeats = SYSTEM_ROOT[s.system]?.test(category) ?? false
  const system = repeats ? '' : ` of the ${SYSTEM_BY_ID[s.system].noun}`
  const lead = PART_OF_WHOLE[s.category] ?? `${article(s.category)} ${category}${system}`

  const lines: string[] = []
  lines.push(`${lead}, in the ${region}${side}.`)
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
