import { useRef } from 'react'
import { COLLECTIONS } from '../data/systems'
import { chooseCollection } from '../state/actions'
import { runtime } from '../state/runtime'
import { useAtlas } from '../state/store'
import { ExplodeIcon } from './icons'

export function ExplodeControl() {
  const explode = useAtlas((s) => s.explode)
  const collection = useAtlas((s) => s.collection)
  const selected = useAtlas((s) => s.selected)
  const setExplode = useAtlas((s) => s.setExplode)
  const dragging = useRef(false)
  const pct = Math.round(explode * 100)

  const label = collection ? COLLECTIONS.find((c) => c.id === collection)?.label : null
  const caption = label
    ? `${label} · ${explode >= 0.5 ? 'Specimen sheet' : 'Anatomical position'}`
    : explode >= 0.5
      ? 'Atlas sheet · Catalogued by size'
      : 'Anatomical position · Front'

  const reset = () => {
    if (collection) chooseCollection(null)
    else if (explode > 0) setExplode(0)
    else runtime.camera?.reset()
  }

  return (
    <div className="explode-wrap">
      <div className="caption" aria-live="polite" style={{ opacity: selected ? 0 : 1 }}>
        {caption}
      </div>
      <div className="panel explode">
        <div className="explode-main">
          <div className="explode-head">
            <ExplodeIcon size={14} />
            <span>Explode anatomy</span>
            <span className="pct">{pct}%</span>
          </div>
          <div className="slider">
            <input
              type="range"
              min={0}
              max={1000}
              step={1}
              value={Math.round(explode * 1000)}
              aria-label="Explode anatomy"
              aria-valuetext={`${pct}%`}
              onPointerDown={() => (dragging.current = true)}
              onPointerUp={(e) => {
                dragging.current = false
                setExplode(Number(e.currentTarget.value) / 1000, false)
              }}
              onChange={(e) => setExplode(Number(e.target.value) / 1000, dragging.current)}
            />
            <span className="rail" />
            <span className="fill" style={{ width: `${explode * 100}%` }} />
            <span className="knob" style={{ left: `${explode * 100}%` }} />
          </div>
          <div className="explode-ends">
            <button onClick={() => setExplode(0)}>Assembled</button>
            <button onClick={() => setExplode(1)}>Every piece</button>
          </div>
        </div>
        <div className="vdivider" />
        <button className="reset" onClick={reset}>
          Reset
        </button>
      </div>
    </div>
  )
}
