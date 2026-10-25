// The app on the second desktop: a plain code editor in a dark theme, with no
// maker's marks, open on the checkout test the web-shop session is fixing,
// and its terminal showing the test pass.
import { MONO } from '../look/theme.ts'
import { SYSTEM_FONT } from './MenuBar.tsx'
import { TrafficLights } from './MacWindow.tsx'

const C = {
  frame: '#18191c',
  side: '#1c1d21',
  code: '#1e1f24',
  line: '#25272e',
  rule: '#2a2c33',
  text: '#d6deeb',
  muted: '#8b8e98',
  number: '#555a66',
  keyword: '#c792ea',
  string: '#c3e88d',
  call: '#82aaff',
  digit: '#f78c6c',
  punct: '#89ddff',
  pass: '#7ee787',
}

type Token = [string, string]

const k = (t: string): Token => [t, C.keyword]
const s = (t: string): Token => [t, C.string]
const f = (t: string): Token => [t, C.call]
const n = (t: string): Token => [t, C.digit]
const p = (t: string): Token => [t, C.punct]
const x = (t: string): Token => [t, C.text]

/** test/checkout.test.ts: the test waits for the discount timer before it reads the total */
const CODE: Token[][] = [
  [k('import'), x(' { describe, expect, it, vi } '), k('from'), s(" 'vitest'")],
  [k('import'), x(' { checkout } '), k('from'), s(" '../src/checkout'")],
  [k('import'), x(' { cartWith } '), k('from'), s(" './fixtures'")],
  [],
  [f('describe'), p('('), s("'checkout'"), p(', () => {')],
  [x('  '), f('it'), p('('), s("'applies the discount after the timer fires'"), p(', '), k('async'), p(' () => {')],
  [x('    vi.'), f('useFakeTimers'), p('()')],
  [x('    '), k('const'), x(' order '), p('= '), f('checkout'), p('('), f('cartWith'), p('('), n('3'), p('), { '), x('discount'), p(': '), n('0.1'), p(' })')],
  [x('    '), k('await'), x(' vi.'), f('runAllTimersAsync'), p('()')],
  [x('    '), f('expect'), p('(('), k('await'), x(' order'), p(').'), x('total'), p(').'), f('toBe'), p('('), n('81'), p(')')],
  [x('  '), p('})')],
  [p('})')],
]

/** The line the caret is on */
const CARET_LINE = 9

const TREE: Array<{ name: string; depth: number; folder?: boolean; open?: boolean; current?: boolean }> = [
  { name: 'src', depth: 0, folder: true, open: true },
  { name: 'cart.ts', depth: 1 },
  { name: 'checkout.ts', depth: 1 },
  { name: 'test', depth: 0, folder: true, open: true },
  { name: 'cart.test.ts', depth: 1 },
  { name: 'checkout.test.ts', depth: 1, current: true },
  { name: 'fixtures.ts', depth: 1 },
  { name: 'package.json', depth: 0 },
  { name: 'vitest.config.ts', depth: 0 },
]

function Chevron({ open }: { open?: boolean }) {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" style={{ transform: open ? 'rotate(90deg)' : undefined }}>
      <path d="M3.5 2l3 3-3 3" fill="none" stroke={C.muted} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** The activity bar's four places, drawn as plain shapes */
function Places() {
  const icon = (i: number, on: boolean) => (
    <span key={i} style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${on ? '#c9ccd4' : '#5b5f6a'}`, boxSizing: 'border-box' }} />
  )
  return <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, paddingTop: 18 }}>{[0, 1, 2, 3].map((i) => icon(i, i === 0))}</div>
}

export function EditorApp({ active }: { active: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: C.frame, color: C.text, font: `400 13px/1 ${SYSTEM_FONT}` }}>
      {/* Title bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 40, display: 'flex', alignItems: 'center', padding: '0 16px', borderBottom: `1px solid ${C.rule}` }}>
        <TrafficLights active={active} />
        <span style={{ flex: 1, textAlign: 'center', font: `500 13px/1 ${SYSTEM_FONT}`, color: '#a9abb3', marginRight: 52 }}>checkout.test.ts — web-shop</span>
      </div>

      {/* Activity bar */}
      <div style={{ position: 'absolute', left: 0, top: 40, bottom: 26, width: 52, background: C.frame, borderRight: `1px solid ${C.rule}` }}>
        <Places />
      </div>

      {/* Explorer */}
      <div style={{ position: 'absolute', left: 52, top: 40, bottom: 26, width: 246, background: C.side, borderRight: `1px solid ${C.rule}` }}>
        <div style={{ padding: '16px 18px 12px', font: `600 11px/1 ${SYSTEM_FONT}`, letterSpacing: '0.08em', color: C.muted }}>WEB-SHOP</div>
        {TREE.map((item) => (
          <div
            key={item.name}
            style={{
              height: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              paddingLeft: 16 + item.depth * 18 + (item.folder ? 0 : 17),
              background: item.current ? '#2a2d36' : undefined,
              color: item.current ? '#ffffff' : item.folder ? '#c9ccd4' : C.muted,
              font: `${item.folder ? 600 : 400} 13.5px/1 ${SYSTEM_FONT}`,
            }}
          >
            {item.folder ? <Chevron open={item.open} /> : null}
            {item.name}
          </div>
        ))}
      </div>

      {/* Editor */}
      <div style={{ position: 'absolute', left: 298, right: 0, top: 40, bottom: 26, background: C.code }}>
        {/* Tabs */}
        <div style={{ height: 38, display: 'flex', background: C.frame, borderBottom: `1px solid ${C.rule}` }}>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 18px', background: C.code, borderTop: '2px solid #82aaff', color: '#ffffff', font: `400 13.5px/1 ${SYSTEM_FONT}` }}>checkout.test.ts</span>
          <span style={{ display: 'flex', alignItems: 'center', padding: '0 18px', color: C.muted, font: `400 13.5px/1 ${SYSTEM_FONT}`, borderRight: `1px solid ${C.rule}` }}>checkout.ts</span>
        </div>
        {/* Code */}
        <div style={{ paddingTop: 14, font: `400 15px/26px ${MONO}` }}>
          {CODE.map((line, i) => (
            <div key={i} style={{ display: 'flex', height: 26, background: i + 1 === CARET_LINE ? C.line : undefined }}>
              <span style={{ width: 58, paddingRight: 18, textAlign: 'right', color: i + 1 === CARET_LINE ? '#c9ccd4' : C.number, boxSizing: 'border-box' }}>{i + 1}</span>
              <span style={{ whiteSpace: 'pre', position: 'relative' }}>
                {line.map(([text, color], j) => (
                  <span key={j} style={{ color }}>
                    {text}
                  </span>
                ))}
                {i + 1 === CARET_LINE ? <span style={{ display: 'inline-block', width: 2, height: 19, background: '#ffffff', verticalAlign: '-4px', marginLeft: 1 }} /> : null}
              </span>
            </div>
          ))}
        </div>

        {/* Terminal */}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 210, background: C.frame, borderTop: `1px solid ${C.rule}` }}>
          <div style={{ padding: '12px 20px', font: `600 11px/1 ${SYSTEM_FONT}`, letterSpacing: '0.08em', color: C.muted }}>TERMINAL</div>
          <div style={{ padding: '4px 20px', font: `400 14px/24px ${MONO}`, color: C.text, whiteSpace: 'pre' }}>
            <div>
              <span style={{ color: C.muted }}>web-shop % </span>npm test -- checkout
            </div>
            <div>
              <span style={{ color: C.pass }}> ✓</span> test/checkout.test.ts <span style={{ color: C.muted }}>(1 test) 14ms</span>
            </div>
            <div> </div>
            <div>
              <span style={{ color: C.muted }}> Test Files </span>
              <span style={{ color: C.pass }}> 1 passed</span>
              <span style={{ color: C.muted }}> (1)</span>
            </div>
            <div>
              <span style={{ color: C.muted }}>      Tests </span>
              <span style={{ color: C.pass }}> 1 passed</span>
              <span style={{ color: C.muted }}> (1)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Status bar */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 26, display: 'flex', alignItems: 'center', gap: 22, padding: '0 16px', background: C.frame, borderTop: `1px solid ${C.rule}`, color: C.muted, font: `400 12px/1 ${SYSTEM_FONT}` }}>
        <span>main</span>
        <span>0 problems</span>
        <span style={{ flex: 1 }} />
        <span>Ln 9, Col 33</span>
        <span>TypeScript</span>
      </div>
    </div>
  )
}
