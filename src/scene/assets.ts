import { useGLTF } from '@react-three/drei'
import type { AtlasData } from '../data/atlasData'
import { SYSTEMS } from '../data/systems'

export const assetUrl = (file: string) => `${import.meta.env.BASE_URL}anatomy/${file}`

/** Start fetching every system GLB as soon as the manifest is known (cached by useGLTF). */
export function preloadAnatomy(data: AtlasData) {
  for (const s of SYSTEMS) useGLTF.preload(assetUrl(data.manifest.systems[s.id].file), false, true)
}
