import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { COLLECTIONS } from '../data/systems'
import type { CollectionId } from '../types/anatomy'
import { chooseCollection } from '../state/actions'
import { useAtlas, type SideFilter } from '../state/store'
import { Segmented } from './controls'
import { ChevronIcon } from './icons'

export function CollectionsPanel() {
  const data = useAtlas((s) => s.data)!
  const collection = useAtlas((s) => s.collection)
  const side = useAtlas((s) => s.side)
  const systems = useAtlas((s) => s.systems)
  const open = useAtlas((s) => s.collectionsOpen)
  const setOpen = useAtlas((s) => s.setCollectionsOpen)
  const setSide = useAtlas((s) => s.setSide)

  const counts = useMemo(() => {
    const out = Object.fromEntries(COLLECTIONS.map((c) => [c.id, 0])) as Record<CollectionId, number>
    for (const e of data.entries) {
      if (!systems[e.system]) continue
      if (side !== 'both' && e.side !== 'midline' && e.side !== side) continue
      for (const c of e.collections) out[c]++
    }
    return out
  }, [data, systems, side])

  return (
    <section className="panel collections" aria-label="Specimen collections">
      <button className="collapse-head" data-open={open} aria-expanded={open} onClick={() => setOpen(!open)}>
        <h2 className="panel-title">Specimen collections</h2>
        <ChevronIcon size={14} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.32, 0.72, 0, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p className="subtitle">Study the body, region by region.</p>
            <div className="region-grid">
              {COLLECTIONS.map((c) => (
                <button
                  key={c.id}
                  className="region"
                  data-active={collection === c.id}
                  aria-pressed={collection === c.id}
                  disabled={counts[c.id] === 0}
                  onClick={() => chooseCollection(c.id)}
                >
                  <span>{c.label}</span>
                  <span className="n">{counts[c.id]}</span>
                </button>
              ))}
            </div>
            <Segmented<SideFilter>
              label="Side"
              value={side}
              onChange={setSide}
              options={[
                { value: 'both', label: 'Both' },
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
