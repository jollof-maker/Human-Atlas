import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdaptiveEvents, Environment, Lightformer, PerformanceMonitor } from '@react-three/drei'
import { EffectComposer, N8AO } from '@react-three/postprocessing'
import { NoToneMapping, type Group } from 'three'
import type { AtlasData } from '../data/atlasData'
import { useAtlas } from '../state/store'
import { runtime } from '../state/runtime'
import { GltfAnatomy } from './AnatomyModel'
import { PlaceholderAnatomy } from './Placeholder'
import { CameraRig } from './CameraRig'
import { BACKGROUND, FOV } from './theme'

/**
 * Soft studio lighting that travels with the camera, so every view of the
 * specimen is lit the same way: a broad key from upper left, a low fill and a
 * gentle rim. No cast shadows.
 */
function StudioLights() {
  const rig = useRef<Group>(null)
  const camera = useThree((s) => s.camera)
  useFrame(() => {
    rig.current?.quaternion.copy(camera.quaternion)
  })
  return (
    <>
      <hemisphereLight args={['#ffffff', '#d8d2c8', 1.25]} />
      <group ref={rig}>
        <directionalLight position={[-2.2, 3, 4]} intensity={1.55} />
        <directionalLight position={[3, 0.5, 2.5]} intensity={0.45} />
        <directionalLight position={[0.5, 2.5, -4]} intensity={0.7} />
      </group>
      <Environment resolution={64} frames={1} environmentIntensity={0.35}>
        <Lightformer intensity={1.2} position={[0, 4, 3]} scale={[8, 3, 1]} />
        <Lightformer intensity={0.6} position={[-5, 1, 1]} rotation-y={Math.PI / 2} scale={[6, 4, 1]} />
        <Lightformer intensity={0.5} position={[5, 1, -1]} rotation-y={-Math.PI / 2} scale={[6, 4, 1]} />
      </Environment>
    </>
  )
}

function AspectTracker() {
  const size = useThree((s) => s.size)
  useEffect(() => {
    runtime.aspect = size.width / Math.max(1, size.height)
  }, [size])
  return null
}

export function Scene({ data }: { data: AtlasData }) {
  const [quality, setQuality] = useState<'high' | 'low'>('high')
  const down = useRef<{ x: number; y: number } | null>(null)
  const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches

  return (
    <div
      className="canvas-wrap"
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
    >
      <Canvas
        camera={{ fov: FOV, near: 0.01, far: 80, position: [0, 0, 4.5] }}
        dpr={quality === 'high' ? [1, 2] : [1, 1.25]}
        gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: NoToneMapping }}
        onCreated={(state) => {
          if (import.meta.env.DEV) Object.assign(window, { __r3f: state })
        }}
        onPointerMissed={(e) => {
          const d = down.current
          if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6) useAtlas.getState().select(null)
        }}
      >
        <color attach="background" args={[BACKGROUND]} />
        <AspectTracker />
        <PerformanceMonitor onDecline={() => setQuality('low')} onIncline={() => setQuality('high')} flipflops={3} />
        <AdaptiveEvents />
        <StudioLights />
        <Suspense fallback={null}>
          {data.placeholder ? <PlaceholderAnatomy data={data} /> : <GltfAnatomy data={data} />}
        </Suspense>
        <CameraRig data={data} />
        {quality === 'high' && !mobile && (
          <EffectComposer multisampling={4} enableNormalPass={false}>
            <N8AO aoRadius={0.045} distanceFalloff={0.6} intensity={1.6} quality="medium" halfRes color="#1a1a1a" />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}
