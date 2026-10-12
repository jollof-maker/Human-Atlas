import { useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
  type BufferAttribute as BA,
  type InterleavedBufferAttribute,
  type Object3D,
} from 'three'
import { acceleratedRaycast, computeBoundsTree } from 'three-mesh-bvh'
import type { AtlasData } from '../data/atlasData'
import { SYSTEMS, SYSTEM_BY_ID } from '../data/systems'
import type { ManifestEntry, SystemId } from '../types/anatomy'
import { inScope, useAtlas, type AtlasState } from '../state/store'
import {
  activeLayout,
  clamp01,
  easeInOutCubic,
  easeOutCubic,
  explodeDuration,
  runtime,
} from '../state/runtime'
import { BACKGROUND, INK } from './theme'
import { assetUrl } from './assets'

/** Max per-piece stagger, as a fraction of the explode range. */
const MAX_DELAY = 0.22
const FADE = 0.32
const SYSTEM_STAGGER = 0.045
const DIM_AMOUNT = 0.52
const JOIN_DURATION = 1.2
const XRAY_OPACITY = 0.34
const BG = new Color(BACKGROUND)
const noRaycast = () => {}

interface Piece {
  entry: ManifestEntry
  key: string
  systemIndex: number
  mesh: Mesh<BufferGeometry, MeshStandardMaterial>
  base: Color
  assembled: Vector3
  sheet: Vector3
  sheetTarget: Vector3
  sheetSettled: boolean
  delay: number
  eased: number
  /**
   * Participation in the explode (0..1, eased). Pieces collapse to their
   * anatomical position while hidden and ease back out to their slot when they
   * reappear, so nothing pops in at a stale sheet position.
   */
  join: number
  joinRaw: number
  op: number
  opFrom: number
  opTo: number
  opStart: number
  opDur: number
  dim: number
  dimTo: number
  hover: number
  hoverTo: number
  sel: number
  selTo: number
  pickable: boolean
  /** See-through overlay drawn while selected, so occluded structures stay legible. */
  xray: Mesh<BufferGeometry, MeshBasicMaterial> | null
}

export type GeometrySource = (entry: ManifestEntry) => BufferGeometry | null

// ------------------------------------------------------------------ loaders --

/** Loads the per-system GLBs (meshopt) and hands each piece's geometry to the model. */
export function GltfAnatomy({ data }: { data: AtlasData }) {
  const urls = SYSTEMS.map((s) => assetUrl(data.manifest.systems[s.id].file))
  const gltfs = useGLTF(urls, false, true)
  const source = useMemo<GeometrySource>(() => {
    const byName = new Map<string, Mesh>()
    for (const g of gltfs) {
      g.scene.updateMatrixWorld(true)
      g.scene.traverse((o: Object3D) => {
        if ((o as Mesh).isMesh) byName.set(o.name || o.parent?.name || '', o as Mesh)
      })
    }
    return (entry) => {
      const m = byName.get(entry.id)
      return m ? bakeGeometry(m.geometry, m.matrixWorld) : null
    }
  }, [gltfs])
  return <PiecesModel data={data} source={source} />
}

/**
 * Converts a (possibly quantized, meshopt-decoded) glTF geometry into a plain
 * Float32 geometry in body space. Raycasting, BVH and bounds then work without
 * caring about KHR_mesh_quantization's node transforms.
 */
function bakeGeometry(src: BufferGeometry, matrix: Matrix4): BufferGeometry {
  const g = new BufferGeometry()
  const copy = (attr: BA | InterleavedBufferAttribute) => {
    const out = new Float32Array(attr.count * 3)
    for (let i = 0; i < attr.count; i++) {
      out[i * 3] = attr.getX(i)
      out[i * 3 + 1] = attr.getY(i)
      out[i * 3 + 2] = attr.getZ(i)
    }
    return new BufferAttribute(out, 3)
  }
  g.setAttribute('position', copy(src.getAttribute('position')))
  const n = src.getAttribute('normal')
  if (n) g.setAttribute('normal', copy(n))
  if (src.index) g.setIndex(src.index)
  g.applyMatrix4(matrix)
  if (!n) g.computeVertexNormals()
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

// -------------------------------------------------------------------- model --

/**
 * A flat, depth-test-free copy of a selected piece, drawn last. Where the piece
 * is visible it barely changes the shading; where other anatomy hides it, it
 * shows through as a soft silhouette.
 */
function makeXray(p: Piece) {
  const material = new MeshBasicMaterial({
    color: p.base.clone().lerp(new Color(INK), 0.35),
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
  })
  const xray = new Mesh(p.mesh.geometry, material)
  xray.renderOrder = 10
  xray.raycast = noRaycast
  xray.matrixAutoUpdate = false
  p.mesh.add(xray)
  return xray
}

function hash(id: string) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return ((h >>> 0) % 1000) / 1000
}

export function PiecesModel({ data, source }: { data: AtlasData; source: GeometrySource }) {
  const { root, pieces, byMesh, byKey } = useMemo(() => {
    const root = new Group()
    root.name = 'anatomy'
    const pieces: Piece[] = []
    const byMesh = new Map<Object3D, Piece>()
    const byKey = new Map<string, Piece[]>()
    const now = performance.now() / 1000
    const systemIndex = Object.fromEntries(SYSTEMS.map((s, i) => [s.id, i])) as Record<SystemId, number>

    for (const entry of data.entries) {
      const geometry = source(entry)
      if (!geometry) continue
      const meta = SYSTEM_BY_ID[entry.system]
      // Tiny per-piece tonal variation so adjacent pieces read as separate specimens.
      const base = new Color(meta.color).offsetHSL(0, 0, (hash(entry.id) - 0.5) * 0.06)
      const material = new MeshStandardMaterial({
        color: base.clone(),
        roughness: meta.roughness,
        metalness: 0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
      const mesh = new Mesh(geometry, material)
      mesh.name = entry.id
      mesh.matrixAutoUpdate = false
      mesh.visible = false
      mesh.raycast = noRaycast
      root.add(mesh)

      const key = data.structureOfPiece.get(entry.id)!.key
      const assembled = new Vector3(...entry.assembledPosition)
      const si = systemIndex[entry.system]
      const piece: Piece = {
        entry,
        key,
        systemIndex: si,
        mesh,
        base,
        assembled,
        sheet: new Vector3(...entry.explodedPosition),
        sheetTarget: new Vector3(...entry.explodedPosition),
        sheetSettled: true,
        delay: 0,
        eased: 0,
        join: 1,
        joinRaw: 1,
        op: 0,
        opFrom: 0,
        opTo: 0,
        // Initial reveal: a slow, system-staggered fade.
        opStart: now + 0.25 + si * 0.07,
        opDur: 1.1,
        dim: 0,
        dimTo: 0,
        hover: 0,
        hoverTo: 0,
        sel: 0,
        selTo: 0,
        pickable: false,
        xray: null,
      }
      pieces.push(piece)
      byMesh.set(mesh, piece)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(piece)
    }
    return { root, pieces, byMesh, byKey }
  }, [data, source])

  // ---------------------------------------------------------------- state --
  useEffect(() => {
    const explode = runtime.explodeTween
    let first = true

    const apply = (s: AtlasState, prev?: AtlasState) => {
      const now = performance.now() / 1000
      const layout = activeLayout(data, s)
      const top = layout.center[1] + layout.height / 2
      const changedSystems: SystemId[] = []

      const targets = pieces.map((p) => {
        const visible =
          inScope(s, p.entry) && !(s.isolated && s.selected !== null && p.key !== s.selected)
        return visible ? 1 : 0
      })
      pieces.forEach((p, i) => {
        if (!first && p.opTo !== targets[i] && !changedSystems.includes(p.entry.system)) {
          changedSystems.push(p.entry.system)
        }
      })
      changedSystems.sort((a, b) => SYSTEMS.findIndex((x) => x.id === a) - SYSTEMS.findIndex((x) => x.id === b))

      pieces.forEach((p, i) => {
        const to = targets[i]
        if (first) {
          p.opTo = to
          p.opFrom = 0
        } else if (p.opTo !== to) {
          p.opFrom = p.op
          p.opTo = to
          p.opStart = now + changedSystems.indexOf(p.entry.system) * SYSTEM_STAGGER
          p.opDur = FADE
        }
        const slot = layout.positions.get(p.entry.id)
        if (slot) {
          p.sheetTarget.set(slot[0], slot[1], slot[2])
          p.sheetSettled = false
          p.delay = MAX_DELAY * clamp01((top - slot[1]) / Math.max(layout.height, 1e-6))
        }
        p.dimTo = s.selected && !s.isolated && p.key !== s.selected ? 1 : 0
        p.selTo = p.key === s.selected ? 1 : 0
        p.hoverTo = p.key === s.hovered ? 1 : 0
      })

      if (first || !prev || prev.explode !== s.explode) {
        explode.from = runtime.explodeProgress
        explode.to = s.explode
        explode.start = now
        explode.dur = explodeDuration(s.explode - runtime.explodeProgress, s.scrubbing)
      }
      first = false
    }

    apply(useAtlas.getState())
    useAtlas.setState({ ready: true })
    const unsub = useAtlas.subscribe((s, prev) => apply(s, prev))

    runtime.structureBox = (key) => {
      const group = byKey.get(key)
      if (!group) return null
      const box = new Box3()
      const target = useAtlas.getState().explode
      const tmp = new Box3()
      const offset = new Vector3()
      for (const p of group) {
        // Bounds at the piece's destination, so focusing during a transition aims at where it lands.
        const e = easeInOutCubic(clamp01((target - p.delay) / (1 - MAX_DELAY)))
        offset.subVectors(p.sheetTarget, p.assembled).multiplyScalar(e)
        box.union(tmp.copy(p.mesh.geometry.boundingBox!).translate(offset))
      }
      return box
    }

    // Build raycast acceleration structures in idle time, a few dozen at a time.
    let cancelled = false
    let i = 0
    const idle =
      (window as Window & { requestIdleCallback?: (cb: () => void) => number }).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 16))
    const step = () => {
      if (cancelled) return
      const end = Math.min(pieces.length, i + 40)
      for (; i < end; i++) computeBoundsTree.call(pieces[i].mesh.geometry)
      if (i < pieces.length) idle(step)
    }
    idle(step)

    return () => {
      cancelled = true
      unsub()
      runtime.structureBox = null
    }
  }, [data, pieces, byKey])

  useEffect(
    () => () => {
      for (const p of pieces) {
        p.mesh.geometry.dispose()
        p.mesh.material.dispose()
        p.xray?.material.dispose()
      }
    },
    [pieces],
  )

  // ---------------------------------------------------------------- frame --
  useFrame((_, dt) => {
    const now = performance.now() / 1000
    const ex = runtime.explodeTween
    runtime.explodeProgress = ex.from + (ex.to - ex.from) * clamp01((now - ex.start) / ex.dur)
    const T = runtime.explodeProgress
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 6)
    const kc = 1 - Math.exp(-Math.min(dt, 0.05) * 14)

    for (const p of pieces) {
      const m = p.mesh
      const mat = m.material

      // --- position: assembled <-> sheet slot -----------------------------
      let moved = false
      if (!p.sheetSettled) {
        p.sheet.lerp(p.sheetTarget, k)
        if (p.sheet.distanceToSquared(p.sheetTarget) < 1e-10) {
          p.sheet.copy(p.sheetTarget)
          p.sheetSettled = true
        }
        moved = true
      }
      if (p.opTo === 0 && p.op <= 0.004) {
        p.joinRaw = 0
      } else if (p.joinRaw < 1) {
        // Collapsing (or assembled): rejoin instantly once the global explode is at rest.
        if (ex.to === 0) p.joinRaw = T === 0 ? 1 : 0
        else p.joinRaw = Math.min(1, p.joinRaw + dt / JOIN_DURATION)
      }
      p.join = easeInOutCubic(p.joinRaw)
      const e = easeInOutCubic(clamp01((T - p.delay) / (1 - MAX_DELAY))) * p.join
      if (moved || e !== p.eased) {
        p.eased = e
        m.position.subVectors(p.sheet, p.assembled).multiplyScalar(e)
        m.updateMatrix()
      }

      // --- opacity --------------------------------------------------------
      if (p.op !== p.opTo) {
        const t = clamp01((now - p.opStart) / p.opDur)
        if (t > 0) {
          p.op = t >= 1 ? p.opTo : p.opFrom + (p.opTo - p.opFrom) * easeOutCubic(t)
          mat.opacity = p.op
          const transparent = p.op < 0.995
          if (mat.transparent !== transparent) {
            mat.transparent = transparent
            mat.depthWrite = !transparent
            mat.needsUpdate = true
          }
          m.visible = p.op > 0.004
        }
      }
      const pickable = p.opTo > 0.5 && p.op > 0.3
      if (pickable !== p.pickable) {
        p.pickable = pickable
        m.raycast = pickable ? acceleratedRaycast : noRaycast
      }

      // --- emphasis: dim / hover / selection ------------------------------
      let tint = false
      if (p.dim !== p.dimTo) {
        p.dim = Math.abs(p.dimTo - p.dim) < 0.002 ? p.dimTo : p.dim + (p.dimTo - p.dim) * kc
        tint = true
      }
      if (p.hover !== p.hoverTo) {
        p.hover = Math.abs(p.hoverTo - p.hover) < 0.002 ? p.hoverTo : p.hover + (p.hoverTo - p.hover) * kc
        tint = true
      }
      if (p.sel !== p.selTo) {
        p.sel = Math.abs(p.selTo - p.sel) < 0.002 ? p.selTo : p.sel + (p.selTo - p.sel) * kc
        tint = true
      }
      if (tint) {
        mat.color.copy(p.base).lerp(BG, p.dim * DIM_AMOUNT)
        const glow = p.hover * 0.16 + p.sel * 0.06
        mat.emissive.setRGB(glow, glow, glow * 1.02)
        if (p.sel > 0.001 && !p.xray) p.xray = makeXray(p)
      }
      if (p.xray) {
        p.xray.visible = p.sel > 0.001 && m.visible
        p.xray.material.opacity = p.sel * XRAY_OPACITY * p.op
      }
    }
  })

  // ---------------------------------------------------------------- events --
  const pieceOf = (e: ThreeEvent<PointerEvent | MouseEvent>) => byMesh.get(e.object)

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const p = pieceOf(e)
    if (!p) return
    useAtlas.getState().hover(p.key)
    document.body.style.cursor = 'pointer'
    const tip = runtime.tooltip
    if (tip && e.nativeEvent.pointerType !== 'touch') {
      tip.style.transform = `translate3d(${e.nativeEvent.clientX + 14}px, ${e.nativeEvent.clientY + 16}px, 0)`
    }
  }
  const onPointerOut = () => {
    useAtlas.getState().hover(null)
    document.body.style.cursor = ''
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return
    e.stopPropagation()
    const p = pieceOf(e)
    if (!p) return
    useAtlas.getState().select(p.key)
  }

  return <primitive object={root} onPointerMove={onPointerMove} onPointerOut={onPointerOut} onClick={onClick} />
}
