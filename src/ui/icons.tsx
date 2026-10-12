import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number }

const base = ({ size = 16, ...rest }: P) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.35,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
  ...rest,
})

export const SearchIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="7" cy="7" r="4.25" />
    <path d="m10.25 10.25 3 3" />
  </svg>
)

export const PlusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 3.5v9M3.5 8h9" />
  </svg>
)

export const MinusIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3.5 8h9" />
  </svg>
)

/** Front view: a figure facing the viewer inside a frame. */
export const FrontIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <circle cx="8" cy="6" r="1.25" />
    <path d="M5.75 11.5c.3-1.6 1.1-2.5 2.25-2.5s1.95.9 2.25 2.5" />
  </svg>
)

export const OrbitIcon = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="8" cy="8" rx="5.75" ry="2.6" />
    <path d="M8 2.25v11.5" opacity=".55" />
    <path d="m12.2 4.6 1.4.6-.5 1.4" />
  </svg>
)

export const PanIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M8 2v12M2 8h12" />
    <path d="m6.25 3.75 1.75-1.75 1.75 1.75M6.25 12.25 8 14l1.75-1.75M3.75 6.25 2 8l1.75 1.75M12.25 6.25 14 8l-1.75 1.75" />
  </svg>
)

export const ResetIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M3 8a5 5 0 1 0 1.5-3.55" />
    <path d="M3 2.75v2.5h2.5" />
  </svg>
)

export const FullscreenIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M2.75 6V2.75H6M10 2.75h3.25V6M13.25 10v3.25H10M6 13.25H2.75V10" />
  </svg>
)

export const ExitFullscreenIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 2.75V6H2.75M13.25 6H10V2.75M10 13.25V10h3.25M2.75 10H6v3.25" />
  </svg>
)

/** Exploded view: four pieces pulling apart from a centre. */
export const ExplodeIcon = (p: P) => (
  <svg {...base(p)}>
    <rect x="2.25" y="2.25" width="4.25" height="4.25" rx="1" />
    <rect x="9.5" y="2.25" width="4.25" height="4.25" rx="1" />
    <rect x="2.25" y="9.5" width="4.25" height="4.25" rx="1" />
    <rect x="9.5" y="9.5" width="4.25" height="4.25" rx="1" />
  </svg>
)

export const IsolateIcon = (p: P) => (
  <svg {...base(p)}>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M8 1.75v2M8 12.25v2M1.75 8h2M12.25 8h2" />
  </svg>
)

export const CloseIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
  </svg>
)

export const ChevronIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m4.5 6.25 3.5 3.5 3.5-3.5" />
  </svg>
)

export const LayersIcon = (p: P) => (
  <svg {...base(p)}>
    <path d="m8 2.5 5.5 3L8 8.5l-5.5-3z" />
    <path d="m2.5 8.25 5.5 3 5.5-3" />
    <path d="m2.5 11 5.5 3 5.5-3" />
  </svg>
)
