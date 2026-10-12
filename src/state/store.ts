import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { CollectionId, SystemId } from '../types/anatomy'
import type { AtlasData } from '../data/atlasData'
import { SYSTEM_IDS } from '../data/systems'

export type SideFilter = 'both' | 'left' | 'right'
export type CameraTool = 'orbit' | 'pan'
export type ArmsPose = 'down' | 'raised' | 'hidden'

/**
 * UI-level state only. Nothing here changes per frame: per-frame values
 * (opacities, positions, camera tweens) live on mutable runtime objects that
 * the render loop reads (see src/state/runtime.ts).
 */
export interface AtlasState {
  data: AtlasData | null
  /** Scene geometry is built and visible. */
  ready: boolean
  systems: Record<SystemId, boolean>
  collection: CollectionId | null
  side: SideFilter
  /** Upper-limb pose chosen by the user (see effectiveArms for what is shown). */
  arms: ArmsPose
  hovered: string | null
  selected: string | null
  isolated: boolean
  /** Explode target, 0..1. */
  explode: number
  /** True while the user is dragging the explode slider (short tweens). */
  scrubbing: boolean
  tool: CameraTool
  creditsOpen: boolean
  collectionsOpen: boolean

  setData: (d: AtlasData) => void
  toggleSystem: (id: SystemId) => void
  setSystems: (ids: SystemId[]) => void
  setCollection: (c: CollectionId | null) => void
  setSide: (s: SideFilter) => void
  setArms: (a: ArmsPose) => void
  hover: (key: string | null) => void
  select: (key: string | null) => void
  setIsolated: (v: boolean) => void
  setExplode: (v: number, scrubbing?: boolean) => void
  setTool: (t: CameraTool) => void
  setCreditsOpen: (v: boolean) => void
  setCollectionsOpen: (v: boolean) => void
}

const allOn = () => Object.fromEntries(SYSTEM_IDS.map((id) => [id, true])) as Record<SystemId, boolean>

export const useAtlas = create<AtlasState>()(
  subscribeWithSelector((set, get) => ({
    data: null,
    ready: false,
    systems: allOn(),
    collection: null,
    side: 'both',
    arms: 'down',
    hovered: null,
    selected: null,
    isolated: false,
    explode: 0,
    scrubbing: false,
    tool: 'orbit',
    creditsOpen: false,
    collectionsOpen: true,

    setData: (data) => set({ data }),
    toggleSystem: (id) => {
      const systems = { ...get().systems, [id]: !get().systems[id] }
      set({ systems, ...dropHiddenSelection(get(), systems) })
    },
    setSystems: (ids) => {
      const systems = Object.fromEntries(SYSTEM_IDS.map((id) => [id, ids.includes(id)])) as Record<SystemId, boolean>
      set({ systems, ...dropHiddenSelection(get(), systems) })
    },
    setCollection: (collection) => set({ collection, isolated: false, selected: null }),
    setSide: (side) => {
      const s = get()
      const st = s.selected ? s.data?.structureByKey.get(s.selected) : null
      const hidden = st && side !== 'both' && st.side !== 'midline' && st.side !== side
      set({ side, ...(hidden ? { selected: null, isolated: false } : {}) })
    },
    setArms: (arms) => {
      const s = get()
      const st = s.selected ? s.data?.structureByKey.get(s.selected) : null
      const hidden =
        st && effectiveArms({ ...s, arms }) === 'hidden' && st.pieces.every((p) => s.data!.upperLimb.has(p.id))
      set({ arms, ...(hidden ? { selected: null, isolated: false } : {}) })
    },
    hover: (hovered) => {
      if (get().hovered !== hovered) set({ hovered })
    },
    select: (selected) => set({ selected, isolated: selected ? get().isolated && get().selected === selected : false }),
    setIsolated: (isolated) => set({ isolated }),
    setExplode: (explode, scrubbing = false) => set({ explode: Math.min(1, Math.max(0, explode)), scrubbing }),
    setTool: (tool) => set({ tool }),
    setCreditsOpen: (creditsOpen) => set({ creditsOpen }),
    setCollectionsOpen: (collectionsOpen) => set({ collectionsOpen }),
  })),
)

/** If the selected structure's system gets hidden, drop the selection. */
function dropHiddenSelection(s: AtlasState, systems: Record<SystemId, boolean>) {
  if (!s.selected || !s.data) return {}
  const st = s.data.structureByKey.get(s.selected)
  return st && !systems[st.system] ? { selected: null, isolated: false } : {}
}

/** The Hand and Shoulder collections always show the arms down. */
export function effectiveArms(s: Pick<AtlasState, 'arms' | 'collection'>): ArmsPose {
  return s.collection === 'hand' || s.collection === 'shoulder' ? 'down' : s.arms
}

/** Is a piece in the current scope (system visible, side filter, collection, arms)? */
export function inScope(
  s: Pick<AtlasState, 'systems' | 'collection' | 'side' | 'arms' | 'data'>,
  e: { id: string; system: SystemId; collections: CollectionId[]; side: string },
) {
  if (!s.systems[e.system]) return false
  if (s.side !== 'both' && e.side !== 'midline' && e.side !== s.side) return false
  if (s.collection && !e.collections.includes(s.collection)) return false
  if (effectiveArms(s) === 'hidden' && s.data?.upperLimb.has(e.id)) return false
  return true
}
