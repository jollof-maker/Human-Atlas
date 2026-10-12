import type { SystemId, Vec3 } from '../types/anatomy'

/**
 * Atlas ("specimen sheet") layout.
 *
 * Pieces are laid out flat on the XY plane, facing the camera, in catalogued
 * rows: they are bucketed into size bands (largest band on top), and within a
 * band grouped by system and name so related specimens sit next to each other.
 * Rows that are nearly full are justified to the sheet width, which gives the
 * plate a tidy, printed look.
 *
 * Shared by the build script (full-body sheet written to the manifest) and the
 * app (region sheets and re-packing when systems are hidden).
 */

export interface LayoutItem {
  id: string
  size: Vec3
  system: SystemId
  name: string
}

export interface AtlasLayout {
  positions: Map<string, Vec3>
  width: number
  height: number
  /** Sheet centre in scene coordinates. */
  center: Vec3
}

const SYSTEM_ORDER: SystemId[] = [
  'skeleton',
  'muscles',
  'heart',
  'respiratory',
  'arteries',
  'veins',
  'nervous',
  'sensory',
]

/** Band thresholds on the piece's largest in-plane dimension (metres). */
const BANDS = [0.32, 0.16, 0.08, 0.04, 0.018, 0]

export function computeAtlasLayout(
  items: LayoutItem[],
  options: { aspect?: number; center?: Vec3 } = {},
): AtlasLayout {
  const aspect = options.aspect ?? 2.1
  const center = options.center ?? [0, 0, 0]
  const positions = new Map<string, Vec3>()
  if (items.length === 0) return { positions, width: 0, height: 0, center }

  const extent = (it: LayoutItem) => Math.max(it.size[0], it.size[1])
  const bandOf = (it: LayoutItem) => BANDS.findIndex((t) => extent(it) >= t)

  let bands: LayoutItem[][] = BANDS.map(() => [])
  for (const it of items) bands[bandOf(it)].push(it)
  // A band with only a handful of pieces reads as a stray row; fold it into the next one.
  bands = bands.filter((b) => b.length)
  for (let i = 0; i < bands.length - 1; i++) {
    if (bands[i].length < 4) {
      bands[i + 1].unshift(...bands[i])
      bands[i] = []
    }
  }
  bands = bands.filter((b) => b.length)

  // Within a band: by system, then by name with the side removed, so left/right
  // pairs sit next to each other like a printed catalogue.
  const base = (n: string) => n.toLowerCase().replace(/\b(left|right) /, '')
  for (const band of bands) {
    band.sort(
      (a, b) =>
        SYSTEM_ORDER.indexOf(a.system) - SYSTEM_ORDER.indexOf(b.system) ||
        base(a.name).localeCompare(base(b.name), 'en', { numeric: true }) ||
        a.name.localeCompare(b.name) ||
        b.size[1] - a.size[1],
    )
  }

  const gapFor = (bandMax: number) => Math.min(0.06, Math.max(0.007, bandMax * 0.16))

  // Sheet width from the total footprint so the plate lands near `aspect`.
  let area = 0
  for (const band of bands) {
    if (!band.length) continue
    const g = gapFor(Math.max(...band.map((i) => i.size[1])))
    for (const it of band) area += (it.size[0] + g) * (it.size[1] + g * 1.6)
  }
  const widest = Math.max(...items.map((i) => i.size[0]))
  const width = Math.max(widest, Math.sqrt(area * aspect))

  type Row = { items: LayoutItem[]; height: number; used: number; gap: number; last: boolean }
  const rows: Row[] = []
  const bandBreaks = new Set<number>()

  for (const band of bands) {
    if (!band.length) continue
    const bandMax = Math.max(...band.map((i) => i.size[1]))
    const gap = gapFor(bandMax)
    let row: Row = { items: [], height: 0, used: 0, gap, last: false }
    for (const it of band) {
      const w = it.size[0]
      if (row.items.length && row.used + gap + w > width) {
        rows.push(row)
        row = { items: [], height: 0, used: 0, gap, last: false }
      }
      row.used += (row.items.length ? gap : 0) + w
      row.height = Math.max(row.height, it.size[1])
      row.items.push(it)
    }
    row.last = true
    rows.push(row)
    bandBreaks.add(rows.length - 1)
  }

  // Place rows top-down; sheet origin is its top-left corner for now.
  let y = 0
  const placed: { id: string; x: number; y: number }[] = []
  rows.forEach((row, ri) => {
    const justify = !row.last || row.used > width * 0.82
    const spare = width - row.used
    const extraGap = justify && row.items.length > 1 ? spare / (row.items.length - 1) : 0
    let x = justify ? 0 : spare / 2
    const cy = y - row.height / 2
    for (const it of row.items) {
      placed.push({ id: it.id, x: x + it.size[0] / 2, y: cy })
      x += it.size[0] + row.gap + extraGap
    }
    y -= row.height + row.gap * 1.6 + (bandBreaks.has(ri) ? row.gap * 0.9 : 0)
  })
  const height = -y

  for (const p of placed) {
    positions.set(p.id, [center[0] + p.x - width / 2, center[1] + p.y + height / 2, center[2]])
  }
  return { positions, width, height, center }
}
