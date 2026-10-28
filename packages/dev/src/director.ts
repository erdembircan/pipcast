// The development build's director: the station's own director, with cues in
// front of it. A cue waits until the window shows and nothing is on air or
// due, then airs on a director of its own, which starts BREAKING NEWS or the
// report on the next hour at once. Meanwhile the station's own director sees
// every snapshot with the window held to the side, so it starts nothing: a
// story that lands meanwhile waits its turn and airs after the cue's segment,
// and the hour comes due for it as ever. Nothing a cue airs is kept. It posts
// no report, so prefs.json and the report on the next hour are as they were.
// With no cue, every tick goes straight to the station's own director, so the
// development build airs what the release does.

import { hourStart } from '../../contract/src/format.ts'
import type { SessionRecord, Snapshot } from '../../contract/src/types.ts'
import { createDirector } from '../../director/src/director.ts'
import type { DirectorOptions, Program, Tick } from '../../director/src/director.ts'
import { GAP_MS, HOUR_MS, IDENT_LEAD_MS } from '../../director/src/timing.ts'

import { parseCue } from './cue.ts'
import type { DevCue, DevStory } from './cue.ts'
import type { Defaults } from './defaults.ts'
import { hourSessions, land, overlay } from './world.ts'

// A cue waits this long at most for the window to show and the air to clear,
// from the tick that first sees it; then it is dropped, so one left behind
// never airs into a later visit
export const CUE_WAIT_MS = 5 * 60_000

export interface DevDirectorOptions extends DirectorOptions {
  defaults: Defaults
  // Writes a line to station.log
  log: (text: string) => void
}

export interface DevDirector {
  tick(input: Tick): Program
  // A cue's text, as the dev station hands it over. One that is not a cue is
  // logged and dropped
  cue(text: string): void
}

interface Waiting {
  cue: DevCue
  // The tick that first saw it
  since: number | null
}

// A story that has landed: on the session on air it names, or on a session of
// its own
interface Landed {
  on: string | null
  session: SessionRecord
}

interface Run {
  cue: DevCue
  director: { tick(input: Tick): Program }
  // The stories of the sessions on air as the run began, the only ones of
  // theirs it shows: a story that lands later is the station's own director's,
  // to air after the run
  frozen: Set<string>
  // A story cue's stories still to land, one a tick, and the ones that have
  toLand: DevStory[]
  landed: Landed[]
  // An hour cue's sessions, in place of the ones on air; null for the ones on air
  sessions: SessionRecord[] | null
}

export function createDevDirector(options: DevDirectorOptions): DevDirector {
  const reducedMotion = options.reducedMotion === true
  const { defaults, log } = options
  const main = createDirector({ reducedMotion })
  const known = new Set<string>()
  let waiting: Waiting[] = []
  let run: Run | null = null
  // When the station's own director last came to rest on the board with
  // nothing due; null while it hasn't
  let idleSince: number | null = null
  // After a run, the station's own director stays held until then: the gap
  // between two segments
  let heldUntil = 0

  // The snapshot with the window held to the side: the station's own director
  // starts nothing from it
  function held(snapshot: Snapshot | null): Snapshot | null {
    return snapshot === null ? null : { ...snapshot, windowOut: false }
  }

  // The snapshot as the cue's director sees it
  function view(current: Run, snapshot: Snapshot, now: number): Snapshot {
    let sessions: SessionRecord[] =
      current.sessions ??
      snapshot.sessions.map((session) => ({
        ...session,
        stories: session.stories.filter((story) => current.frozen.has(story.id)),
      }))
    for (const landed of current.landed) {
      const on = landed.on
      sessions =
        on === null
          ? [...sessions, { ...landed.session, checkedInAt: now }]
          : sessions.map((session) => (session.id === on ? overlay(session, landed.session) : session))
    }
    return { ...snapshot, sessions }
  }

  // One tick of the cue's director: the next story lands, then it ticks
  function runTick(current: Run, now: number, snapshot: Snapshot | null): Program {
    if (snapshot === null) {
      return current.director.tick({ now, snapshot: null })
    }
    const next = current.toLand.shift()
    if (next !== undefined) {
      const index = current.landed.length
      let on: string | null = null
      if (next.session !== undefined) {
        if (snapshot.sessions.some((session) => session.id === next.session)) {
          on = next.session
        } else {
          log(`dev: ${current.cue.id}: ${next.session} is not on air, so story ${index + 1} lands on a session of its own`)
        }
      }
      current.landed.push({ on, session: land(current.cue.id, index, next, defaults, now) })
    }
    return current.director.tick({ now, snapshot: view(current, snapshot, now) })
  }

  function start(cue: DevCue, now: number, snapshot: Snapshot): Run {
    const current: Run = {
      cue,
      director: createDirector({ reducedMotion }),
      frozen: new Set(snapshot.sessions.flatMap((session) => session.stories.map((story) => story.id))),
      toLand: cue.segment === 'story' ? [...cue.stories] : [],
      landed: [],
      sessions: cue.segment === 'hour' ? hourSessions(cue, defaults, now) : null,
    }
    // Its first tick, with the window hidden, sees every story there is and
    // queues none
    current.director.tick({ now, snapshot: { ...view(current, snapshot, now), visible: false } })
    if (cue.segment === 'hour') {
      // The next hour comes due, as it does five seconds before it: its
      // report joins the queue and waits, the window held to the side. From
      // the next tick the cue's director goes by the clock again, so the
      // report airs now. packages/dev/test/director.test.ts holds the
      // director to this
      const hour = hourStart(now) + HOUR_MS
      current.director.tick({ now: hour - IDENT_LEAD_MS, snapshot: { ...view(current, snapshot, now), windowOut: false } })
    }
    return current
  }

  function tick({ now, snapshot }: Tick): Program {
    waiting = waiting.filter((item) => {
      item.since ??= now
      if (now - item.since <= CUE_WAIT_MS) {
        return true
      }
      log(`dev: ${item.cue.id} dropped: it waited ${CUE_WAIT_MS / 60_000} min for the window to show and the air to clear`)
      return false
    })

    const current = run
    if (current !== null) {
      main.tick({ now, snapshot: held(snapshot) })
      const program = runTick(current, now, snapshot)
      const over =
        snapshot === null ||
        !snapshot.visible ||
        (current.toLand.length === 0 && program.key === 'board' && !program.wantsWindow)
      if (over) {
        log(`dev: ${current.cue.id} off air`)
        run = null
        idleSince = now
        heldUntil = now + GAP_MS
      }
      // A cue's report is never the last report: the real hour is as it was
      return { ...program, reported: null }
    }

    const program = main.tick({ now, snapshot: now < heldUntil ? held(snapshot) : snapshot })
    if (program.key !== 'board' || program.wantsWindow) {
      idleSince = null
    } else {
      idleSince ??= now
    }
    const next = waiting[0]
    if (
      next === undefined ||
      snapshot === null ||
      !snapshot.visible ||
      now < heldUntil ||
      idleSince === null ||
      now - idleSince < GAP_MS
    ) {
      return program
    }
    waiting.shift()
    const begun = start(next.cue, now, snapshot)
    run = begun
    log(`dev: ${next.cue.id} on air`)
    const first = runTick(begun, now, snapshot)
    return { ...first, sounds: [...program.sounds, ...first.sounds], reported: program.reported }
  }

  function cue(text: string): void {
    const checked = parseCue(text)
    if ('problem' in checked) {
      log(`dev: a cue was dropped: ${checked.problem}`)
      return
    }
    if (known.has(checked.cue.id)) {
      log(`dev: ${checked.cue.id} came twice; the second was dropped`)
      return
    }
    known.add(checked.cue.id)
    waiting.push({ cue: checked.cue, since: null })
    log(`dev: ${checked.cue.id} waits for the window to show and the air to clear`)
  }

  return { tick, cue }
}
