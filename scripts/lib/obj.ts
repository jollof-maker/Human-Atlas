/**
 * Minimal, fast OBJ reader for BodyParts3D files.
 *
 * BodyParts3D OBJs are triangle soups with `v`, `vn` and `f v//vn` records and
 * a commented header carrying metadata (concept id, English name, bounds,
 * volume). We only need positions, normals and the header.
 *
 * Coordinates are converted from BodyParts3D space (millimetres; +X = patient's
 * left, -Y = anterior, +Z = superior) into scene space (metres; +X = patient's
 * left, +Y = up, +Z = anterior). That mapping is a proper rotation, so triangle
 * winding is preserved. A viewer looking from +Z therefore sees the body from
 * the front, in anatomical position.
 */

export interface ObjHeader {
  fileId: string
  conceptId: string
  name: string
  volume: number | null
}

export interface ObjMesh {
  header: ObjHeader
  positions: Float32Array<ArrayBuffer>
  normals: Float32Array<ArrayBuffer>
  indices: Uint32Array<ArrayBuffer>
}

const MM = 0.001

export function parseObj(text: string): ObjMesh {
  const header: ObjHeader = { fileId: '', conceptId: '', name: '', volume: null }
  const vs: number[] = []
  const vns: number[] = []
  const vertexKey = new Map<string, number>()
  const outPos: number[] = []
  const outNrm: number[] = []
  const indices: number[] = []

  const vertexFor = (token: string): number => {
    let idx = vertexKey.get(token)
    if (idx !== undefined) return idx
    const [vi, , ni] = token.split('/')
    const v = (parseInt(vi, 10) - 1) * 3
    idx = outPos.length / 3
    // BP3D (x, y, z) mm  ->  scene (x, z, -y) m
    outPos.push(vs[v] * MM, vs[v + 2] * MM, -vs[v + 1] * MM)
    if (ni) {
      const n = (parseInt(ni, 10) - 1) * 3
      outNrm.push(vns[n], vns[n + 2], -vns[n + 1])
    } else {
      outNrm.push(0, 0, 0)
    }
    vertexKey.set(token, idx)
    return idx
  }

  let start = 0
  const len = text.length
  while (start < len) {
    let end = text.indexOf('\n', start)
    if (end === -1) end = len
    const line = text.slice(start, end).trim()
    start = end + 1
    if (!line) continue
    const c0 = line.charCodeAt(0)
    if (c0 === 35 /* # */) {
      const m = /^#\s*([^:]+?)\s*:\s*(.*)$/.exec(line)
      if (!m) continue
      const [, key, value] = m
      if (key === 'File ID') header.fileId = value.trim()
      else if (key === 'Concept ID') header.conceptId = value.trim()
      else if (key === 'English name') header.name = value.trim()
      else if (key === 'Volume(cm3)') {
        const v = parseFloat(value)
        header.volume = Number.isFinite(v) ? v : null
      }
      continue
    }
    const parts = line.split(/\s+/)
    switch (parts[0]) {
      case 'v':
        vs.push(+parts[1], +parts[2], +parts[3])
        break
      case 'vn':
        vns.push(+parts[1], +parts[2], +parts[3])
        break
      case 'f': {
        const a = vertexFor(parts[1])
        for (let i = 2; i + 1 < parts.length; i++) {
          indices.push(a, vertexFor(parts[i]), vertexFor(parts[i + 1]))
        }
        break
      }
    }
  }

  const mesh: ObjMesh = {
    header,
    positions: new Float32Array(outPos),
    normals: new Float32Array(outNrm),
    indices: new Uint32Array(indices),
  }
  repairNormalsAndWinding(mesh)
  return mesh
}

/**
 * Some pieces (notably mirrored "…M" files) have winding that disagrees with
 * their stored normals. We compare face normals to the stored vertex normals
 * and flip the winding when most faces disagree. Missing normals are rebuilt.
 */
function repairNormalsAndWinding(mesh: ObjMesh) {
  const { positions: p, normals: n, indices: idx } = mesh
  let agree = 0
  let disagree = 0
  let missing = false
  for (let i = 0; i < n.length; i += 3) {
    if (n[i] === 0 && n[i + 1] === 0 && n[i + 2] === 0) {
      missing = true
      break
    }
  }

  const face = (t: number) => {
    const a = idx[t] * 3,
      b = idx[t + 1] * 3,
      c = idx[t + 2] * 3
    const ux = p[b] - p[a], uy = p[b + 1] - p[a + 1], uz = p[b + 2] - p[a + 2]
    const vx = p[c] - p[a], vy = p[c + 1] - p[a + 1], vz = p[c + 2] - p[a + 2]
    return [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
  }

  if (missing) {
    n.fill(0)
    for (let t = 0; t < idx.length; t += 3) {
      const f = face(t)
      for (let k = 0; k < 3; k++) {
        const v = idx[t + k] * 3
        n[v] += f[0]; n[v + 1] += f[1]; n[v + 2] += f[2]
      }
    }
    for (let i = 0; i < n.length; i += 3) {
      const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1
      n[i] /= l; n[i + 1] /= l; n[i + 2] /= l
    }
    return
  }

  for (let t = 0; t < idx.length; t += 3) {
    const f = face(t)
    let d = 0
    for (let k = 0; k < 3; k++) {
      const v = idx[t + k] * 3
      d += f[0] * n[v] + f[1] * n[v + 1] + f[2] * n[v + 2]
    }
    if (d >= 0) agree++
    else disagree++
  }
  if (disagree > agree) {
    for (let t = 0; t < idx.length; t += 3) {
      const tmp = idx[t + 1]
      idx[t + 1] = idx[t + 2]
      idx[t + 2] = tmp
    }
  }
}
