import type { Box3, Vector3 } from 'three'
import type { AtlasData } from '../data/atlasData'
import { computeAtlasLayout, type AtlasLayout } from '../lib/atlasLayout'
import type { Vec3 } from '../types/anatomy'
import { effectiveArms, inScope, type AtlasState } from './store'

/**
 * Mutable, non-React runtime shared between the scene and the UI. Values here
 * may change every frame; React never re-renders because of them.
 */

export interface CameraApi {
  /** Tween camera + orbit target to frame a box. */
  frameBox: (box: Box3, opts?: { direction?: Vector3; duration?: number; padding?: number }) => void
  focusStructure: (key: string, opts?: { duration?: number }) => void
  frameCollection: () => void
  zoom: (factor: number) => void
  front: () => void
  reset: () => void
}

export const runtime = {
  camera: null as CameraApi | null,
  /** Tooltip DOM node, positioned imperatively from pointer events. */
  tooltip: null as HTMLDivElement | null,
  /** Global explode progress actually rendered (0..1, linear in time). */
  explodeProgress: 0,
  /** Linear tween driving explodeProgress; per-piece easing is applied on top. */
  explodeTween: { from: 0, to: 0, start: 0, dur: 1 },
  /** Linear tween for the arms pose (0 = down, 1 = raised); eased when applied. */
  armTween: { from: 0, to: 0, start: 0, dur: 1 },
  /** Humeral-head centres, the pivots for the raised pose. Set once geometry is built. */
  armPivots: { left: null as Vector3 | null, right: null as Vector3 | null },
  /** Whole-body bounds with the arms at pose `k` (0 down … 1 raised). */
  bodyBox: null as ((k: number) => Box3) | null,
  /** Assembled bounding box of the current scope, kept by the model. */
  scopeBox: null as Box3 | null,
  /** World-space bounds of a structure's meshes at their current positions. */
  structureBox: null as ((key: string) => Box3 | null) | null,
  /** Current viewport aspect, used for sheet proportions. */
  aspect: 16 / 9,
}

// ------------------------------------------------------------------- layout --

let cacheKey = ''
let cacheValue: AtlasLayout | null = null

/**
 * Specimen-sheet layout for the current scope. The full body uses one big
 * catalogue sheet centred on the body; a specimen collection gets its own,
 * smaller sheet centred where the region sits, so it unfolds in place.
 */
export function activeLayout(
  data: AtlasData,
  s: Pick<AtlasState, 'systems' | 'collection' | 'side' | 'arms' | 'data'>,
): AtlasLayout {
  const aspectBucket = Math.round(Math.min(2.4, Math.max(0.7, runtime.aspect * 1.05)) * 10) / 10
  const key = `${Object.values(s.systems).map(Number).join('')}|${s.collection}|${s.side}|${effectiveArms(s)}|${aspectBucket}`
  if (key === cacheKey && cacheValue) return cacheValue

  const scoped = data.entries.filter((e) => inScope(s, e))
  let center: Vec3 = [0, 0, 0]
  if (s.collection && scoped.length) {
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (const e of scoped) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], e.assembledPosition[k] - e.size[k] / 2)
        max[k] = Math.max(max[k], e.assembledPosition[k] + e.size[k] / 2)
      }
    }
    center = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
  }
  cacheValue = computeAtlasLayout(
    scoped.map((e) => ({ id: e.id, size: e.size, system: e.system, name: e.name })),
    { aspect: s.collection ? Math.min(aspectBucket, 1.9) : aspectBucket, center },
  )
  cacheKey = key
  return cacheValue
}

// ------------------------------------------------------------------- easing --

export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)
export const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t)

/** Duration of an explode transition covering `delta` of the full range. */
/** Duration of an arms pose change (matches a full explode transition's feel). */
export const ARM_DURATION = 1.0

export const explodeDuration = (delta: number, scrubbing: boolean) =>
  scrubbing ? 0.35 : 0.9 + 0.8 * Math.min(1, Math.abs(delta))
