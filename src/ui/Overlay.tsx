import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useProgress } from '@react-three/drei'
import { chooseCollection, resetView } from '../state/actions'
import { runtime } from '../state/runtime'
import { useAtlas } from '../state/store'
import { CameraToolbar } from './CameraToolbar'
import { CollectionsPanel } from './CollectionsPanel'
import { ExplodeControl } from './ExplodeControl'
import { InfoPanel } from './InfoPanel'
import { SearchBox } from './SearchBox'
import { SystemsPanel } from './SystemsPanel'
import { CloseIcon, LayersIcon } from './icons'
import { useIsMobile } from './useMedia'

const reveal = (i: number) => ({
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.35 + i * 0.06, ease: [0.32, 0.72, 0, 1] as const },
})

/** Opacity-only reveal for wrappers: a transform would re-anchor their absolutely positioned children. */
const fade = (i: number) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.6, delay: 0.35 + i * 0.06, ease: 'easeOut' as const },
})

function Branding() {
  const count = useAtlas((s) => s.data?.entries.length ?? 0)
  const source = useAtlas((s) => s.data?.manifest.source.name ?? '')
  return (
    <motion.header className="brand" {...reveal(0)}>
      <div className="eyebrow">Interactive anatomy</div>
      <h1>
        Human Atlas<sup>3D</sup>
      </h1>
      <div className="meta">
        {count.toLocaleString()} modeled pieces · {source}
      </div>
    </motion.header>
  )
}

function HoverTooltip() {
  const data = useAtlas((s) => s.data)!
  const hovered = useAtlas((s) => s.hovered)
  const s = hovered ? data.structureByKey.get(hovered) : null
  return (
    <div ref={(el) => void (runtime.tooltip = el)} className="hover-tip-anchor" style={{ position: 'fixed', top: 0, left: 0, zIndex: 5, pointerEvents: 'none' }}>
      <AnimatePresence>
        {s && (
          <motion.div
            className="hover-tip"
            style={{ position: 'relative' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
          >
            <span className="t">{s.title}</span>
            <span className="c">{s.category}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function Credits() {
  const open = useAtlas((s) => s.creditsOpen)
  const setOpen = useAtlas((s) => s.setCreditsOpen)
  const source = useAtlas((s) => s.data?.manifest.source)
  return (
    <>
      <button className="credits-link" onClick={() => setOpen(!open)} aria-expanded={open}>
        Sources &amp; credits
      </button>
      <AnimatePresence>
        {open && source && (
          <motion.section
            className="panel credits"
            aria-label="Sources and credits"
            // Centred above the explode card; x is set here so Framer composes it with the y animation.
            style={{ x: '-50%' }}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.22, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="info-top">
              <span className="eyebrow">Sources &amp; credits</span>
              <button className="close" aria-label="Close" onClick={() => setOpen(false)}>
                <CloseIcon size={14} />
              </button>
            </div>
            <h2>Anatomical models</h2>
            <blockquote>{source.attribution}</blockquote>
            <p>
              License:{' '}
              <a href={source.licenseUrl} target="_blank" rel="noreferrer">
                BodyParts3D license terms
              </a>{' '}
              ·{' '}
              <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>
            </p>
            <p>
              Changes: the original OBJ meshes were converted to glTF, simplified, recentred and recoloured, and
              grouped into eight systems for this atlas.
            </p>
            <p>
              Names and is_a / part_of classifications come from the Foundational Model of Anatomy tables distributed
              with BodyParts3D. Muscle attachments are a small curated set from standard anatomical references;
              “nearby” structures are computed from surface proximity only.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  )
}

function LoadingVeil() {
  const ready = useAtlas((s) => s.ready)
  const { progress } = useProgress()
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          className="veil"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
        >
          <div className="veil-inner">
            <div className="veil-text">Preparing specimens · {Math.round(progress)}%</div>
            <div className="veil-bar">
              <span style={{ transform: `scaleX(${progress / 100})` }} />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function useKeyboard() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const s = useAtlas.getState()
      switch (e.key) {
        case 'Escape':
          if (s.creditsOpen) s.setCreditsOpen(false)
          else if (s.isolated) s.setIsolated(false)
          else if (s.selected) s.select(null)
          else if (s.collection) chooseCollection(null)
          break
        case 'f':
        case 'F':
          runtime.camera?.front()
          break
        case 'r':
        case 'R':
          resetView()
          break
        case 'o':
        case 'O':
          s.setTool('orbit')
          break
        case 'p':
        case 'P':
          s.setTool('pan')
          break
        case '+':
        case '=':
          runtime.camera?.zoom(0.72)
          break
        case '-':
        case '_':
          runtime.camera?.zoom(1.38)
          break
        case 'i':
        case 'I':
          if (s.selected) s.setIsolated(!s.isolated)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

export function Overlay() {
  const mobile = useIsMobile()
  const placeholder = useAtlas((s) => s.data?.placeholder)
  const selected = useAtlas((s) => s.selected)
  const [layersOpen, setLayersOpen] = useState(false)
  useKeyboard()

  const rail = (
    <>
      <SystemsPanel />
      <CollectionsPanel />
    </>
  )

  return (
    <div className="ui">
      <Branding />

      {mobile ? (
        <>
          <motion.button className="panel layers-button" onClick={() => setLayersOpen(true)} {...reveal(1)}>
            <LayersIcon size={15} /> Systems
          </motion.button>
          <AnimatePresence>
            {layersOpen && (
              <motion.div
                className="left-rail"
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.32, ease: [0.32, 0.72, 0, 1] }}
              >
                <div className="info-top" style={{ padding: '2px 6px 0' }}>
                  <span className="eyebrow">Layers</span>
                  <button className="close" aria-label="Close" onClick={() => setLayersOpen(false)}>
                    <CloseIcon size={14} />
                  </button>
                </div>
                {rail}
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <motion.div className="left-rail" {...reveal(1)}>
          {rail}
        </motion.div>
      )}

      <motion.div {...fade(2)} style={{ pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          <SearchBox />
        </div>
      </motion.div>
      <motion.div {...fade(3)} style={{ pointerEvents: 'none' }}>
        <div style={{ pointerEvents: 'auto' }}>
          <CameraToolbar />
        </div>
      </motion.div>
      {!(mobile && selected) && (
        <motion.div {...fade(4)} style={{ pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <ExplodeControl />
          </div>
        </motion.div>
      )}

      <InfoPanel />

      <motion.div className="hint" {...reveal(5)}>
        Drag to orbit · Scroll to zoom · Tap to inspect
      </motion.div>
      <Credits />
      <HoverTooltip />
      {placeholder && (
        <div className="panel placeholder-note">
          Placeholder geometry · run <code>npm run build:anatomy</code> to build the BodyParts3D models
        </div>
      )}
      <LoadingVeil />
    </div>
  )
}
