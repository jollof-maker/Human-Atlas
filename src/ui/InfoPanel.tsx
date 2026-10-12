import { AnimatePresence, motion } from 'framer-motion'
import type { AtlasData, Structure } from '../data/atlasData'
import { ATTACHMENT_SOURCE } from '../data/attachments'
import { describe, relationsFor } from '../data/knowledge'
import { SYSTEM_BY_ID } from '../data/systems'
import { revealAndSelect } from '../state/actions'
import { useAtlas } from '../state/store'
import { useIsMobile } from './useMedia'
import { CloseIcon, IsolateIcon } from './icons'

function Chip({ s, nearby }: { s: Structure; nearby?: boolean }) {
  return (
    <button className="chip" data-nearby={!!nearby} onClick={() => revealAndSelect(s.key)} title={s.title}>
      <span className="bullet" style={{ background: SYSTEM_BY_ID[s.system].swatch }} />
      <span>{s.title}</span>
    </button>
  )
}

function ChipGroup({ label, items }: { label: string; items: Structure[] }) {
  if (!items.length) return null
  return (
    <>
      <div className="rel-label">{label}</div>
      <div className="chips">
        {items.map((s) => (
          <Chip key={s.key} s={s} />
        ))}
      </div>
    </>
  )
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function Details({ data, s }: { data: AtlasData; s: Structure }) {
  const rel = relationsFor(data, s)
  const hasAttachments = rel.origin.length + rel.insertion.length + rel.supply.length > 0
  const ids = s.pieces.map((p) => p.id)
  return (
    <>
      <div className="info-top">
        <span className="eyebrow">{s.category}</span>
        <button className="close" aria-label="Close" onClick={() => useAtlas.getState().select(null)}>
          <CloseIcon size={14} />
        </button>
      </div>
      <h2 className="info-title">{s.title}</h2>
      <p className="info-desc">{describe(s).join(' ')}</p>

      <dl className="meta-rows">
        <div>
          <dt>ID</dt>
          <dd title={ids.join(', ')}>
            {ids[0]}
            {ids.length > 1 && <span style={{ color: 'var(--muted)' }}> +{ids.length - 1}</span>}
          </dd>
        </div>
        <div>
          <dt>System</dt>
          <dd>{SYSTEM_BY_ID[s.system].label}</dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>{s.region}</dd>
        </div>
        <div>
          <dt>Side</dt>
          <dd>{capitalize(s.side)}</dd>
        </div>
      </dl>

      {hasAttachments && (
        <div className="rel">
          <div className="rel-head">
            <span className="eyebrow">Attachments</span>
            <span className="rel-note" title={ATTACHMENT_SOURCE}>
              Curated
            </span>
          </div>
          <ChipGroup label="Origin" items={rel.origin} />
          <ChipGroup label="Insertion" items={rel.insertion} />
          <ChipGroup label="Arterial supply" items={rel.supply} />
        </div>
      )}

      {rel.attachedMuscles.length > 0 && (
        <div className="rel">
          <div className="rel-head">
            <span className="eyebrow">Attached muscles</span>
            <span className="rel-note" title={ATTACHMENT_SOURCE}>
              Curated
            </span>
          </div>
          <div className="chips">
            {rel.attachedMuscles.map((m) => (
              <Chip key={m.key} s={m} />
            ))}
          </div>
        </div>
      )}

      {rel.nearby.length > 0 && (
        <div className="rel">
          <div className="rel-head">
            <span className="eyebrow">Nearby</span>
            <span className="rel-note">Proximity only, not a verified connection</span>
          </div>
          <div className="chips">
            {rel.nearby.map((n) => (
              <Chip key={n.key} s={n} nearby />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export function InfoPanel() {
  const data = useAtlas((s) => s.data)!
  const selected = useAtlas((s) => s.selected)
  const isolated = useAtlas((s) => s.isolated)
  const setIsolated = useAtlas((s) => s.setIsolated)
  const mobile = useIsMobile()
  const s = selected ? data.structureByKey.get(selected) : null

  return (
    <AnimatePresence>
      {s && (
        <motion.aside
          key="info"
          className="panel info"
          aria-label="Structure information"
          initial={mobile ? { y: '100%' } : { opacity: 0, x: 8 }}
          animate={mobile ? { y: 0 } : { opacity: 1, x: 0 }}
          exit={mobile ? { y: '100%' } : { opacity: 0, x: 8 }}
          transition={{ duration: mobile ? 0.32 : 0.24, ease: [0.32, 0.72, 0, 1] }}
        >
          <div className="sheet-handle" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={s.key}
              className="info-scroll"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
            >
              <Details data={data} s={s} />
            </motion.div>
          </AnimatePresence>
          <div className="info-actions">
            <button className="primary" onClick={() => setIsolated(!isolated)}>
              <IsolateIcon size={15} />
              {isolated ? 'Show surrounding anatomy' : 'Isolate structure'}
            </button>
            <button className="text-button" onClick={() => useAtlas.getState().select(null)}>
              Clear selection
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
