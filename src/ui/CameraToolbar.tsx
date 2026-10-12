import { useEffect, useState, type ReactNode } from 'react'
import { resetView, toggleFullscreen } from '../state/actions'
import { runtime } from '../state/runtime'
import { useAtlas } from '../state/store'
import {
  ExitFullscreenIcon,
  FrontIcon,
  FullscreenIcon,
  MinusIcon,
  OrbitIcon,
  PanIcon,
  PlusIcon,
  ResetIcon,
} from './icons'

function Tool({
  label,
  hint,
  active,
  onClick,
  children,
}: {
  label: string
  hint?: string
  active?: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button className="tool" data-active={!!active} aria-label={label} aria-pressed={active} onClick={onClick}>
      {children}
      <span className="tool-tip" role="tooltip">
        {label}
        {hint && <span className="k">{hint}</span>}
      </span>
    </button>
  )
}

export function CameraToolbar() {
  const tool = useAtlas((s) => s.tool)
  const setTool = useAtlas((s) => s.setTool)
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    const onChange = () => setFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  return (
    <nav className="panel toolbar" aria-label="Camera">
      <Tool label="Zoom in" hint="+" onClick={() => runtime.camera?.zoom(0.72)}>
        <PlusIcon />
      </Tool>
      <Tool label="Front view" hint="F" onClick={() => runtime.camera?.front()}>
        <FrontIcon />
      </Tool>
      <Tool label="Zoom out" hint="−" onClick={() => runtime.camera?.zoom(1.38)}>
        <MinusIcon />
      </Tool>
      <div className="tool-sep" />
      <Tool label="Orbit" hint="O" active={tool === 'orbit'} onClick={() => setTool('orbit')}>
        <OrbitIcon />
      </Tool>
      <Tool label="Pan" hint="P" active={tool === 'pan'} onClick={() => setTool('pan')}>
        <PanIcon />
      </Tool>
      <div className="tool-sep" />
      <Tool label="Reset camera" hint="R" onClick={resetView}>
        <ResetIcon />
      </Tool>
      <Tool label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
        {fullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
      </Tool>
    </nav>
  )
}
