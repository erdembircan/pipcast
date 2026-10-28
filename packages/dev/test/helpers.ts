import type { Jingle, SessionRecord, Snapshot, Story } from '../../contract/src/types.ts'
import type { Program } from '../../director/src/director.ts'

import type { Defaults } from '../src/defaults.ts'
import { createDevDirector } from '../src/director.ts'

// 14:30:00 on 21 October 2026, in UTC (the test script sets TZ=UTC)
export const at = (hour: number, minute = 0, second = 0): number => Date.UTC(2026, 9, 21, hour, minute, second)
export const T0 = at(14, 30)

// What defaultsFrom makes of the design system's samples (defaults.test.ts holds it to that)
export const DEFAULTS: Defaults = {
  sessions: [
    { title: 'Fix flaky checkout test', project: 'web-shop' },
    { title: 'Write release notes for 2.4', project: 'docs-site' },
    { title: 'Refactor auth middleware', project: 'api-server' },
    { title: 'Migrate settings to SQLite', project: 'desktop-app' },
    { title: 'Check last night’s crash reports', project: 'mobile-app' },
    { title: 'Speed up product search', project: 'search-api' },
    { title: 'Move CI to the new runners', project: 'ci-config' },
  ],
  stories: {
    'needs-input': { title: 'Fix flaky checkout test', project: 'web-shop', command: 'npm install', quote: 'Install dependencies' },
    ready: { title: 'Write release notes for 2.4', project: 'docs-site', added: 182, removed: 40, files: 4, minutes: 9 },
    complete: {
      title: 'Check last night’s crash reports',
      project: 'mobile-app',
      quote: 'Both crashes come from the old 3.1 build. Nothing to fix.',
      minutes: 6,
    },
    error: {
      title: 'Migrate settings to SQLite',
      project: 'desktop-app',
      quote: 'Claude is overloaded right now. Try again in a moment.',
      minutes: 31,
    },
  },
}

export function story(id: string, kind: Story['kind'], when: number, rest: Partial<Story> = {}): Story {
  return { id, kind, at: when, ...rest }
}

export function session(id: string, rest: Partial<SessionRecord> = {}): SessionRecord {
  return {
    v: 1,
    id,
    title: `Title ${id}`,
    project: `project-${id}`,
    state: 'working',
    stateAt: 0,
    tunedInAt: 0,
    checkedInAt: 0,
    stories: [],
    activity: [],
    hours: [],
    ...rest,
  }
}

export interface Sample {
  now: number
  program: Program
}

// The jingles a tick started, by name
export function jingles(program: Program): Jingle[] {
  return program.sounds.flatMap((sound) => (sound.type === 'cue' ? [sound.jingle] : []))
}

// The keys a run of samples went through, each once as it began
export function keys(samples: readonly Sample[]): string[] {
  const out: string[] = []
  let last = ''
  for (const sample of samples) {
    if (sample.program.key !== last) {
      out.push(sample.program.key)
    }
    last = sample.program.key
  }
  return out
}

// A cue's text
export function cue(value: unknown): string {
  return JSON.stringify(value)
}

// The dev director with a world it reads from, a clock that moves in 250 ms
// ticks, and the lines it logs
export function devHarness(start: number, sessions: SessionRecord[] = [], options: { reducedMotion?: boolean } = {}) {
  const lines: string[] = []
  const dev = createDevDirector({ ...options, defaults: DEFAULTS, log: (text) => lines.push(text) })
  const world: { sessions: SessionRecord[]; visible: boolean; windowOut?: boolean; lastReportAt: number | null } = {
    sessions,
    visible: true,
    lastReportAt: null,
  }
  let now = start - 250
  const history: Sample[] = []

  function step(): Sample {
    now += 250
    const snapshot: Snapshot = {
      now,
      visible: world.visible,
      ...(world.windowOut === undefined ? {} : { windowOut: world.windowOut }),
      sessions: world.sessions,
      lastReportAt: world.lastReportAt,
    }
    const sample = { now, program: dev.tick({ now, snapshot }) }
    history.push(sample)
    return sample
  }

  return {
    dev,
    world,
    lines,
    history,
    step,
    // Ticks until `to` (inclusive) and returns the last sample
    until(to: number): Sample {
      let last = history[history.length - 1]
      while (now + 250 <= to) {
        last = step()
      }
      if (last === undefined) {
        throw new Error('the clock did not move')
      }
      return last
    },
  }
}
