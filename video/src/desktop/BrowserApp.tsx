// The other app: a plain browser with no maker's marks, open on the docs
// site's release notes, where you might be while Claude works.
import { SYSTEM_FONT } from './MenuBar.tsx'
import { TrafficLights } from './MacWindow.tsx'

const INK = '#1d1d1f'
const MUTED = '#6e6e73'

function Chevron({ left }: { left?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ transform: left ? 'scaleX(-1)' : undefined }}>
      <path d="M6 3.5L10.5 8 6 12.5" fill="none" stroke="#86868b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function Lines({ widths, gap = 12 }: { widths: number[]; gap?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {widths.map((w, i) => (
        <span key={i} style={{ display: 'block', height: 10, width: `${w}%`, borderRadius: 5, background: '#e8e6e1' }} />
      ))}
    </div>
  )
}

export function BrowserApp({ active, scroll = 0 }: { active: boolean; scroll?: number }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: '#ffffff', font: `400 15px/1.5 ${SYSTEM_FONT}`, color: INK }}>
      {/* Toolbar */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 56, background: '#f6f5f2', borderBottom: '1px solid #e4e2dd', display: 'flex', alignItems: 'center', padding: '0 18px' }}>
        <TrafficLights active={active} />
        <span style={{ display: 'flex', gap: 14, marginLeft: 26 }}>
          <Chevron left />
          <Chevron />
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ width: 520, height: 34, borderRadius: 11, background: '#ebe9e4', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, font: `500 14px/1 ${SYSTEM_FONT}`, color: '#3a3a3c' }}>
          <svg width="11" height="13" viewBox="0 0 11 13">
            <rect x="1" y="5.5" width="9" height="6.5" rx="1.6" fill="#86868b" />
            <path d="M3 5.5V4a2.5 2.5 0 0 1 5 0v1.5" fill="none" stroke="#86868b" strokeWidth="1.4" />
          </svg>
          docs.harbor.dev/release-notes/2.4
        </span>
        <span style={{ flex: 1 }} />
        <span style={{ width: 60 }} />
      </div>

      {/* The page */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 56, bottom: 0, overflow: 'hidden' }}>
        <div style={{ transform: `translateY(${-scroll}px)` }}>
        <div style={{ height: 60, borderBottom: '1px solid #eeece8', display: 'flex', alignItems: 'center', padding: '0 48px', gap: 30, font: `500 14.5px/1 ${SYSTEM_FONT}`, color: MUTED }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 10, color: INK, fontWeight: 700, fontSize: 16 }}>
            <span style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #3c6df0, #1e3f9e)' }} />
            Harbor
          </span>
          <span>Guides</span>
          <span>API</span>
          <span style={{ color: INK }}>Release notes</span>
          <span>Community</span>
        </div>
        <div style={{ display: 'flex', padding: '44px 48px 0', gap: 56 }}>
          <div style={{ width: 200, flex: 'none', display: 'flex', flexDirection: 'column', gap: 14, font: `500 14px/1.2 ${SYSTEM_FONT}`, color: MUTED }}>
            <span style={{ color: INK, fontWeight: 600 }}>2.4</span>
            <span>2.3</span>
            <span>2.2</span>
            <span>2.1</span>
            <span>2.0</span>
            <span>Upgrading</span>
          </div>
          <div style={{ flex: 1, maxWidth: 760 }}>
            <div style={{ font: `600 13px/1 ${SYSTEM_FONT}`, color: '#3c6df0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>October 2026</div>
            <div style={{ marginTop: 12, font: `700 40px/1.1 ${SYSTEM_FONT}`, letterSpacing: '-0.02em' }}>What’s new in Harbor 2.4</div>
            <p style={{ marginTop: 18, font: `400 17px/1.6 ${SYSTEM_FONT}`, color: '#3a3a3c' }}>
              Faster syncs, offline drafts and a new command palette. Here is everything that changed since 2.3, and what to do before you upgrade.
            </p>
            <div style={{ marginTop: 26, height: 230, borderRadius: 18, background: 'linear-gradient(135deg, #dfe8ff 0%, #c3d3ff 40%, #f3d9c9 100%)', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', left: 40, top: 40, width: 320, height: 150, borderRadius: 12, background: 'rgba(255,255,255,0.85)', boxShadow: '0 10px 30px rgba(30,40,90,0.15)', padding: 18, boxSizing: 'border-box' }}>
                <Lines widths={[70, 90, 55]} gap={14} />
              </div>
              <div style={{ position: 'absolute', left: 300, top: 90, width: 300, height: 120, borderRadius: 12, background: 'rgba(255,255,255,0.92)', boxShadow: '0 10px 30px rgba(30,40,90,0.18)', padding: 18, boxSizing: 'border-box' }}>
                <Lines widths={[60, 85, 40]} gap={14} />
              </div>
            </div>
            <div style={{ marginTop: 30, font: `700 22px/1.2 ${SYSTEM_FONT}` }}>Offline drafts</div>
            <div style={{ marginTop: 14 }}>
              <Lines widths={[96, 92, 98, 64]} />
            </div>
            <div style={{ marginTop: 28, font: `700 22px/1.2 ${SYSTEM_FONT}` }}>A faster sync</div>
            <div style={{ marginTop: 14 }}>
              <Lines widths={[94, 88, 52]} />
            </div>
            <div style={{ marginTop: 28, font: `700 22px/1.2 ${SYSTEM_FONT}` }}>The command palette</div>
            <div style={{ marginTop: 14 }}>
              <Lines widths={[90, 96, 72]} />
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
