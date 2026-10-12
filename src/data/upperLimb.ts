import type { ManifestEntry } from '../types/anatomy'

/**
 * Upper-limb membership for the "Arms" pose control.
 *
 * Core limb: every piece whose manifest region is Arm, Forearm or Hand. Side
 * comes from the manifest; the few hand pieces the dataset leaves unsided
 * ("set of dorsal digital arteries" etc.) take their side from position
 * (+X is the patient's left), as do pieces whose name contradicts where they
 * actually are (see MIDLINE_TOLERANCE).
 *
 * Shoulder-crossing pieces move with the limb too, but are faded while the
 * arms are raised, because a rigid rotation visibly tears them at the shoulder:
 * deltoid, pectoralis major, latissimus dorsi (not present in BodyParts3D),
 * teres major, coracobrachialis, both heads of biceps, the long head of
 * triceps, and the axillary and circumflex humeral vessels.
 *
 * Deliberately NOT moved: scapula, clavicle, the rotator cuff (supraspinatus,
 * infraspinatus, teres minor, subscapularis) and the scapular/thoraco-acromial
 * vessels. They belong to the shoulder girdle, which stays put; this is the
 * main reason the raised pose is only approximate.
 */

export type LimbSide = 'left' | 'right'

export interface LimbMembership {
  side: LimbSide
  /** Crosses the shoulder: moves with the arm but is faded in the raised pose. */
  crossing: boolean
}

const LIMB_REGIONS = new Set(['Arm', 'Forearm', 'Hand'])
/** Metres from the mid-sagittal plane beyond which position overrides a contradicting name. */
const MIDLINE_TOLERANCE = 0.05

const CROSSING = new RegExp(
  [
    '^(acromial|clavicular|spinal) part of (left|right) deltoid$',
    '^(clavicular|sternocostal|abdominal) part of (left|right) pectoralis major$',
    '^(left|right) latissimus dorsi$',
    '^(left|right) teres major$',
    '^(left|right) coracobrachialis$',
    '^(long|short) head of (left|right) biceps brachii$',
    '^long head of (left|right) triceps brachii$',
    '^(left|right) axillary (artery|vein)$',
    '^(left|right) (anterior|posterior) circumflex humeral (artery|vein)$',
  ].join('|'),
  'i',
)

export function classifyUpperLimb(entries: ManifestEntry[]): Map<string, LimbMembership> {
  const out = new Map<string, LimbMembership>()
  for (const e of entries) {
    const crossing = CROSSING.test(e.name)
    if (!crossing && !LIMB_REGIONS.has(e.region)) continue
    const x = e.assembledPosition[0]
    const bySide: LimbSide | null = e.side === 'left' || e.side === 'right' ? e.side : null
    const byPosition: LimbSide = x > 0 ? 'left' : 'right'
    // Which shoulder a piece swings about is physical, so position wins when it
    // clearly contradicts the name: BodyParts3D swaps the names of the flexor
    // pollicis brevis pair (FJ1469 "Left …" lies in the right hand, FJ1469M the reverse).
    const contradicts = bySide !== null && bySide !== byPosition && Math.abs(x) > MIDLINE_TOLERANCE
    const side: LimbSide | null = contradicts ? byPosition : (bySide ?? (e.region === 'Hand' ? byPosition : null))
    if (side) out.set(e.id, { side, crossing })
  }
  return out
}
