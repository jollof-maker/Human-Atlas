import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { Structure } from '../data/atlasData'
import { SYSTEM_BY_ID } from '../data/systems'
import { revealAndSelect } from '../state/actions'
import { useAtlas } from '../state/store'
import { SearchIcon } from './icons'

const MAX_RESULTS = 8

function rank(structures: Structure[], query: string): Structure[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/)
  const scored: { s: Structure; score: number }[] = []
  for (const s of structures) {
    const name = s.name.toLowerCase()
    if (!tokens.every((t) => name.includes(t))) continue
    let score = 3
    if (name.startsWith(q)) score = 0
    else if (name.replace(/^(left|right) /, '').startsWith(q)) score = 0.5
    else if (new RegExp(`\\b${escapeRe(tokens[0])}`).test(name)) score = 1
    else if (name.includes(q)) score = 2
    scored.push({ s, score: score + name.length / 1000 })
  }
  return scored.sort((a, b) => a.score - b.score).slice(0, MAX_RESULTS).map((x) => x.s)
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = query.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return <>{text}</>
  const re = new RegExp(`(${tokens.map(escapeRe).join('|')})`, 'ig')
  return (
    <>
      {text.split(re).map((part, i) => (i % 2 === 1 ? <mark key={i}>{part}</mark> : <span key={i}>{part}</span>))}
    </>
  )
}

export function SearchBox() {
  const data = useAtlas((s) => s.data)!
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => rank(data.structures, query), [data, query])
  const open = focused && query.trim().length > 0

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement
      if (e.key === '/' && !typing) {
        e.preventDefault()
        input.current?.focus()
        input.current?.select()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choose = (s: Structure) => {
    revealAndSelect(s.key)
    setQuery('')
    input.current?.blur()
  }

  return (
    <div className="search" role="search">
      <label className="panel search-box">
        <SearchIcon size={15} />
        <input
          ref={input}
          value={query}
          placeholder="Find a structure"
          aria-label="Find a structure"
          aria-expanded={open}
          aria-controls="search-results"
          aria-autocomplete="list"
          role="combobox"
          spellCheck={false}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setActive((a) => Math.min(results.length - 1, a + 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((a) => Math.max(0, a - 1))
            } else if (e.key === 'Enter' && results[active]) {
              choose(results[active])
            } else if (e.key === 'Escape') {
              setQuery('')
              input.current?.blur()
            }
          }}
        />
        {!focused && !query && <span className="kbd">/</span>}
      </label>
      <AnimatePresence>
        {open && (
          <motion.div
            id="search-results"
            role="listbox"
            className="panel results"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {results.length === 0 && <div className="no-results">No structures match “{query.trim()}”.</div>}
            {results.map((s, i) => (
              <button
                key={s.key}
                role="option"
                aria-selected={i === active}
                className="result"
                data-active={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
              >
                <span className="bullet" style={{ background: SYSTEM_BY_ID[s.system].swatch }} />
                <span>
                  <span className="r-name">
                    <Highlight text={s.title} query={query} />
                  </span>
                  <span className="r-meta">
                    {s.category} · {s.region}
                    {s.pieces.length > 1 ? ` · ${s.pieces.length} pieces` : ''}
                  </span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
