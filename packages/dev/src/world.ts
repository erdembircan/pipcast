// The sessions a cue airs on. They are made as its segment starts, so every
// time in them is fresh: a story stamped when it was cued would be old by the
// time the window shows, and the director airs no story it first sees old.

import { COMMAND_MAX, LAST_WORDS_MAX, QUESTION_MAX } from '../../contract/src/constants.ts'
import { hourKey, hourStart } from '../../contract/src/format.ts'
import type { SessionRecord, Story } from '../../contract/src/types.ts'

import { STATE_AFTER } from './cue.ts'
import type { DevHourCue, DevHourSession, DevStory } from './cue.ts'
import { HOUR_SAMPLES } from './defaults.ts'
import type { Defaults } from './defaults.ts'

const MINUTE_MS = 60_000

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
