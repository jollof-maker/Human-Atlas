import type { CollectionId, SystemId } from '../types/anatomy'

export interface SystemMeta {
  id: SystemId
  label: string
  /** Singular noun used in descriptions ("part of the skeletal system"). */
  noun: string
  /** Bullet colour in the UI. */
  swatch: string
  /** Base material colour in the scene. */
  color: string
  roughness: number
}

/** Order here is the order of rows in the Systems panel. */
export const SYSTEMS: SystemMeta[] = [
  { id: 'skeleton', label: 'Skeleton', noun: 'skeletal system', swatch: '#D6CCB4', color: '#E6DFCF', roughness: 0.62 },
  { id: 'muscles', label: 'Muscles', noun: 'muscular system', swatch: '#B4675B', color: '#B9705F', roughness: 0.58 },
  { id: 'heart', label: 'Heart', noun: 'heart', swatch: '#8F3239', color: '#9A3C41', roughness: 0.5 },
  { id: 'sensory', label: 'Sensory organs', noun: 'sensory organs', swatch: '#6F978B', color: '#86A79C', roughness: 0.45 },
  { id: 'arteries', label: 'Arteries', noun: 'arterial system', swatch: '#C23B33', color: '#C4473D', roughness: 0.45 },
  { id: 'veins', label: 'Veins', noun: 'venous system', swatch: '#3F6595', color: '#4C6E9A', roughness: 0.45 },
  { id: 'nervous', label: 'Nervous system', noun: 'nervous system', swatch: '#CDAE4F', color: '#D8BE6E', roughness: 0.55 },
  { id: 'respiratory', label: 'Respiratory', noun: 'respiratory system', swatch: '#C08E9A', color: '#CDA1AA', roughness: 0.55 },
]

export const SYSTEM_BY_ID = Object.fromEntries(SYSTEMS.map((s) => [s.id, s])) as Record<SystemId, SystemMeta>
export const SYSTEM_IDS = SYSTEMS.map((s) => s.id)

export const PRESETS: Record<'all' | 'skeleton' | 'organs', SystemId[]> = {
  all: SYSTEM_IDS,
  skeleton: ['skeleton'],
  organs: ['heart', 'sensory', 'nervous', 'respiratory'],
}

export interface CollectionMeta {
  id: CollectionId
  label: string
}

export const COLLECTIONS: CollectionMeta[] = [
  { id: 'hand', label: 'Hand' },
  { id: 'shoulder', label: 'Shoulder' },
  { id: 'thigh', label: 'Thigh' },
  { id: 'foot', label: 'Foot' },
  { id: 'heart', label: 'Heart' },
  { id: 'brain', label: 'Brain' },
]
