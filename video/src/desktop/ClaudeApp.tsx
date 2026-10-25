// The Claude desktop app's Code tab in its light theme, as the video needs it:
// the sidebar of sessions, the session's title bar, its transcript, and the
// prompt box with the band above it, where the mod draws its plate. The plate
// is the mod's own picture (packages/mod/src/core/band.ts), drawn as the
// desktop draws a mod's Svg: as an image. The band's container, the prompt
// box and their colours follow what the design system measured from the app.
import type { ReactNode } from 'react'

import { plate } from '../../../packages/mod/src/core/band.ts'
import { clamp01, ease, mix } from '../lib/anim.ts'
import { SYSTEM_FONT } from './MenuBar.tsx'
import { TrafficLights } from './MacWindow.tsx'

const INK = '#141413'
const INK_2 = '#5e5d59'
const INK_3 = '#8f8e88'
const LINE = '#e6e3da'
const GROUND = '#faf9f5'
const SIDEBAR = '#f4f2ec'
const BAND = '#f0eee6'
const MONO = 'ui-monospace, "SF Mono", Menlo, monospace'

const plates = { in: plate('in'), out: plate('out') }
const plateUrl = (kind: 'in' | 'out') => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(plates[kind].svg)}`

export const SIDEBAR_W = 252
const MAIN_W = 1196 - SIDEBAR_W
const COLUMN_W = 700
export const COLUMN_X = SIDEBAR_W + Math.round((MAIN_W - COLUMN_W) / 2)
export const PROMPT_Y = 876 - 46 - 106
export const BAND_Y = PROMPT_Y - 6 - 43
/** Where the plate sits in the window: 8 px into the band's container, centred in its 40 px line */
export const PLATE = { x: COLUMN_X + 8, y: BAND_Y + 11, w: plates.in.width, wOut: plates.out.width, h: 22 }

export interface Session {
  title: string
  project: string
  state: 'working' | 'input' | 'done' | 'idle'
}

export const SESSIONS: Session[] = [
  { title: 'Fix flaky checkout test', project: 'web-shop', state: 'working' },
  { title: 'Refactor auth middleware', project: 'api-server', state: 'working' },
  { title: 'Write release notes for 2.4', project: 'docs-site', state: 'working' },
  { title: 'Migrate settings to SQLite', project: 'desktop-app', state: 'working' },
  { title: 'Update onboarding copy', project: 'web-shop', state: 'idle' },
]

function Spinner({ spin, size = 14, color = INK_3 }: { spin: number; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" style={{ transform: `rotate(${spin * 360}deg)`, flex: 'none' }}>
      <circle cx="7" cy="7" r="5.2" fill="none" stroke={color} strokeOpacity="0.25" strokeWidth="1.8" />
      <path d="M7 1.8a5.2 5.2 0 0 1 5.2 5.2" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function StateGlyph({ state, spin }: { state: Session['state']; spin: number }) {
  if (state === 'working') return <Spinner spin={spin} />
  if (state === 'input') return <span style={{ width: 8, height: 8, margin: 3, borderRadius: 4, background: '#d97a2b', flex: 'none' }} />
  if (state === 'done')
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" style={{ flex: 'none' }}>
        <path d="M3 7.4l2.6 2.5L11 4.4" fill="none" stroke="#4a8a4a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  return <span style={{ width: 14, flex: 'none' }} />
}

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke={INK_2} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none' }}>
      <path d={d} />
    </svg>
  )
}

const ICONS = {
  sidebar: 'M2.5 3.5h11v9h-11zM6.5 3.5v9',
  plus: 'M8 3v10M3 8h10',
  terminal: 'M2.5 3.5h11v9h-11zM5 6.5l2 1.5-2 1.5M8.5 10h2.5',
  globe: 'M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM2.5 8h11M8 2.5c1.6 1.5 2.4 3.3 2.4 5.5S9.6 12 8 13.5M8 2.5C6.4 4 5.6 5.8 5.6 8S6.4 12 8 13.5',
  folder: 'M2.5 4.5h4l1.2 1.4h5.8v6.6h-11z',
  more: 'M4 8h.01M8 8h.01M12 8h.01',
  caret: 'M5.5 6.5L8 9l2.5-2.5',
  edit: 'M3 13l.6-2.6L10.4 3.6l2 2-6.8 6.8zM9.4 4.6l2 2',
  run: 'M3 4.5l3 3-3 3M7.5 11h5',
  read: 'M3.5 2.5h6l3 3v8h-9zM9.5 2.5v3h3',
  send: 'M8 12.5v-9M4.5 7L8 3.5 11.5 7',
}

function ToolRow({ icon, children, chip }: { icon: string; children: ReactNode; chip?: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, font: `500 13.5px/1.2 ${SYSTEM_FONT}`, color: INK_2, padding: '7px 0' }}>
      <Icon d={icon} size={15} />
      <span>{children}</span>
      {chip}
      <svg width="12" height="12" viewBox="0 0 16 16" style={{ marginLeft: 2 }}>
        <path d="M6 4l4 4-4 4" fill="none" stroke={INK_3} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

const Mono = ({ children }: { children: ReactNode }) => <span style={{ font: `500 12.5px/1 ${MONO}`, color: INK, background: '#efede6', borderRadius: 5, padding: '3px 6px' }}>{children}</span>

const Diff = ({ plus, minus }: { plus: number; minus: number }) => (
  <span style={{ font: `600 12.5px/1 ${MONO}` }}>
    <span style={{ color: '#3d8a4a' }}>+{plus}</span> <span style={{ color: '#c4473c' }}>−{minus}</span>
  </span>
)

const Para = ({ children }: { children: ReactNode }) => <p style={{ margin: '10px 0', font: `400 15px/1.55 ${SYSTEM_FONT}`, color: INK }}>{children}</p>

export type Transcript = 'working' | 'permission' | 'allowed'

export interface ClaudeAppProps {
  active: boolean
  /** This session is on air: the plate says TUNE OUT */
  tuned: boolean
  /** 0 to 1: the pointer pressing the plate */
  press?: number
  /** The pointer is on the plate */
  plateHover?: boolean
  transcript?: Transcript
  /** Seconds, for the spinners */
  time: number
  /** The permission card's buttons: the one under the pointer, and how far a press has gone */
  allowHover?: boolean
  allowPress?: number
  /** 0 to 1: the permission card giving way to the command it ran */
  allowed?: number
}

export function ClaudeApp({ active, tuned, press = 0, plateHover = false, transcript = 'working', time, allowHover = false, allowPress = 0, allowed = 0 }: ClaudeAppProps) {
  const spin = time * 1.1
  const kind = tuned ? 'out' : 'in'
  const sessions = SESSIONS.map((s, i) => (i === 0 && transcript !== 'working' && allowed < 1 ? { ...s, state: 'input' as const } : s))
  return (
    <div style={{ position: 'absolute', inset: 0, background: GROUND, font: `400 14px/1.4 ${SYSTEM_FONT}`, color: INK, letterSpacing: '-0.005em' }}>
      {/* The sidebar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: SIDEBAR_W, background: SIDEBAR, borderRight: `1px solid #ebe8df` }}>
        <TrafficLights active={active} style={{ position: 'absolute', left: 18, top: 19 }} />
        <div style={{ position: 'absolute', right: 16, top: 16 }}>
          <Icon d={ICONS.sidebar} size={17} />
        </div>
        <div style={{ position: 'absolute', left: 14, right: 14, top: 54, height: 32, borderRadius: 10, background: '#e9e7df', display: 'flex', padding: 3, boxSizing: 'border-box' }}>
          {['Chat', 'Cowork', 'Code'].map((m) => (
            <div
              key={m}
              style={{
                flex: 1,
                borderRadius: 7,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: `${m === 'Code' ? 600 : 500} 13px/1 ${SYSTEM_FONT}`,
                color: m === 'Code' ? INK : INK_2,
                background: m === 'Code' ? '#ffffff' : 'transparent',
                boxShadow: m === 'Code' ? '0 1px 2px rgba(0,0,0,0.12), 0 0 0 0.5px rgba(0,0,0,0.06)' : undefined,
              }}
            >
              {m}
            </div>
          ))}
        </div>
        <div style={{ position: 'absolute', left: 14, right: 14, top: 100, height: 34, display: 'flex', alignItems: 'center', gap: 9, padding: '0 8px', font: `500 14px/1 ${SYSTEM_FONT}` }}>
          <Icon d={ICONS.plus} />
          <span style={{ flex: 1 }}>New session</span>
          <span style={{ font: `500 12px/1 ${SYSTEM_FONT}`, color: INK_3 }}>⌘N</span>
        </div>
        <div style={{ position: 'absolute', left: 22, top: 150, font: `600 12px/1 ${SYSTEM_FONT}`, color: INK_3 }}>Sessions</div>
        {sessions.map((s, i) => (
          <div
            key={s.title}
            style={{
              position: 'absolute',
              left: 10,
              right: 10,
              top: 168 + i * 50,
              height: 46,
              borderRadius: 9,
              background: i === 0 ? '#e8e5dc' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px',
              opacity: s.state === 'idle' ? 0.62 : 1,
            }}
          >
            <StateGlyph state={s.state} spin={spin + i * 0.23} />
            <div style={{ minWidth: 0 }}>
              <div style={{ font: `${i === 0 ? 600 : 500} 13.5px/1.25 ${SYSTEM_FONT}`, color: INK, whiteSpace: 'nowrap' }}>{s.title}</div>
              <div style={{ font: `400 12px/1.3 ${SYSTEM_FONT}`, color: INK_3 }}>{s.project}</div>
            </div>
          </div>
        ))}
      </div>

      {/* The session's title bar */}
      <div style={{ position: 'absolute', left: SIDEBAR_W, right: 0, top: 0, height: 54, display: 'flex', alignItems: 'center', padding: '0 18px 0 24px', borderBottom: '1px solid #efede6' }}>
        <span style={{ font: `600 14.5px/1 ${SYSTEM_FONT}` }}>Fix flaky checkout test</span>
        <Icon d={ICONS.caret} />
        <span style={{ marginLeft: 8, font: `400 13px/1 ${SYSTEM_FONT}`, color: INK_3 }}>web-shop</span>
        <span style={{ flex: 1 }} />
        <span style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Icon d={ICONS.terminal} />
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 9px', borderRadius: 7, background: '#f1efe8' }}>
            <Diff plus={allowed > 0 ? 14 : 12} minus={4} />
          </span>
          <Icon d={ICONS.globe} />
          <Icon d={ICONS.folder} />
          <Icon d={ICONS.more} />
        </span>
      </div>

      {/* The transcript, scrolled to its latest turn just above the prompt box */}
      <div style={{ position: 'absolute', left: SIDEBAR_W, right: 0, top: 55, height: BAND_Y - 55 - 18, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: COLUMN_X - SIDEBAR_W, bottom: 0, width: COLUMN_W }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ maxWidth: 470, background: '#f0eee6', borderRadius: 18, padding: '11px 16px', font: `400 15px/1.5 ${SYSTEM_FONT}` }}>
              The checkout test fails about one run in five. Find out why and fix it.
            </div>
          </div>
          <Para>I’ll run the checkout tests a few times to catch the failure in the act.</Para>
          <ToolRow icon={ICONS.run} chip={<span style={{ font: `500 12.5px/1 ${SYSTEM_FONT}`, color: '#b4483d' }}>1 of 5 failed</span>}>
            Ran <Mono>npm test -- checkout</Mono> five times
          </ToolRow>
          <ToolRow icon={ICONS.read}>Read 3 files</ToolRow>
          <Para>
            The failing run reads the cart’s total before the discount timer fires. The test should wait for the timer instead of assuming it already ran.
          </Para>
          <ToolRow icon={ICONS.edit} chip={<Diff plus={12} minus={4} />}>
            Edited <Mono>cart.test.ts</Mono>
          </ToolRow>
          {transcript === 'working' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, font: `500 14px/1 ${SYSTEM_FONT}`, color: INK_2 }}>
              <Spinner spin={spin} size={15} color="#8a8981" />
              Running the checkout tests again…
            </div>
          ) : (
            <>
              <Para>The test needs a fake timer package that isn’t installed yet.</Para>
              <PermissionCard hover={allowHover} press={allowPress} allowed={allowed} spin={spin} />
            </>
          )}
        </div>
      </div>

      {/* The band above the prompt box: the desktop's container, and the mod's plate in it */}
      <div style={{ position: 'absolute', left: COLUMN_X, top: BAND_Y, width: COLUMN_W, height: 43, borderRadius: 11, background: BAND, display: 'flex', alignItems: 'center', padding: '0 8px', boxSizing: 'border-box' }}>
        <div
          style={{
            position: 'relative',
            height: 22,
            transform: `scale(${1 - 0.05 * press})`,
            transformOrigin: '50% 50%',
            filter: plateHover ? `brightness(${mix(1.08, 0.86, press)})` : undefined,
          }}
        >
          <img src={plateUrl(kind)} width={plates[kind].width} height={22} alt={plates[kind].alt} style={{ display: 'block' }} />
        </div>
      </div>

      {/* The prompt box and the row under it */}
      <div style={{ position: 'absolute', left: COLUMN_X, top: PROMPT_Y, width: COLUMN_W, height: 106, borderRadius: 18, border: `1px solid ${LINE}`, background: '#ffffff', boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        <span style={{ position: 'absolute', left: 18, top: 17, font: `400 15.5px/1 ${SYSTEM_FONT}`, color: '#8b8a84' }}>Reply…</span>
        <span style={{ position: 'absolute', left: 12, bottom: 12, width: 30, height: 30, borderRadius: 9, border: `1px solid ${LINE}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={ICONS.plus} size={15} />
        </span>
        <span style={{ position: 'absolute', right: 12, bottom: 12, width: 30, height: 30, borderRadius: 9, background: LINE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon d={ICONS.send} size={15} />
        </span>
      </div>
      <div style={{ position: 'absolute', left: COLUMN_X + 6, top: PROMPT_Y + 116, display: 'flex', gap: 16, font: `500 12.5px/1 ${SYSTEM_FONT}`, color: INK_2 }}>
        <span>Local</span>
        <span>web-shop</span>
        <span>Accept edits</span>
        <span style={{ flex: 1 }} />
      </div>
      <div style={{ position: 'absolute', left: COLUMN_X + COLUMN_W - 150, top: PROMPT_Y + 116, display: 'flex', alignItems: 'center', gap: 10, font: `500 12.5px/1 ${SYSTEM_FONT}`, color: INK_2 }}>
        <span>Opus 5.5</span>
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5.4" fill="none" stroke="#d8d5cc" strokeWidth="2" />
          <path d="M7 1.6a5.4 5.4 0 0 1 4.6 8.2" fill="none" stroke="#8f8e88" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  )
}

/** Claude asks before it runs a command: the command, its description, and the three answers */
function PermissionCard({ hover, press, allowed, spin }: { hover: boolean; press: number; allowed: number; spin: number }) {
  if (allowed >= 1) {
    return (
      <>
        <ToolRow icon={ICONS.run} chip={<span style={{ font: `500 12.5px/1 ${SYSTEM_FONT}`, color: '#3d8a4a' }}>added 1 package</span>}>
          Ran <Mono>npm install</Mono>
        </ToolRow>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, font: `500 14px/1 ${SYSTEM_FONT}`, color: INK_2 }}>
          <Spinner spin={spin} size={15} color="#8a8981" />
          Running the checkout tests again…
        </div>
      </>
    )
  }
  const fade = 1 - ease.inOut(clamp01(allowed))
  return (
    <div
      style={{
        marginTop: 14,
        border: `1px solid ${LINE}`,
        borderRadius: 16,
        background: '#ffffff',
        padding: '16px 18px',
        boxShadow: '0 6px 24px rgba(20,20,19,0.08)',
        opacity: fade,
      }}
    >
      <div style={{ font: `600 15px/1.3 ${SYSTEM_FONT}`, color: INK }}>Allow Claude to run this command?</div>
      <div style={{ marginTop: 12, background: '#f5f4ee', borderRadius: 10, padding: '11px 13px', font: `500 14px/1 ${MONO}`, color: INK }}>npm install</div>
      <div style={{ marginTop: 9, font: `400 13.5px/1.3 ${SYSTEM_FONT}`, color: INK_2 }}>Install dependencies</div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, justifyContent: 'flex-end' }}>
        {['Deny', 'Always allow', 'Allow once'].map((label) => {
          const primary = label === 'Allow once'
          return (
            <span
              key={label}
              style={{
                padding: '9px 15px',
                borderRadius: 9,
                font: `600 13.5px/1 ${SYSTEM_FONT}`,
                color: primary ? '#ffffff' : INK,
                background: primary ? (hover ? '#2b2a27' : INK) : '#ffffff',
                border: primary ? `1px solid ${INK}` : `1px solid ${LINE}`,
                transform: primary ? `scale(${1 - 0.04 * press})` : undefined,
              }}
            >
              {label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
