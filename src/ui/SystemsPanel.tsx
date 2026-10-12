import { useMemo } from 'react'
import { COLLECTIONS, PRESETS, SYSTEMS, SYSTEM_IDS } from '../data/systems'
import { effectiveArms, inScope, useAtlas, type ArmsPose } from '../state/store'
import { Segmented, Toggle } from './controls'

type Preset = keyof typeof PRESETS

export function SystemsPanel() {
  const data = useAtlas((s) => s.data)!
  const systems = useAtlas((s) => s.systems)
  const collection = useAtlas((s) => s.collection)
  const side = useAtlas((s) => s.side)
  const arms = useAtlas((s) => s.arms)
  const toggleSystem = useAtlas((s) => s.toggleSystem)
  const setSystems = useAtlas((s) => s.setSystems)
  const setArms = useAtlas((s) => s.setArms)
  const shownArms = effectiveArms({ arms, collection })

  const on = SYSTEM_IDS.filter((id) => systems[id])
  const preset = (Object.keys(PRESETS) as Preset[]).find(
    (k) => PRESETS[k].length === on.length && PRESETS[k].every((id) => systems[id]),
  )

  const visible = useMemo(
    () => data.entries.reduce((n, e) => n + (inScope({ systems, collection, side, arms, data }, e) ? 1 : 0), 0),
    [data, systems, collection, side, arms],
  )

  return (
    <section className="panel systems" aria-label="Systems">
      <div className="panel-head">
        <h2 className="panel-title">Systems</h2>
        <span className="badge">
          {on.length}/{SYSTEMS.length}
        </span>
      </div>
      <Segmented<Preset>
        label="System presets"
        value={preset ?? null}
        onChange={(p) => setSystems(PRESETS[p])}
        options={[
          { value: 'all', label: 'All' },
          { value: 'skeleton', label: 'Skeleton' },
          { value: 'organs', label: 'Organs' },
        ]}
      />
      <div className="arms">
        <span className="arms-label" id="arms-label">
          Arms
        </span>
        <Segmented<ArmsPose>
          label="Arms"
          value={arms}
          onChange={setArms}
          options={[
            { value: 'down', label: 'Down' },
            { value: 'raised', label: 'Raised' },
            { value: 'hidden', label: 'Hidden' },
          ]}
        />
      </div>
      {arms !== 'down' && shownArms === 'down' ? (
        <p className="arms-note">
          Arms shown down for the {COLLECTIONS.find((c) => c.id === collection)?.label} collection.
        </p>
      ) : shownArms === 'raised' ? (
        <p className="arms-note">Approximate pose. Shoulder region is not anatomically accurate.</p>
      ) : null}
      <ul className="system-list">
        {SYSTEMS.map((s) => (
          <li key={s.id}>
            <button
              className="system-row"
              data-off={!systems[s.id]}
              role="switch"
              aria-checked={systems[s.id]}
              onClick={() => toggleSystem(s.id)}
            >
              <span className="bullet" style={{ background: s.swatch }} />
              <span className="name">{s.label}</span>
              <span className="count">{data.systemCounts[s.id].toLocaleString()}</span>
              <Toggle on={systems[s.id]} />
            </button>
          </li>
        ))}
      </ul>
      <div className="panel-foot">
        <span>{visible.toLocaleString()} pieces visible</span>
        {on.length > 0 ? (
          <button className="text-button" onClick={() => setSystems([])}>
            Hide all
          </button>
        ) : (
          <button className="text-button" onClick={() => setSystems(SYSTEM_IDS)}>
            Show all
          </button>
        )}
      </div>
    </section>
  )
}
