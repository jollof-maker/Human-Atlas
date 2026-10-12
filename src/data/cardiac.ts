import type { CollectionId, SystemId } from '../types/anatomy'

/**
 * Heart-system structures, coronary arteries and cardiac veins: exactly the
 * Heart collection. Their "left"/"right" names a heart chamber or the coronary
 * artery it follows, not a body side, so the side filter treats them as midline
 * and the UI does not describe them as being on the left or right of the body.
 */
export function isCardiac(e: { system: SystemId; collections: CollectionId[] }): boolean {
  return e.system === 'heart' || e.collections.includes('heart')
}
