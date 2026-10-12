/**
 * Shared anatomy types. Imported by both the browser app and
 * `scripts/build-anatomy.ts`, so keep this file free of DOM / three imports.
 */

export type SystemId =
  | 'skeleton'
  | 'muscles'
  | 'heart'
  | 'sensory'
  | 'arteries'
  | 'veins'
  | 'nervous'
  | 'respiratory'

export type Side = 'left' | 'right' | 'midline'

export type Vec3 = [number, number, number]

/** Specimen collection keys (see Specimen collections panel). */
export type CollectionId = 'hand' | 'shoulder' | 'thigh' | 'foot' | 'heart' | 'brain'

export interface ManifestEntry {
  /** BodyParts3D element file id, e.g. "FJ1252" (or "FJ1451M" for mirrored pieces). */
  id: string
  /** English name from the BodyParts3D tables / OBJ header. */
  name: string
  system: SystemId
  /** Fine category label shown in the UI ("Bone", "Muscle", "Artery" ...). */
  category: string
  /** Coarse body region computed from skeletal landmarks ("Thorax", "Forearm" ...). */
  region: string
  side: Side
  /** How `side` was established: from the name, a mirrored file pair (…M), or a hand-checked correction. */
  sideSource: 'name' | 'mirror' | 'correction' | 'none'
  /**
   * Present when scripts/anatomy-corrections.json overrides BodyParts3D's name
   * and side for this piece. `originalName` is the name as BodyParts3D ships it.
   */
  correction?: { originalName: string; reason: string; note?: string }
  /** GLB file (relative to /anatomy/) containing a node named `id`. */
  meshFile: string
  /** Bounding-box centre of the piece in the assembled body (scene units = metres). */
  assembledPosition: Vec3
  /** Centre of the piece's slot on the full atlas specimen sheet. */
  explodedPosition: Vec3
  /** Bounding-box size (metres). */
  size: Vec3
  /** Volume in cm³ as reported by BodyParts3D, if present. */
  volume: number | null
  /** FMA concept id the piece represents. */
  concept: string
  /** Nearest is_a ancestors (most specific first), from the FMA tables. */
  isA: string[]
  /** part_of ancestors (most specific first), from the FMA tables. */
  partOf: string[]
  collections: CollectionId[]
  /** Pieces whose surfaces come within a few mm. Geometric proximity only. */
  nearby: string[]
  triangles: number
}

export interface Manifest {
  version: number
  generatedAt: string
  source: {
    name: string
    attribution: string
    license: string
    licenseUrl: string
  }
  /** Overall assembled body bounds (metres). */
  bounds: { min: Vec3; max: Vec3 }
  /** Full-atlas sheet bounds (metres). */
  sheet: { width: number; height: number }
  systems: Record<SystemId, { count: number; file: string }>
  entries: ManifestEntry[]
}
