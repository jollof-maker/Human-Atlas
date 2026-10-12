import type { CollectionId } from '../types/anatomy'
import { inScope, useAtlas } from './store'
import { runtime } from './runtime'

let layoutTimer: number | undefined

/**
 * Choose a specimen collection: collapse anything exploded and frame the region
 * in place, then lay it out as its own specimen sheet. Choosing the active
 * collection again returns to the full body.
 */
export function chooseCollection(c: CollectionId | null) {
  window.clearTimeout(layoutTimer)
  const s = useAtlas.getState()
  if (c === null || s.collection === c) {
    useAtlas.setState({ collection: null, selected: null, isolated: false, explode: 0, scrubbing: false })
    return
  }
  useAtlas.setState({ collection: c, selected: null, isolated: false, explode: 0, scrubbing: false })
  layoutTimer = window.setTimeout(() => {
    if (useAtlas.getState().collection === c) useAtlas.getState().setExplode(1)
  }, 900)
}

/**
 * Select a structure from anywhere (search, relationship chips), making sure
 * it is actually visible first: its system is switched on, and an active
 * collection that does not contain it is left.
 */
export function revealAndSelect(key: string) {
  const s = useAtlas.getState()
  const st = s.data?.structureByKey.get(key)
  if (!st) return
  const patch: Partial<ReturnType<typeof useAtlas.getState>> = {}
  if (!s.systems[st.system]) patch.systems = { ...s.systems, [st.system]: true }
  if (s.side !== 'both' && st.side !== 'midline' && st.side !== s.side) patch.side = 'both'
  if (s.arms === 'hidden' && st.pieces.some((p) => s.data!.upperLimb.has(p.id))) patch.arms = 'down'
  const scope = { ...s, ...patch }
  if (s.collection && !st.pieces.some((p) => inScope(scope, p))) {
    window.clearTimeout(layoutTimer)
    patch.collection = null
  }
  if (s.isolated) patch.isolated = false
  useAtlas.setState({ ...patch, selected: key })
}

export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen?.()
}

export function resetView() {
  runtime.camera?.reset()
}
