import { useEffect, useRef } from 'react'
import { OrbitControls } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { Box3, MOUSE, MathUtils, TOUCH, Vector3, type PerspectiveCamera } from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { AtlasData } from '../data/atlasData'
import { inScope, useAtlas, type AtlasState } from '../state/store'
import { activeLayout, clamp01, easeInOutCubic, explodeDuration, runtime } from '../state/runtime'

const FRONT = new Vector3(0, 0, 1)
/** Info panel width + gap; the view is shifted left by half of this while it is open. */
const PANEL_SHIFT = 172

interface Pose {
  position: Vector3
  target: Vector3
}

export function CameraRig({ data }: { data: AtlasData }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const get = useThree((s) => s.get)
  const tween = useRef({
    active: false,
    /** Follow mode: exponential approach instead of a timed tween (used while scrubbing). */
    follow: false,
    start: 0,
    dur: 1,
    fromP: new Vector3(),
    toP: new Vector3(),
    fromT: new Vector3(),
    toT: new Vector3(),
  })
  const viewShift = useRef({ x: 0, y: 0, w: 0, h: 0 })

  useEffect(() => {
    const ctl = controls.current
    if (!ctl) return
    const camera = get().camera as PerspectiveCamera

    // ---------------------------------------------------------- framing --
    /**
     * Screen-space insets (px) occupied by floating UI. Framing fits boxes into
     * the remaining "safe" rectangle and centres them there, so the specimen
     * never sits under a panel.
     */
    const insets = () => {
      const { width } = get().size
      return width <= 720
        ? { top: 84, bottom: 176, left: 12, right: 60 }
        : { top: 30, bottom: 148, left: 236, right: 78 }
    }

    const poseForBox = (box: Box3, direction: Vector3, padding: number): Pose => {
      const center = box.getCenter(new Vector3())
      const s = box.getSize(new Vector3())
      const dir = direction.clone().normalize()
      const up = new Vector3(0, 1, 0)
      const right = new Vector3().crossVectors(up, dir)
      if (right.lengthSq() < 1e-6) right.set(1, 0, 0)
      right.normalize()
      const screenUp = new Vector3().crossVectors(dir, right).normalize()

      // Box extents across the view plane and along the view direction.
      const ext = (v: Vector3) => Math.abs(v.x) * s.x + Math.abs(v.y) * s.y + Math.abs(v.z) * s.z
      const w = ext(right)
      const h = ext(screenUp)
      const depth = ext(dir)

      const { width: W, height: H } = get().size
      const ins = insets()
      const fw = Math.max(0.3, (W - ins.left - ins.right) / W)
      const fh = Math.max(0.3, (H - ins.top - ins.bottom) / H)
      const tanV = Math.tan(MathUtils.degToRad(camera.fov) / 2)
      const tanH = tanV * (W / H)
      const dist = Math.max(0.14, Math.max(h / 2 / (tanV * fh), w / 2 / (tanH * fw)) * padding + depth / 2)

      // Shift the look-at point so the box centre lands in the middle of the safe rectangle.
      const worldPerPx = (2 * tanV * (dist - depth / 2)) / H
      const ox = ((ins.left - ins.right) / 2) * worldPerPx
      const oy = ((ins.bottom - ins.top) / 2) * worldPerPx
      const target = center.clone().addScaledVector(right, -ox).addScaledVector(screenUp, -oy)
      return { target, position: target.clone().addScaledVector(dir, dist) }
    }

    const bodyBox = () => new Box3(new Vector3(...data.manifest.bounds.min), new Vector3(...data.manifest.bounds.max))

    const scopeBox = (s: AtlasState) => {
      const box = new Box3()
      for (const e of data.entries) {
        if (!inScope(s, e)) continue
        const c = new Vector3(...e.assembledPosition)
        const half = new Vector3(...e.size).multiplyScalar(0.5)
        box.expandByPoint(c.clone().sub(half)).expandByPoint(c.add(half))
      }
      return box.isEmpty() ? bodyBox() : box
    }

    const assembledPose = (s: AtlasState): Pose =>
      s.collection ? poseForBox(scopeBox(s), FRONT, 1.35) : poseForBox(bodyBox(), FRONT, 1.04)

    const sheetPose = (s: AtlasState): Pose => {
      const L = activeLayout(data, s)
      if (!L.width) return assembledPose(s)
      const half = new Vector3(L.width / 2, L.height / 2, 0.1)
      const c = new Vector3(...L.center)
      return poseForBox(new Box3(c.clone().sub(half), c.clone().add(half)), FRONT, 1.04)
    }

    const poseForExplode = (s: AtlasState, e: number): Pose => {
      const a = assembledPose(s)
      const b = sheetPose(s)
      // The camera leads the pieces a little: large specimens reach the sheet
      // early (they are staggered first), so pull back ahead of the midpoint.
      const t = 1 - Math.pow(1 - clamp01(e), 2.2)
      return { position: a.position.lerp(b.position, t), target: a.target.lerp(b.target, t) }
    }

    const go = (pose: Pose, dur: number, follow = false) => {
      const tw = tween.current
      tw.follow = follow
      tw.fromP.copy(camera.position)
      tw.fromT.copy(ctl.target)
      tw.toP.copy(pose.position)
      tw.toT.copy(pose.target)
      tw.start = performance.now() / 1000
      tw.dur = dur
      tw.active = true
    }

    const currentDirection = () => new Vector3().subVectors(camera.position, ctl.target).normalize()
    const distance = () => camera.position.distanceTo(ctl.target)

    // ------------------------------------------------------------ public API --
    runtime.camera = {
      frameBox: (box, opts = {}) =>
        go(poseForBox(box, opts.direction ?? currentDirection(), opts.padding ?? 1.5), opts.duration ?? 0.85),
      focusStructure: (key, opts = {}) => {
        const box = runtime.structureBox?.(key)
        if (!box || box.isEmpty()) return
        const s = useAtlas.getState()
        const dir = s.explode > 0.5 ? FRONT.clone() : currentDirection()
        go(poseForBox(box, dir, 1.9), opts.duration ?? 0.85)
      },
      frameCollection: () => go(assembledPose(useAtlas.getState()), 1.0),
      zoom: (factor) => {
        const dir = currentDirection()
        const d = MathUtils.clamp(distance() * factor, ctl.minDistance, ctl.maxDistance)
        go({ position: ctl.target.clone().addScaledVector(dir, d), target: ctl.target.clone() }, 0.45)
      },
      front: () => go({ position: ctl.target.clone().addScaledVector(FRONT, distance()), target: ctl.target.clone() }, 0.8),
      reset: () => {
        const s = useAtlas.getState()
        go(poseForExplode(s, s.explode), 0.9)
      },
    }

    // Initial framing: settle gently from slightly further away.
    const home = poseForExplode(useAtlas.getState(), 0)
    camera.position.copy(home.target).addScaledVector(FRONT, home.position.distanceTo(home.target) * 1.18)
    camera.position.y += 0.06
    ctl.target.copy(home.target)
    ctl.update()
    if (useAtlas.getState().ready) go(home, 1.8)

    // ------------------------------------------------------- state wiring --
    const unsub = useAtlas.subscribe((s, prev) => {
      if (s.ready && !prev.ready) go(poseForExplode(s, s.explode), 1.8)
      if (s.collection !== prev.collection) {
        // Collections choreograph themselves (see actions.ts): frame first, then lay out.
        go(s.collection ? assembledPose(s) : poseForExplode(s, s.explode), 1.0)
      } else if (s.explode !== prev.explode) {
        go(poseForExplode(s, s.explode), explodeDuration(s.explode - prev.explode, s.scrubbing), s.scrubbing)
      } else if ((s.systems !== prev.systems || s.side !== prev.side) && s.explode > 0.02 && !s.selected) {
        go(poseForExplode(s, s.explode), 0.9)
      }
      if (s.selected && (s.selected !== prev.selected || (s.isolated && !prev.isolated))) {
        // Deferred so the model has applied any layout change from the same update.
        const key = s.selected
        queueMicrotask(() => runtime.camera?.focusStructure(key))
      }
      if (s.tool !== prev.tool) applyTool(s.tool)
    })

    const applyTool = (tool: AtlasState['tool']) => {
      ctl.mouseButtons = {
        LEFT: tool === 'pan' ? MOUSE.PAN : MOUSE.ROTATE,
        MIDDLE: MOUSE.DOLLY,
        RIGHT: tool === 'pan' ? MOUSE.ROTATE : MOUSE.PAN,
      }
      ctl.touches = { ONE: tool === 'pan' ? TOUCH.PAN : TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN }
    }
    applyTool(useAtlas.getState().tool)

    const cancel = () => {
      tween.current.active = false
    }
    ctl.addEventListener('start', cancel)
    return () => {
      unsub()
      ctl.removeEventListener('start', cancel)
      runtime.camera = null
    }
  }, [get, data])

  useFrame((state, dt) => {
    const camera = state.camera as PerspectiveCamera
    const ctl = controls.current
    if (!ctl) return
    const tw = tween.current
    if (tw.active && tw.follow) {
      const k = 1 - Math.exp(-Math.min(dt, 0.05) * 5)
      camera.position.lerp(tw.toP, k)
      ctl.target.lerp(tw.toT, k)
      if (camera.position.distanceToSquared(tw.toP) < 1e-8) tw.active = false
    } else if (tw.active) {
      const t = clamp01((performance.now() / 1000 - tw.start) / tw.dur)
      const e = easeInOutCubic(t)
      camera.position.lerpVectors(tw.fromP, tw.toP, e)
      ctl.target.lerpVectors(tw.fromT, tw.toT, e)
      if (t >= 1) tw.active = false
    }

    // Shift the projection so the subject stays centred in the space the info
    // panel leaves free: left of it on desktop, above the bottom sheet on mobile.
    const { width, height } = state.size
    const s = useAtlas.getState()
    const wantX = s.selected && width > 720 ? PANEL_SHIFT : 0
    const wantY = s.selected && width <= 720 ? height * 0.21 : 0
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 7)
    const v = viewShift.current
    const nx = Math.abs(wantX - v.x) < 0.3 ? wantX : v.x + (wantX - v.x) * k
    const ny = Math.abs(wantY - v.y) < 0.3 ? wantY : v.y + (wantY - v.y) * k
    if (nx !== v.x || ny !== v.y || v.w !== width || v.h !== height) {
      Object.assign(v, { x: nx, y: ny, w: width, h: height })
      if (nx === 0 && ny === 0) camera.clearViewOffset()
      else camera.setViewOffset(width, height, nx, ny, width, height)
    }
  })

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.05}
      rotateSpeed={0.55}
      zoomSpeed={0.8}
      panSpeed={0.8}
      zoomToCursor
      screenSpacePanning
      minDistance={0.08}
      maxDistance={30}
    />
  )
}
