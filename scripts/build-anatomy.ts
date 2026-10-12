/**
 * Human Atlas — anatomy asset build.
 *
 *   npm run build:anatomy            (all pieces)
 *   npm run build:anatomy -- --error 0.003   (simplification error, fraction of piece radius)
 *
 * Input   assets/anatomy/raw/isa_BP3D_4.0_obj_99/*.obj        BodyParts3D 4.0 OBJ (one per element file id)
 *         assets/anatomy/raw/isa_element_parts.txt            FJ file id  -> is_a concept
 *         assets/anatomy/raw/partof_element_parts.txt         FJ file id  -> part_of concept
 *         assets/anatomy/raw/isa_parts_list_e.txt             concept     -> English name
 *         assets/anatomy/raw/partof_parts_list_e.txt          concept     -> English name
 *         assets/anatomy/raw/*_inclusion_relation_list.txt    concept hierarchies
 *
 * Output  public/anatomy/<system>.glb      one GLB per system, one node per piece (node name = FJ id),
 *                                          meshopt-compressed, simplified with meshoptimizer
 *         public/anatomy/manifest.json     one entry per piece (see src/types/anatomy.ts)
 *         assets/anatomy/build-logs/unclassified.json   pieces not placed into any of the 8 systems
 *         assets/anatomy/build-logs/build-report.txt    counts, triangle budgets, landmark values
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { meshopt, simplify, weld, prune } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import { parseObj, type ObjMesh } from './lib/obj.ts'
import { classify, sideFromName, RULES } from './lib/classify.ts'
import { buildRegionResolver, type RegionPiece } from './lib/regions.ts'
import { computeAtlasLayout } from '../src/lib/atlasLayout.ts'
import type { Manifest, ManifestEntry, Side, SystemId, Vec3 } from '../src/types/anatomy.ts'

const ROOT = resolve(import.meta.dirname, '..')
const RAW = join(ROOT, 'assets/anatomy/raw')
const OBJ_DIR = join(RAW, 'isa_BP3D_4.0_obj_99')
const OUT = join(ROOT, 'public/anatomy')
const LOGS = join(ROOT, 'assets/anatomy/build-logs')

const args = process.argv.slice(2)
const argValue = (k: string, d: number) => {
  const i = args.indexOf(k)
  return i >= 0 ? parseFloat(args[i + 1]) : d
}
const SIMPLIFY_ERROR = argValue('--error', 0.0025)

/** Hand-checked fixes to BodyParts3D names/sides (see the file's $comment). */
interface Correction {
  id: string
  name: string
  side: Side
  comment: string
  /** Optional caveat shown verbatim in the info panel. */
  note?: string
}
const CORRECTIONS = new Map<string, Correction>(
  (JSON.parse(readFileSync(join(ROOT, 'scripts/anatomy-corrections.json'), 'utf8')).corrections as Correction[]).map(
    (c) => [c.id, c],
  ),
)

const SYSTEMS: SystemId[] = ['skeleton', 'muscles', 'heart', 'sensory', 'arteries', 'veins', 'nervous', 'respiratory']

/** Ancestors too generic to be useful in descriptions. */
const GENERIC = /^(anatomical (entity|structure|set|cluster)|physical anatomical entity|material anatomical entity|organ|organ part|cardinal organ part|organ region|organ segment|organ zone|organ component|organ component layer|region of organ component|set of organ (regions|parts)|solid organ|cavitated organ|nonparenchymatous organ|parenchymatous organ|organ with (cavitated organ parts|organ cavity)|cell part cluster|organ part cluster|organ component cluster|anatomical boundary entity|immaterial anatomical entity|subdivision of .*tree|region of vascular tree organ)$/i

// ------------------------------------------------------------------- tables --
function readTable(file: string): string[][] {
  return readFileSync(join(RAW, file), 'utf8')
    .split(/\r?\n/)
    .slice(1)
    .filter(Boolean)
    .map((l) => l.split('\t'))
}

const names = new Map<string, string>()
const isaParents = new Map<string, string[]>()
const partofParents = new Map<string, string[]>()
for (const [p, pn, c, cn] of readTable('isa_inclusion_relation_list.txt')) {
  names.set(p, pn); names.set(c, cn)
  isaParents.set(c, [...(isaParents.get(c) ?? []), p])
}
for (const [p, pn, c, cn] of readTable('partof_inclusion_relation_list.txt')) {
  names.set(p, pn); names.set(c, cn)
  partofParents.set(c, [...(partofParents.get(c) ?? []), p])
}
for (const [c, , en] of [...readTable('isa_parts_list_e.txt'), ...readTable('partof_parts_list_e.txt')]) names.set(c, en)

function elementIndex(file: string) {
  const byFile = new Map<string, string[]>()
  const size = new Map<string, number>()
  for (const [c, n, fj] of readTable(file)) {
    if (!names.has(c)) names.set(c, n)
    byFile.set(fj, [...(byFile.get(fj) ?? []), c])
    size.set(c, (size.get(c) ?? 0) + 1)
  }
  /** Most specific concept containing this file = the one with the fewest element files. */
  return (fj: string) => {
    const cands = byFile.get(fj) ?? []
    return cands.sort((a, b) => size.get(a)! - size.get(b)!)[0] ?? null
  }
}
const isaConceptOf = elementIndex('isa_element_parts.txt')
const partofConceptOf = elementIndex('partof_element_parts.txt')

/** Breadth-first ancestors, nearest first. */
function ancestors(start: string | null, parents: Map<string, string[]>): string[] {
  if (!start) return []
  const out: string[] = []
  const seen = new Set([start])
  let frontier = [start]
  while (frontier.length) {
    const next: string[] = []
    for (const c of frontier) {
      for (const p of parents.get(c) ?? []) {
        if (seen.has(p)) continue
        seen.add(p)
        out.push(p)
        next.push(p)
      }
    }
    frontier = next
  }
  return out
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// ------------------------------------------------------------------- parse --
interface Piece {
  id: string
  name: string
  concept: string
  mesh: ObjMesh
  min: Vec3
  max: Vec3
  isA: string[]
  partOf: string[]
  ancestorNames: string[]
  system: SystemId | null
  category: string
  rule: number
  side: Side
  sideSource: ManifestEntry['sideSource']
  /** Set when anatomy-corrections.json overrides BodyParts3D's name/side. */
  correction: ManifestEntry['correction']
}

const t0 = Date.now()
const files = readdirSync(OBJ_DIR).filter((f) => f.toLowerCase().endsWith('.obj')).sort()
console.log(`Reading ${files.length} OBJ files…`)

const pieces: Piece[] = []
for (const [i, f] of files.entries()) {
  const id = f.replace(/\.obj$/i, '')
  const mesh = parseObj(readFileSync(join(OBJ_DIR, f), 'utf8'))
  const baseId = id.replace(/M$/, '')
  const elementConcept = isaConceptOf(id) ?? isaConceptOf(baseId)
  const concept = mesh.header.conceptId || elementConcept || ''
  const rawName = mesh.header.name || (elementConcept ? names.get(elementConcept) ?? '' : '')
  const sourceName = capitalize(rawName.trim())
  const fix = CORRECTIONS.get(id)
  const name = fix ? fix.name : sourceName

  const isaStart = isaParents.has(concept) ? concept : elementConcept
  const isaChain = [
    ...(isaStart && isaStart !== concept ? [isaStart] : []),
    ...ancestors(isaStart, isaParents),
  ]
  const pConcept = partofConceptOf(id) ?? partofConceptOf(baseId)
  const partChain = [...(pConcept && pConcept !== concept ? [pConcept] : []), ...ancestors(pConcept, partofParents)]
  const ancestorNames = [...isaChain, ...partChain].map((c) => names.get(c) ?? c)

  const p = mesh.positions
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (let k = 0; k < p.length; k += 3) {
    for (let a = 0; a < 3; a++) {
      if (p[k + a] < min[a]) min[a] = p[k + a]
      if (p[k + a] > max[a]) max[a] = p[k + a]
    }
  }

  const cls = classify({ name, ancestors: ancestorNames })
  pieces.push({
    id,
    name,
    concept,
    mesh,
    min,
    max,
    isA: isaChain.map((c) => names.get(c) ?? c).filter((n) => !GENERIC.test(n)).slice(0, 4),
    partOf: partChain.map((c) => names.get(c) ?? c).filter((n) => !GENERIC.test(n)).slice(0, 4),
    ancestorNames,
    system: cls?.system ?? null,
    category: cls?.category ?? 'Unclassified',
    rule: cls?.rule ?? -1,
    side: 'midline',
    sideSource: 'none',
    correction: fix ? { originalName: sourceName, reason: fix.comment, ...(fix.note ? { note: fix.note } : {}) } : undefined,
  })
  if ((i + 1) % 250 === 0) console.log(`  parsed ${i + 1}/${files.length}`)
}

// ------------------------------------------------------- recentre the body --
const bodyMin: Vec3 = [Infinity, Infinity, Infinity]
const bodyMax: Vec3 = [-Infinity, -Infinity, -Infinity]
for (const pc of pieces) {
  for (let a = 0; a < 3; a++) {
    bodyMin[a] = Math.min(bodyMin[a], pc.min[a])
    bodyMax[a] = Math.max(bodyMax[a], pc.max[a])
  }
}
// Centre X/Z on the body, Y on its mid-height, so the orbit target is the origin.
// X is not shifted: BodyParts3D's X=0 is the mid-sagittal plane, which side detection relies on.
const shift: Vec3 = [0, -(bodyMin[1] + bodyMax[1]) / 2, -(bodyMin[2] + bodyMax[2]) / 2]
for (const pc of pieces) {
  const p = pc.mesh.positions
  for (let k = 0; k < p.length; k += 3) {
    p[k + 1] += shift[1]
    p[k + 2] += shift[2]
  }
  pc.min = [pc.min[0], pc.min[1] + shift[1], pc.min[2] + shift[2]]
  pc.max = [pc.max[0], pc.max[1] + shift[1], pc.max[2] + shift[2]]
}
for (const a of [1, 2]) {
  bodyMin[a] += shift[a]
  bodyMax[a] += shift[a]
}

// -------------------------------------------------------------------- sides --
const ids = new Set(pieces.map((p) => p.id))
for (const id of CORRECTIONS.keys()) {
  if (!ids.has(id)) throw new Error(`anatomy-corrections.json: unknown element id ${id}`)
}
for (const pc of pieces) {
  const fix = CORRECTIONS.get(pc.id)
  if (fix) {
    // Guard against a correction that disagrees with the geometry it claims to fix.
    const cx = (pc.min[0] + pc.max[0]) / 2
    if (fix.side !== 'midline' && (cx > 0 ? 'left' : 'right') !== fix.side) {
      throw new Error(`anatomy-corrections.json: ${pc.id} is corrected to ${fix.side}, but its centre is at x=${cx.toFixed(3)}`)
    }
    pc.side = fix.side
    pc.sideSource = 'correction'
    continue
  }
  const named = sideFromName(pc.name)
  if (named) {
    pc.side = named
    pc.sideSource = 'name'
    continue
  }
  // BodyParts3D ships some bilateral structures as an unnamed pair: FJxxxx and its
  // mirror FJxxxxM. Only for those explicit pairs do we read side from geometry
  // (+X is the patient's left).
  const isPair = pc.id.endsWith('M') ? ids.has(pc.id.slice(0, -1)) : ids.has(pc.id + 'M')
  if (isPair) {
    const cx = (pc.min[0] + pc.max[0]) / 2
    pc.side = cx > 0 ? 'left' : 'right'
    pc.sideSource = 'mirror'
  }
}

// -------------------------------------------------------------- duplicates --
// A few element files are byte-identical meshes under two ids. Keeping both would
// z-fight, so the later id is dropped and logged.
const geometryHash = (m: ObjMesh) => {
  let h = m.positions.length * 31 + m.indices.length
  for (let k = 0; k < m.positions.length; k += 7) h = (h * 33 + Math.round(m.positions[k] * 1e5)) | 0
  return `${m.positions.length}:${m.indices.length}:${h}`
}
const seenGeometry = new Map<string, Piece>()
const duplicates: { id: string; name: string; duplicateOf: string }[] = []
for (const pc of pieces) {
  const h = geometryHash(pc.mesh)
  const first = seenGeometry.get(h)
  if (first) duplicates.push({ id: pc.id, name: pc.name, duplicateOf: first.id })
  else seenGeometry.set(h, pc)
}
const duplicateIds = new Set(duplicates.map((d) => d.id))
console.log(`Parsed in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${duplicates.length} duplicate meshes`)

// ---------------------------------------------------------------- classify --
const classified = pieces.filter((p) => p.system !== null && !duplicateIds.has(p.id))
const unclassified = pieces.filter((p) => p.system === null && !duplicateIds.has(p.id))
mkdirSync(LOGS, { recursive: true })
writeFileSync(join(LOGS, 'duplicates.json'), JSON.stringify(duplicates, null, 2))
writeFileSync(
  join(LOGS, 'unclassified.json'),
  JSON.stringify(
    unclassified.map((p) => ({
      id: p.id,
      name: p.name,
      concept: p.concept,
      reason: p.rule >= 0 ? `Out of scope: ${RULES[p.rule].category}` : 'No rule matched',
      ancestors: p.ancestorNames.filter((n) => !GENERIC.test(n)).slice(0, 6),
    })),
    null,
    2,
  ),
)

// Dry run: `npm run build:anatomy -- --classify-only <out.json>` writes every
// piece's classification and side, then stops before any geometry work. Used to
// diff rule changes before committing to a rebuild.
if (args.includes('--classify-only')) {
  const out = args[args.indexOf('--classify-only') + 1] ?? join(LOGS, 'classification.json')
  writeFileSync(
    out,
    JSON.stringify(
      pieces
        .filter((p) => !duplicateIds.has(p.id))
        .map((p) => ({ id: p.id, name: p.name, system: p.system, category: p.category, side: p.side })),
      null,
      1,
    ),
  )
  console.log(`Classification written to ${out}`)
  process.exit(0)
}

// ----------------------------------------------------------------- regions --
const regionPieces: RegionPiece[] = classified.map((p) => ({
  id: p.id,
  name: p.name,
  system: p.system!,
  category: p.category,
  side: p.side,
  min: p.min,
  max: p.max,
  ancestors: p.ancestorNames,
}))
const regions = buildRegionResolver(regionPieces)

// --------------------------------------------------- proximity ("nearby") --
// Geometric proximity only: two pieces are "nearby" when sampled surface points
// come within NEAR metres. This is never presented as a verified relationship.
const NEAR = 0.004
const CELL = NEAR
const SAMPLES = 600
const grid = new Map<number, number[]>()
// Integer cell key; the body spans < 2 m, i.e. < 512 cells per axis at 4 mm.
const cellKey = (x: number, y: number, z: number) => ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512)
const samplesOf: Float32Array[] = []
classified.forEach((pc, pi) => {
  const p = pc.mesh.positions
  const n = p.length / 3
  const step = Math.max(1, Math.floor(n / SAMPLES))
  const pts: number[] = []
  for (let v = 0; v < n; v += step) {
    const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2]
    pts.push(x, y, z)
    const key = cellKey(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL))
    const cell = grid.get(key)
    if (cell) cell.push(pi, v)
    else grid.set(key, [pi, v])
  }
  samplesOf.push(new Float32Array(pts))
})
const groupKey = (p: Piece) => `${p.name.toLowerCase()}|${p.side}`
const nearbyOf = classified.map((pc, pi) => {
  const pts = samplesOf[pi]
  const hits = new Map<number, number>()
  for (let k = 0; k < pts.length; k += 3) {
    const cx = Math.floor(pts[k] / CELL), cy = Math.floor(pts[k + 1] / CELL), cz = Math.floor(pts[k + 2] / CELL)
    const seenHere = new Set<number>()
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        for (let dz = -1; dz <= 1; dz++) {
          const cell = grid.get(cellKey(cx + dx, cy + dy, cz + dz))
          if (!cell) continue
          for (let c = 0; c < cell.length; c += 2) {
            const other = cell[c]
            if (other === pi || seenHere.has(other)) continue
            const op = classified[other].mesh.positions
            const v = cell[c + 1] * 3
            const d = Math.hypot(op[v] - pts[k], op[v + 1] - pts[k + 1], op[v + 2] - pts[k + 2])
            if (d < NEAR) seenHere.add(other)
          }
        }
    for (const o of seenHere) hits.set(o, (hits.get(o) ?? 0) + 1)
  }
  const ownGroup = groupKey(pc)
  return [...hits.entries()]
    .filter(([o]) => groupKey(classified[o]) !== ownGroup)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([o]) => classified[o].id)
})
console.log(`Proximity computed (${((Date.now() - t0) / 1000).toFixed(1)}s)`)

// ------------------------------------------------------------------ layout --
const sizeOf = (p: Piece): Vec3 => [p.max[0] - p.min[0], p.max[1] - p.min[1], p.max[2] - p.min[2]]
const centerOf = (p: Piece): Vec3 => [(p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2]
const layout = computeAtlasLayout(
  classified.map((p) => ({ id: p.id, size: sizeOf(p), system: p.system!, name: p.name })),
)

// -------------------------------------------------------------------- GLBs --
await MeshoptSimplifier.ready
await MeshoptEncoder.ready
mkdirSync(OUT, { recursive: true })
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

const triangles = new Map<string, number>()
const report: string[] = []
for (const system of SYSTEMS) {
  const group = classified.filter((p) => p.system === system)
  const doc = new Document()
  const buffer = doc.createBuffer()
  const scene = doc.createScene(system)
  let before = 0
  for (const pc of group) {
    const { positions, normals, indices } = pc.mesh
    before += indices.length / 3
    const prim = doc
      .createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(positions).setBuffer(buffer))
      .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(normals).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(indices).setBuffer(buffer))
    const mesh = doc.createMesh(pc.id).addPrimitive(prim)
    scene.addChild(doc.createNode(pc.id).setMesh(mesh))
  }
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: 0, error: SIMPLIFY_ERROR, lockBorder: false }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  let after = 0
  for (const mesh of doc.getRoot().listMeshes()) {
    const n = (mesh.listPrimitives()[0].getIndices()?.getCount() ?? 0) / 3
    triangles.set(mesh.getName(), n)
    after += n
  }
  const file = `${system}.glb`
  await io.write(join(OUT, file), doc)
  const line = `${system.padEnd(12)} ${String(group.length).padStart(5)} pieces  ${before.toLocaleString().padStart(10)} → ${after.toLocaleString().padStart(9)} tris`
  console.log(line)
  report.push(line)
}

// ---------------------------------------------------------------- manifest --
const round = (v: Vec3): Vec3 => v.map((x) => Math.round(x * 1e5) / 1e5) as Vec3
const entries: ManifestEntry[] = classified.map((pc, i) => {
  const region = regions.regionOf(regionPieces[i])
  return {
    id: pc.id,
    name: pc.name,
    system: pc.system!,
    category: pc.category,
    region,
    side: pc.side,
    sideSource: pc.sideSource,
    ...(pc.correction ? { correction: pc.correction } : {}),
    meshFile: `${pc.system}.glb`,
    assembledPosition: round(centerOf(pc)),
    explodedPosition: round(layout.positions.get(pc.id)!),
    size: round(sizeOf(pc)),
    volume: pc.mesh.header.volume,
    concept: pc.concept,
    isA: pc.isA,
    partOf: pc.partOf,
    collections: regions.collectionsOf(regionPieces[i], region),
    nearby: nearbyOf[i],
    triangles: triangles.get(pc.id) ?? 0,
  }
})

const manifest: Manifest = {
  version: 1,
  generatedAt: new Date().toISOString(),
  source: {
    name: 'BodyParts3D',
    attribution:
      'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',
    license: 'CC BY 4.0',
    licenseUrl: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html',
  },
  bounds: { min: round(bodyMin), max: round(bodyMax) },
  sheet: { width: layout.width, height: layout.height },
  systems: Object.fromEntries(
    SYSTEMS.map((s) => [s, { count: entries.filter((e) => e.system === s).length, file: `${s}.glb` }]),
  ) as Manifest['systems'],
  entries,
}
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest))

// ------------------------------------------------------------------ report --
const count = <T,>(xs: T[]) => {
  const m = new Map<T, number>()
  for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}
report.push(
  '',
  `pieces: ${pieces.length}  classified: ${classified.length}  unclassified (logged): ${unclassified.length}  duplicates (logged): ${duplicates.length}`,
  `simplification error: ${SIMPLIFY_ERROR}`,
  `sheet: ${layout.width.toFixed(2)} × ${layout.height.toFixed(2)} m`,
  `landmarks: ${JSON.stringify(regions.landmarks)}`,
  '',
  'regions: ' + count(entries.map((e) => e.region)).map(([k, v]) => `${k} ${v}`).join(', '),
  'collections: ' + count(entries.flatMap((e) => e.collections)).map(([k, v]) => `${k} ${v}`).join(', '),
  'corrections: ' + [...CORRECTIONS.values()].map((c) => `${c.id} → ${c.name}`).join('; '),
  'sides: ' + count(entries.map((e) => `${e.side}/${e.sideSource}`)).map(([k, v]) => `${k} ${v}`).join(', '),
  'categories: ' + count(entries.map((e) => `${e.system}:${e.category}`)).map(([k, v]) => `${k} ${v}`).join(', '),
  'unclassified: ' + count(unclassified.map((p) => (p.rule >= 0 ? RULES[p.rule].category : 'no rule'))).map(([k, v]) => `${k} ${v}`).join(', '),
)
writeFileSync(join(LOGS, 'build-report.txt'), report.join('\n') + '\n')
console.log(report.slice(SYSTEMS.length).join('\n'))
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${OUT}`)
if (!existsSync(join(OUT, 'manifest.json'))) process.exit(1)
