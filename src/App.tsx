import { useEffect } from 'react'
import { loadAtlas } from './data/loadAtlas'
import { Scene } from './scene/Scene'
import { preloadAnatomy } from './scene/assets'
import { useAtlas } from './state/store'
import { Overlay } from './ui/Overlay'

export default function App() {
  const data = useAtlas((s) => s.data)

  useEffect(() => {
    let alive = true
    loadAtlas().then((d) => {
      if (!alive) return
      if (!d.placeholder) preloadAnatomy(d)
      useAtlas.getState().setData(d)
    })
    return () => {
      alive = false
    }
  }, [])

  if (!data) {
    return (
      <div className="veil">
        <div className="veil-inner">
          <div className="veil-text">Preparing specimens</div>
          <div className="veil-bar">
            <span style={{ transform: 'scaleX(0.04)' }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <Scene data={data} />
      <Overlay />
    </>
  )
}
