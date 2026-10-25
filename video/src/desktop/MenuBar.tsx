// The menu bar across the top of the screen: the app in front and its menus
// on the left, the status items and the clock on the right.
import { MENU_H, SCREEN_W } from './geometry.ts'

export const SYSTEM_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", sans-serif'

const MENUS: Record<string, string[]> = {
  Claude: ['File', 'Edit', 'View', 'Window', 'Help'],
  Browser: ['File', 'Edit', 'View', 'History', 'Bookmarks', 'Window', 'Help'],
}

function Wifi() {
  return (
    <svg width="17" height="13" viewBox="0 0 17 13" fill="none">
      <path d="M1.2 4.6a10.6 10.6 0 0 1 14.6 0" stroke="#1d1d1f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M3.8 7.4a6.8 6.8 0 0 1 9.4 0" stroke="#1d1d1f" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6.4 10.1a3.1 3.1 0 0 1 4.2 0" stroke="#1d1d1f" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function Battery() {
  return (
    <svg width="27" height="13" viewBox="0 0 27 13" fill="none">
      <rect x="0.75" y="0.75" width="22.5" height="11.5" rx="3.4" stroke="#1d1d1f" strokeOpacity="0.55" strokeWidth="1.2" />
      <rect x="2.4" y="2.4" width="15.6" height="8.2" rx="1.9" fill="#1d1d1f" />
      <path d="M24.8 4.6v3.8c.8-.3 1.3-1 1.3-1.9s-.5-1.6-1.3-1.9z" fill="#1d1d1f" fillOpacity="0.5" />
    </svg>
  )
}

function Controls() {
  return (
    <svg width="17" height="14" viewBox="0 0 17 14" fill="none">
      <rect x="0.8" y="0.8" width="15.4" height="5" rx="2.5" stroke="#1d1d1f" strokeWidth="1.4" />
      <circle cx="13.6" cy="3.3" r="1.4" fill="#1d1d1f" />
      <rect x="0.8" y="8.2" width="15.4" height="5" rx="2.5" stroke="#1d1d1f" strokeWidth="1.4" />
      <circle cx="3.4" cy="10.7" r="1.4" fill="#1d1d1f" />
    </svg>
  )
}

export function MenuBar({ app, clock }: { app: 'Claude' | 'Browser'; clock: string }) {
  const menus = MENUS[app] ?? []
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: SCREEN_W,
        height: MENU_H,
        display: 'flex',
        alignItems: 'center',
        padding: '0 14px 0 22px',
        boxSizing: 'border-box',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.42), rgba(255,255,255,0.26))',
        backdropFilter: 'blur(24px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
        font: `500 14px/1 ${SYSTEM_FONT}`,
        color: '#1d1d1f',
        letterSpacing: '-0.01em',
      }}
    >
      <span style={{ fontWeight: 700, marginRight: 20 }}>{app === 'Claude' ? 'Claude' : 'Browser'}</span>
      {menus.map((m) => (
        <span key={m} style={{ marginRight: 20 }}>
          {m}
        </span>
      ))}
      <span style={{ flex: 1 }} />
      <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <Battery />
        <Wifi />
        <Controls />
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{clock}</span>
      </span>
    </div>
  )
}
