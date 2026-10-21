// `#demo` in a browser: feeds the page a made-up snapshot of four sessions
// that changes over time, so the page can be watched without the station.
// The titles, projects and words are the design system's sample scenes.
import type { SessionRecord, Story } from '@pipcast/contract'

import { receive } from './bridge.ts'
import { samples } from './design.ts'

const CYCLE_MS = 150_000
const MINUTE = 60_000

interface Plan {
  at: number
  run(sessions: SessionRecord[], now: number, cycle: number): void
}

function eventOf(name: string) {
  const event = samples[name]?.event
  if (event === undefined) {
    throw new Error(`the design system has no sample ${name}`)
  }
  return event
}

function find(sessions: SessionRecord[], id: string): SessionRecord {
  const found = sessions.find((session) => session.id === id)
  if (found === undefined) {
    throw new Error(`the demo has no session ${id}`)
  }
  return found
}

function land(session: SessionRecord, now: number, cycle: number, story: Omit<Story, 'id' | 'at'>): void {
  const entry: Story = { ...story, id: `${session.id}:${cycle}:${session.stories.length + 1}`, at: now }
  session.stories = [...session.stories, entry].slice(-10)
  session.stateAt = now
  session.state = story.kind === 'needs-input' ? 'needs-input' : story.kind === 'error' ? 'error' : 'ready'
}

function work(session: SessionRecord, now: number): void {
  session.state = 'working'
  session.stateAt = now
}

function newSessions(now: number): SessionRecord[] {
  const board = samples['run-board']
  const ticker = (board?.ticker ?? []).filter((item): item is string => typeof item === 'string')
  return (board?.sessions ?? []).map((row, index) => {
    const project = row.project ?? ''
    const prefix = `${project}: `
    const text = ticker.find((line) => line.startsWith(prefix))
    return {
      v: 1,
      id: row.id,
      title: row.name,
      project,
      state: 'working',
      stateAt: now,
      tunedInAt: now - MINUTE + index,
      checkedInAt: now,
      stories: [],
      activity: text === undefined ? [] : [{ at: now, text: text.slice(prefix.length) }],
      hours: [],
    }
  })
}

function plan(): Plan[] {
  const ask = eventOf('run-needs-input')
  const complete = eventOf('complete-desk')
  const error = eventOf('error-desk')
  return [
    {
      at: 6_000,
      run: (sessions, now, cycle) => {
        land(find(sessions, 'checkout'), now, cycle, { kind: 'needs-input', command: ask.command, quote: ask.quote })
      },
    },
    { at: 45_000, run: (sessions, now) => work(find(sessions, 'checkout'), now) },
    {
      at: 50_000,
      run: (sessions, now, cycle) => {
        land(find(sessions, 'notes'), now, cycle, {
          kind: 'ready',
          added: 182,
          removed: 40,
          files: 4,
          durationMs: 9 * MINUTE,
        })
      },
    },
    { at: 80_000, run: (sessions, now) => work(find(sessions, 'notes'), now) },
    {
      at: 85_000,
      run: (sessions, now, cycle) => {
        land(find(sessions, 'sqlite'), now, cycle, { kind: 'error', quote: error.quote, durationMs: 31 * MINUTE })
      },
    },
    { at: 110_000, run: (sessions, now) => work(find(sessions, 'sqlite'), now) },
    {
      at: 115_000,
      run: (sessions, now, cycle) => {
        land(find(sessions, 'auth'), now, cycle, { kind: 'complete', quote: complete.quote, durationMs: 6 * MINUTE })
      },
    },
    { at: 140_000, run: (sessions, now) => work(find(sessions, 'auth'), now) },
  ]
}

// Starts the demo and returns a function that stops it
export function startDemo(): () => void {
  const started = Date.now()
  let cycle = 0
  let cycleStart = started
  let sessions = newSessions(started)
  let pending = plan()

  function step(): void {
    const now = Date.now()
    if (now - cycleStart >= CYCLE_MS) {
      cycle += 1
      cycleStart = now
      sessions = newSessions(now)
      pending = plan()
    }
    const elapsed = now - cycleStart
    while (pending[0] !== undefined && pending[0].at <= elapsed) {
      pending.shift()?.run(sessions, now, cycle)
    }
    for (const session of sessions) {
      session.checkedInAt = now
    }
    receive({ type: 'snapshot', now, visible: true, sessions, lastReportAt: null })
  }

  step()
  const timer = window.setInterval(step, 1000)
  return () => window.clearInterval(timer)
}
