// The sessions a cue airs on. They are made as its segment starts, so every
// time in them is fresh: a story stamped when it was cued would be old by the
// time the window shows, and the director airs no story it first sees old.

import { COMMAND_MAX, LAST_WORDS_MAX, QUESTION_MAX } from '../../contract/src/constants.ts'
import { hourKey, hourStart } from '../../contract/src/format.ts'
import type { SessionRecord, Story, UsageLimit, WeatherMemory } from '../../contract/src/types.ts'

import { STATE_AFTER } from './cue.ts'
import type { DevHourCue, DevHourSession, DevStory, WeatherOutlook } from './cue.ts'
import { HOUR_SAMPLES } from './defaults.ts'
import type { Defaults } from './defaults.ts'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const QUARTER_MS = 15 * MINUTE_MS
const WEEK_HOURS = 168

// As the mod cuts a command or a question, so a cue airs nothing a session
// could not send
function cut(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

// Story `index` of cue `cueId`, landing at `now` on a session of its own: in
// the state the story leaves it in, since the story, which is its only one.
// What the cue leaves out comes from the design system's sample for the kind
export function land(cueId: string, index: number, input: DevStory, defaults: Defaults, now: number): SessionRecord {
  const sample = defaults.stories[input.kind]
  const id = `dev-${cueId}-${index}`
  const at = input.kind === 'needs-input' ? now - (input.minutes ?? 0) * MINUTE_MS : now
  const story: Story = { id: `${id}:1`, kind: input.kind, at }
  const took = (input.minutes ?? sample.minutes ?? 0) * MINUTE_MS
  switch (input.kind) {
    case 'needs-input': {
      // The sample's permission when the cue gives neither, else what it gives
      const own = input.command !== undefined || input.quote !== undefined
      const command = own ? input.command : sample.command
      const quote = own ? input.quote : sample.quote
      if (command !== undefined) {
        story.command = cut(command, COMMAND_MAX)
      }
      if (quote !== undefined) {
        story.quote = cut(quote, QUESTION_MAX)
      }
      break
    }
    case 'ready':
      story.added = input.added ?? sample.added ?? 0
      story.removed = input.removed ?? sample.removed ?? 0
      story.files = input.files ?? sample.files ?? 0
      story.durationMs = took
      break
    case 'complete':
      story.quote = cut(input.quote ?? sample.quote ?? '', LAST_WORDS_MAX)
      story.durationMs = took
      break
    case 'error':
      story.quote = cut(input.quote ?? sample.quote ?? '', QUESTION_MAX)
      story.durationMs = took
      break
  }
  return {
    v: 1,
    id,
    title: input.title ?? sample.title,
    project: input.project ?? sample.project,
    state: STATE_AFTER[input.kind],
    stateAt: at,
    tunedInAt: now,
    checkedInAt: now,
    stories: [story],
    activity: [],
    hours: [],
  }
}

// A session on air that a cue's story lands on, as the cue's segment shows
// it: in the story's state since the story, with the story as its only one, so
// nothing of its own moves it on before the story airs
export function overlay(session: SessionRecord, landed: SessionRecord): SessionRecord {
  return { ...session, state: landed.state, stateAt: landed.stateAt, stories: landed.stories }
}

// The design system's first `count` sample sessions as the hour's, or for a
// quiet hour every one working, with no story
function samples(count: number, quiet: boolean): DevHourSession[] {
  return HOUR_SAMPLES.slice(0, count).map((sample) =>
    quiet ? { added: sample.added, removed: sample.removed, files: sample.files } : { ...sample },
  )
}

// The sessions an hour cue's report covers, in place of the ones on air, made
// as the report starts at `now`; null when it covers the ones on air. Each
// story falls this hour and each line in this hour's entry, so the report on
// the next hour counts them. A wait goes back to this hour's start at most,
// where that report's span begins
export function hourSessions(cue: DevHourCue, defaults: Defaults, now: number): SessionRecord[] | null {
  const given = cue.sessions ?? (cue.samples === undefined ? null : samples(cue.samples, cue.quiet === true))
  if (given === null) {
    return null
  }
  const start = hourStart(now)
  return given.map((input, index): SessionRecord => {
    const sample = defaults.sessions[index % defaults.sessions.length]
    const id = `dev-${cue.id}-${index}`
    // A second apart, so no two sessions tie
    const since = Math.max(start, now - (input.minutes ?? 0) * MINUTE_MS - index * 1_000)
    const lines = input.added !== undefined || input.removed !== undefined || input.files !== undefined
    return {
      v: 1,
      id,
      title: input.title ?? sample?.title ?? '',
      project: input.project ?? sample?.project ?? '',
      state: input.state ?? (input.story === undefined ? 'working' : STATE_AFTER[input.story]),
      stateAt: since,
      tunedInAt: now + index,
      checkedInAt: now,
      stories: input.story === undefined ? [] : [{ id: `${id}:1`, kind: input.story, at: since }],
      activity: [],
      hours: lines
        ? [{ hour: hourKey(now), added: input.added ?? 0, removed: input.removed ?? 0, files: input.files ?? 0 }]
        : [],
    }
  })
}

// How much of the week an outlook's cue has used by default, and the share the
// week would end at at that pace: the week's elapsed time is made to fit
const WEATHER_USED: Record<WeatherOutlook, number> = { clear: 36, clouds: 48, storm: 72 }
const WEATHER_TARGET: Record<WeatherOutlook, number> = { clear: 55, clouds: 86, storm: 130 }
// A day's use falls in these hours, local
const ACTIVE_FROM = 9
const ACTIVE_TO = 21

// A week made up for a cue, to give the outlook it names when the real
// forecast runs on it. `used` is the share used now (the outlook's default
// without it). The week is as far along as that share is of the end it is
// aimed at, between a fifth of it and nine tenths and at least 30 hours, to the
// hour, so that its pace ends the week near the target. Its readings are one
// an hour from the week's start, the share rising evenly through
// 09:00 to 21:00 of each day and standing still otherwise, scaled so the last
// is `used`. The week's limit as a session reads it is that share, now.
export function syntheticWeek(
  outlook: WeatherOutlook,
  used: number | undefined,
  now: number,
): { memory: WeatherMemory; reading: UsageLimit } {
  const share = used ?? WEATHER_USED[outlook]
  const along = Math.min(0.9, Math.max(0.2, share / WEATHER_TARGET[outlook]))
  const elapsed = Math.max(30, Math.round(along * WEEK_HOURS)) * HOUR_MS
  const resetsAt = now + WEEK_HOURS * HOUR_MS - elapsed
  const start = now - elapsed
  // The use in each quarter hour before a point: even through the active
  // hours. The points are the hours' ends, from the week's start. Counted by
  // the quarter hour so a point is the share of the active quarters before it.
  const times: number[] = []
  const running: number[] = []
  let active = 0
  for (let at = start + QUARTER_MS; at <= now; at += QUARTER_MS) {
    const hour = new Date(at - QUARTER_MS).getHours()
    if (hour >= ACTIVE_FROM && hour < ACTIVE_TO) {
      active += 1
    }
    if ((at - start) % HOUR_MS === 0) {
      times.push(at)
      running.push(active)
    }
  }
  const points: [number, number][] = times.map((at, index): [number, number] => [
    at,
    Math.round(((running[index] ?? 0) / Math.max(1, active)) * share * 10) / 10,
  ])
  return {
    memory: { v: 1, resetsAt, points, warnedAt: null },
    reading: { kind: 'week', percentUsed: share, resetsAt, at: now },
  }
}
