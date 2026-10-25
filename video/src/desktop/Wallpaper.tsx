// The desktop picture: our own soft folds of warm and cool silk, in the
// spirit of macOS's light wallpapers, drawn here so nothing of Apple's is
// copied. The second desktop has the same silk at dusk.
import { SCREEN_H, SCREEN_W } from './geometry.ts'

/** The silk's colours: the ground, the three folds and the dark fold */
const TONES = {
  warm: {
    ground: ['#f4eee6', '#dccfbf', '#a39790', '#77748a', '#5a5f74'],
    a: ['#fbf7f1', '#e5d9ca', '#b8aba0'],
    b: ['#c9b8a6', '#8f8483', '#5d6176'],
    c: ['#9d9aac', '#d9d6dd', '#f1eef0'],
    dark: '#5f6378',
  },
  dusk: {
    ground: ['#eef1f8', '#c9d1e4', '#8e9abd', '#5c6893', '#3c4670'],
    a: ['#f7f9fd', '#d7def0', '#a8b3d2'],
    b: ['#b6c0dc', '#7c87ae', '#495482'],
    c: ['#8b95bd', '#cfd5e8', '#eef1f9'],
    dark: '#4d5884',
  },
} as const

export function Wallpaper({ tone = 'warm' }: { tone?: keyof typeof TONES }) {
  const c = TONES[tone]
  // Both desktops are on screen while they slide, so each one's gradients and filters have ids of their own
  const id = (name: string) => `wp-${tone}-${name}`
  const url = (name: string) => `url(#${id(name)})`
  return (
    <svg width={SCREEN_W} height={SCREEN_H} viewBox={`0 0 ${SCREEN_W} ${SCREEN_H}`} style={{ position: 'absolute', left: 0, top: 0 }}>
      <defs>
        <linearGradient id={id('ground')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.ground[0]} />
          <stop offset="0.3" stopColor={c.ground[1]} />
          <stop offset="0.58" stopColor={c.ground[2]} />
          <stop offset="0.82" stopColor={c.ground[3]} />
          <stop offset="1" stopColor={c.ground[4]} />
        </linearGradient>
        <linearGradient id={id('fold-a')} x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0" stopColor={c.a[0]} />
          <stop offset="0.5" stopColor={c.a[1]} />
          <stop offset="1" stopColor={c.a[2]} />
        </linearGradient>
        <linearGradient id={id('fold-b')} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.b[0]} />
          <stop offset="0.55" stopColor={c.b[1]} />
          <stop offset="1" stopColor={c.b[2]} />
        </linearGradient>
        <linearGradient id={id('fold-c')} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={c.c[0]} />
          <stop offset="0.6" stopColor={c.c[1]} />
          <stop offset="1" stopColor={c.c[2]} />
        </linearGradient>
        <filter id={id('soft')} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id={id('softer')} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
      </defs>
      <rect width={SCREEN_W} height={SCREEN_H} fill={url('ground')} />
      {/* The broad folds, back to front */}
      <path d="M-80 1060 C 160 760, 300 420, 560 260 C 820 100, 1000 -40, 1180 -80 L 1620 -80 L 1620 1060 Z" fill={url('fold-b')} opacity="0.55" filter={url('softer')} />
      <path d="M-120 820 C 120 600, 260 300, 470 140 C 640 10, 760 -40, 900 -80 L -120 -80 Z" fill={url('fold-a')} opacity="0.9" filter={url('soft')} />
      <path d="M330 1080 C 520 820, 760 620, 1020 520 C 1260 430, 1430 300, 1640 120 L 1640 1080 Z" fill={url('fold-c')} opacity="0.5" filter={url('soft')} />
      <path d="M760 1080 C 900 860, 1080 760, 1260 700 C 1400 650, 1520 560, 1640 440 L 1640 1080 Z" fill={c.dark} opacity="0.45" filter={url('softer')} />
      {/* The bright edges where the silk turns */}
      <path d="M-120 820 C 120 600, 260 300, 470 140 C 640 10, 760 -40, 900 -80" fill="none" stroke="#ffffff" strokeOpacity="0.85" strokeWidth="3" filter={url('soft')} />
      <path d="M-120 820 C 120 600, 260 300, 470 140 C 640 10, 760 -40, 900 -80" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.2" />
      <path d="M330 1080 C 520 820, 760 620, 1020 520 C 1260 430, 1430 300, 1640 120" fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="2.4" filter={url('soft')} />
      <path d="M330 1080 C 520 820, 760 620, 1020 520 C 1260 430, 1430 300, 1640 120" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="1" />
      <path d="M40 1080 C 260 860, 420 660, 640 520 C 860 380, 1080 260, 1300 -60" fill="none" stroke="#fff8ee" strokeOpacity="0.35" strokeWidth="2" filter={url('soft')} />
    </svg>
  )
}
