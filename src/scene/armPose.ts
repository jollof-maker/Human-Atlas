import { BufferGeometry, Matrix4, Vector3 } from 'three'
import type { LimbSide } from '../data/upperLimb'

/** Abduction of the raised pose, in radians (both sides). */
export const ARM_ABDUCTION = (150 * Math.PI) / 180

/**
 * Rigid abduction of one upper limb about its humeral-head pivot, as a matrix
 * T(pivot) · Rz(angle) · T(−pivot). The rotation axis is the body's
 * anteroposterior axis (scene Z), so the limb swings in the coronal plane.
 * `k` is 0 (down) to 1 (fully raised).
 */
export function armPoseMatrix(side: LimbSide, pivot: Vector3, k: number, out = new Matrix4()): Matrix4 {
  const angle = (side === 'left' ? 1 : -1) * ARM_ABDUCTION * k
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  out.makeRotationZ(angle)
  out.setPosition(pivot.x - (c * pivot.x - s * pivot.y), pivot.y - (s * pivot.x + c * pivot.y), 0)
  return out
}

/**
 * Centre of the humeral head, from the humerus mesh: a least-squares sphere fit
 * to the vertices of the top 55 mm of the bone, keeping only its medial half
 * (the head faces medially; the tubercles sit laterally). Falls back to the
 * centroid of those vertices if the fit is implausible.
 */
export function humeralHeadCentre(geometries: BufferGeometry[], side: LimbSide): Vector3 | null {
  const pts: number[] = []
  let maxY = -Infinity
  for (const g of geometries) {
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) maxY = Math.max(maxY, p.getY(i))
  }
  if (!Number.isFinite(maxY)) return null
  for (const g of geometries) {
    const p = g.getAttribute('position')
    for (let i = 0; i < p.count; i++) if (p.getY(i) > maxY - 0.055) pts.push(p.getX(i), p.getY(i), p.getZ(i))
  }
  let meanX = 0
  for (let i = 0; i < pts.length; i += 3) meanX += pts[i]
  meanX /= pts.length / 3
  // Medial = towards the midline: smaller |x|.
  const medial: number[] = []
  for (let i = 0; i < pts.length; i += 3) {
    if (side === 'left' ? pts[i] <= meanX : pts[i] >= meanX) medial.push(pts[i], pts[i + 1], pts[i + 2])
  }
  const n = medial.length / 3
  if (n < 20) return null

  // Solve [x y z 1]·[a b c d]ᵀ = x²+y²+z² in the least-squares sense; centre = (a, b, c) / 2.
  const M = Array.from({ length: 4 }, () => new Array(5).fill(0))
  const centroid = new Vector3()
  for (let i = 0; i < medial.length; i += 3) {
    const row = [medial[i], medial[i + 1], medial[i + 2], 1]
    const rhs = medial[i] ** 2 + medial[i + 1] ** 2 + medial[i + 2] ** 2
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) M[r][c] += row[r] * row[c]
      M[r][4] += row[r] * rhs
    }
    centroid.x += medial[i]
    centroid.y += medial[i + 1]
    centroid.z += medial[i + 2]
  }
  centroid.divideScalar(n)
  for (let col = 0; col < 4; col++) {
    let piv = col
    for (let r = col + 1; r < 4; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r
    ;[M[col], M[piv]] = [M[piv], M[col]]
    if (Math.abs(M[col][col]) < 1e-12) return centroid
    for (let r = 0; r < 4; r++) {
      if (r === col) continue
      const f = M[r][col] / M[col][col]
      for (let c = col; c < 5; c++) M[r][c] -= f * M[col][c]
    }
  }
  const sol = M.map((row, i) => row[4] / row[i])
  const centre = new Vector3(sol[0] / 2, sol[1] / 2, sol[2] / 2)
  const radius = Math.sqrt(Math.max(0, sol[3] + centre.lengthSq()))
  // A humeral head is roughly 20–28 mm in radius; anything else means a bad fit.
  const plausible = radius > 0.012 && radius < 0.04 && centre.distanceTo(centroid) < 0.04
  return plausible ? centre : centroid
}
