import { useMemo } from 'react'
import { BoxGeometry, CapsuleGeometry, type BufferGeometry } from 'three'
import type { AtlasData } from '../data/atlasData'
import { PiecesModel, type GeometrySource } from './AnatomyModel'

/**
 * Placeholder geometry, used ONLY when public/anatomy/manifest.json is missing
 * (i.e. `npm run build:anatomy` has not been run). Every piece is an abstract
 * box or capsule sized from the placeholder manifest, so the whole interface
 * can be exercised without anatomy assets. Nothing here models real anatomy.
 */
export function PlaceholderAnatomy({ data }: { data: AtlasData }) {
  const source = useMemo<GeometrySource>(
    () => (entry) => {
      const [w, h, d] = entry.size
      const g: BufferGeometry =
        h > w * 2
          ? new CapsuleGeometry(Math.min(w, d) / 2, Math.max(0.001, h - Math.min(w, d)), 4, 12)
          : new BoxGeometry(w, h, d)
      g.translate(...entry.assembledPosition)
      g.computeBoundingBox()
      g.computeBoundingSphere()
      return g
    },
    [],
  )
  return <PiecesModel data={data} source={source} />
}
