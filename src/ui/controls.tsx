import { motion } from 'framer-motion'
import { useId } from 'react'

const SPRING = { type: 'spring' as const, stiffness: 520, damping: 34, mass: 0.6 }

export function Toggle({ on }: { on: boolean }) {
  return (
    <span className="toggle" data-on={on} aria-hidden>
      <motion.span className="thumb" initial={false} animate={{ x: on ? 10 : 0 }} transition={SPRING} />
    </span>
  )
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[]
  value: T | null
  onChange: (v: T) => void
  label: string
}) {
  const id = useId()
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={value === o.value}
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="seg-pill" transition={SPRING} />}
          {o.label}
        </button>
      ))}
    </div>
  )
}
