import type { CollectionId, Side, SystemId, Vec3 } from '../../src/types/anatomy'

/**
 * Body regions are derived geometrically from skeletal landmarks found in the
 * dataset itself (humerus, radius/ulna, hand bones, femur, tibia/fibula, foot
 * bones, atlas, sternum, sacrum ...). A piece's region is decided by where its
 * bounding-box centre falls relative to those landmarks. This is a coarse
 * topographic label, not an anatomical claim, and the UI presents it as such.
 */

export interface RegionPiece {
  id: string
  name: string
  system: SystemId
  category: string
  side: Side
  min: Vec3
  max: Vec3
  ancestors: string[]
}

type Box = { min: Vec3; max: Vec3 }
type Segment = { a: Vec3; b: Vec3; r: number }

const center = (b: Box): Vec3 => [
  (b.min[0] + b.max[0]) / 2,
  (b.min[1] + b.max[1]) / 2,
  (b.min[2] + b.max[2]) / 2,
]

function union(boxes: Box[]): Box | null {
  if (!boxes.length) return null
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const b of boxes) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], b.min[k])
      max[k] = Math.max(max[k], b.max[k])
    }
  }
  return { min, max }
}

function distToSegment(p: Vec3, s: Segment): number {
  const ab = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]]
  const ap = [p[0] - s.a[0], p[1] - s.a[1], p[2] - s.a[2]]
  const len2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1
  const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / len2))
  return Math.hypot(ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t)
}

const inBox = (p: Vec3, b: Box, pad: number) =>
  p[0] >= b.min[0] - pad && p[0] <= b.max[0] + pad &&
  p[1] >= b.min[1] - pad && p[1] <= b.max[1] + pad &&
  p[2] >= b.min[2] - pad && p[2] <= b.max[2] + pad

const HAND_BONE = /\b(scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal bone|phalanx of (left |right )?(thumb|index finger|middle finger|ring finger|little finger))\b/i
const FOOT_BONE = /\b(talus|calcaneus|navicular bone of|cuboid bone|cuneiform bone|metatarsal bone|phalanx of (left |right )?(big toe|second toe|third toe|fourth toe|little toe))\b/i

export function buildRegionResolver(pieces: RegionPiece[]) {
  const bones = pieces.filter((p) => p.system === 'skeleton')
  const find = (re: RegExp, side?: Side) =>
    union(bones.filter((p) => re.test(p.name) && (!side || p.side === side)))

  const atlas = find(/^atlas$/i)
  const mandible = find(/^mandible$/i)
  const manubrium = find(/^manubrium$/i)
  const t12 = find(/^twelfth thoracic vertebra$/i)
  const xiphoid = find(/^xiphoid process$/i)
  const sacrum = find(/^sacrum$/i)
  if (!atlas || !mandible || !manubrium || !sacrum) throw new Error('Missing trunk landmarks')

  const headY = atlas.max[1]
  const chinY = mandible.min[1]
  const neckY = manubrium.max[1]
  const thoraxY = t12 && xiphoid ? (t12.min[1] + xiphoid.min[1]) / 2 : (t12 ?? xiphoid ?? manubrium).min[1]
  const pelvisY = sacrum.max[1]
  const spineZ = center(atlas)[2]

  type Limb = {
    hand: Box; foot: Box
    shoulder: { c: Vec3; r: number }; hip: { c: Vec3; r: number }
    arm: Segment; forearm: Segment; thigh: Segment; leg: Segment
  }
  const limbs = {} as Record<'left' | 'right', Limb>
  for (const side of ['left', 'right'] as const) {
    const sideRe = (s: string) => new RegExp(`^${side} ${s}$`, 'i')
    const humerus = find(sideRe('humerus'))
    const forearm = union([find(sideRe('radius')), find(sideRe('ulna'))].filter(Boolean) as Box[])
    const femur = find(sideRe('femur'))
    const leg = union([find(sideRe('tibia')), find(sideRe('fibula'))].filter(Boolean) as Box[])
    const hand = union(bones.filter((p) => p.side === side && HAND_BONE.test(p.name)))
    const foot = union(bones.filter((p) => p.side === side && FOOT_BONE.test(p.name)))
    if (!humerus || !forearm || !femur || !leg || !hand || !foot) {
      throw new Error(`Missing ${side} limb landmarks`)
    }
    const axis = (b: Box, r: number): Segment => {
      const c = center(b)
      return { a: [c[0], b.max[1], c[2]], b: [c[0], b.min[1], c[2]], r }
    }
    const hc = center(humerus)
    const fc = center(femur)
    limbs[side] = {
      hand,
      foot,
      shoulder: { c: [hc[0], humerus.max[1] - 0.02, hc[2]], r: 0.1 },
      hip: { c: [fc[0] - Math.sign(fc[0]) * 0.03, femur.max[1] - 0.03, fc[2]], r: 0.09 },
      arm: axis(humerus, 0.075),
      forearm: axis(forearm, 0.065),
      thigh: axis(femur, 0.11),
      leg: axis(leg, 0.085),
    }
  }

  function regionOf(p: RegionPiece): string {
    const c = center(p)
    for (const side of ['left', 'right'] as const) {
      const L = limbs[side]
      // keep limb tests on the matching half of the body
      if (side === 'left' ? c[0] < 0.02 : c[0] > -0.02) continue
      if (inBox(c, L.hand, 0.02)) return 'Hand'
      if (inBox(c, L.foot, 0.025)) return 'Foot'
      if (distToSegment(c, L.forearm) < L.forearm.r) return 'Forearm'
      if (distToSegment(c, L.leg) < L.leg.r) return 'Leg'
      const ds = Math.hypot(c[0] - L.shoulder.c[0], c[1] - L.shoulder.c[1], c[2] - L.shoulder.c[2])
      if (ds < L.shoulder.r) return 'Shoulder'
      if (distToSegment(c, L.arm) < L.arm.r) return 'Arm'
      const dh = Math.hypot(c[0] - L.hip.c[0], c[1] - L.hip.c[1], c[2] - L.hip.c[2])
      if (dh < L.hip.r) return 'Hip'
      if (distToSegment(c, L.thigh) < L.thigh.r) return 'Thigh'
    }
    if (c[1] > headY || (c[1] > chinY && c[2] > spineZ)) return 'Head'
    if (c[1] > neckY) return 'Neck'
    if (c[1] > thoraxY) return 'Thorax'
    if (c[1] > pelvisY) return 'Abdomen'
    return 'Pelvis'
  }

  const SHOULDER_BONES = /^(left|right) (scapula|clavicle|humerus)$/i
  const HEART_VESSEL = /\b(coronary|cardiac vein|coronary sinus|interventricular branch|marginal branch|conus branch|diagonal branch|(atrial|ventricular) branch|vein of left ventricle|oblique vein of left atrium)\b/i
  const BRAIN_VESSEL = /\b(cerebr|cerebell|basilar|communicating artery|choroidal|pontine|labyrinthine|striate|thalam|callos|insular|sinus|angular gyrus|parietal artery|occipital artery|temporal branch|calcarine|precuneal|paracentral|orbitofrontal|prefrontal|frontal branch|central branch|sulcal)\b/i

  function collectionsOf(p: RegionPiece, region: string): CollectionId[] {
    const out: CollectionId[] = []
    if (region === 'Hand') out.push('hand')
    if (region === 'Shoulder' || SHOULDER_BONES.test(p.name)) out.push('shoulder')
    if (region === 'Thigh') out.push('thigh')
    if (region === 'Foot') out.push('foot')
    const vessel = p.system === 'arteries' || p.system === 'veins'
    if (
      p.system === 'heart' ||
      (vessel && (HEART_VESSEL.test(p.name) || p.ancestors.some((a) => /^(coronary artery|cardiac vein)$/i.test(a))))
    ) {
      out.push('heart')
    }
    if (region === 'Head' && (p.system === 'nervous' || (vessel && BRAIN_VESSEL.test(p.name) && center(p)[1] > chinY))) {
      out.push('brain')
    }
    return out
  }

  return { regionOf, collectionsOf, landmarks: { headY, chinY, neckY, thoraxY, pelvisY } }
}
