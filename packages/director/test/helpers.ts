import type { Jingle, SessionRecord, Snapshot, Sound, Story } from '@pipcast/contract'
import { createDirector } from '@pipcast/director'
import type { DirectorOptions, Program } from '@pipcast/director'

// 14:30:00 on 21 October 2026, in UTC (the test script sets TZ=UTC)
export const T0 = Date.UTC(2026, 9, 21, 14, 30, 0)

export const at = (hour: number, minute = 0, second = 0): number =>
  Date.UTC(2026, 9, 21, hour, minute, second)

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

export interface World {
  sessions: SessionRecord[]
  visible: boolean
  windowOut?: boolean
  lastReportAt: number | null
}

export interface Sample {
  now: number
  program: Program
}

// The jingles a tick started, by name; none for a tick that is not there
export function jingles(program: Program | undefined): Jingle[] {
  return (program?.sounds ?? []).flatMap((sound) => (sound.type === 'cue' ? [sound.jingle] : []))
}

// A director with a world it reads from, and a clock that moves in 250 ms ticks
export function harness(start: number, sessions: SessionRecord[] = [], options: DirectorOptions = {}) {
  const director = createDirector(options)
  const world: World = { sessions, visible: true, lastReportAt: null }
  let now = start - 250
  const history: Sample[] = []

  function tick(): Sample {
    const snapshot: Snapshot = {
      now,
      visible: world.visible,
      ...(world.windowOut === undefined ? {} : { windowOut: world.windowOut }),
      sessions: world.sessions,
      lastReportAt: world.lastReportAt,
    }
    const sample = { now, program: director.tick({ now, snapshot }) }
    history.push(sample)
    return sample
  }

  return {
    world,
    history,
    // Ticks until `to` (inclusive), 250 ms at a time, and returns the last sample
    until(to: number): Sample {
      let last: Sample | undefined
      while (now + 250 <= to) {
        now += 250
        last = tick()
      }
      if (last === undefined) {
        throw new Error('the clock did not move')
      }
      return last
    },
    // The sessions change at `when`: ticks up to just before it, swaps the
    // sessions in, and ticks at `when`
    land(sessions: SessionRecord[], when: number): Sample {
      if (now + 250 <= when - 250) {
        this.until(when - 250)
      }
      world.sessions = sessions
      return this.until(when)
    },
    // Ticks once, at `to`, which may not be a multiple of 250 ms from the start
    at(to: number): Sample {
      now = to
      return tick()
    },
    // Every jingle started so far, with the tick it started on
    cues(): { now: number; jingle: Jingle }[] {
      return history.flatMap((sample) => jingles(sample.program).map((jingle) => ({ now: sample.now, jingle })))
    },
    // Every sound so far, with the tick it came on
    sounds(): { now: number; sound: Sound }[] {
      return history.flatMap((sample) => sample.program.sounds.map((sound) => ({ now: sample.now, sound })))
    },
    keys(): string[] {
      return [...new Set(history.map((sample) => sample.program.key))]
    },
  }
}
