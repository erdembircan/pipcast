// The cue: what scripts/live.sh drops into the store's dev folder for the
// development build of the station, which hands it to its page. A cue airs one
// segment now: BREAKING NEWS for each of its stories, one after another, or the
// report on the next hour. The station and the page that ship take no cue.
//
// scripts/cue.mjs runs this file with Node itself, so it imports with relative
// paths only, and holds nothing Node can't strip of its types: no enum,
// namespace or parameter property.

import type { SessionState, StoryKind } from '../../contract/src/types.ts'

export interface DevStory {
  kind: StoryKind
  // The id of a session on air for the story to land on; else it lands on a
  // session of its own
  session?: string
  // The session's title and project; without them, the design system's sample
  // for the kind
  title?: string
  project?: string
  // needs-input: the command it asks to run
  command?: string
  // needs-input: Claude's description of the command, or its question;
  // complete: the last words; error: the error in words
  quote?: string
  // ready: the lines and files it changed
  added?: number
  removed?: number
  files?: number
  // needs-input: how long it has waited; ready, complete and error: how long
  // the turn ran. Whole minutes
  minutes?: number
}

export interface DevStoryCue {
  id: string
  segment: 'story'
  // They land in this order, one after another
  stories: DevStory[]
}

export interface DevHourSession {
  title?: string
  project?: string
  // Where it stands now: by default where its story left it, else working
  state?: SessionState
  // The kind of its newest story this hour, if it had one
  story?: StoryKind
  // Its lines this hour
  added?: number
  removed?: number
  files?: number
  // A session that needs input or stopped on an error: how long it has
  // waited, back to the start of this hour at most
  minutes?: number
}

export interface DevHourCue {
  id: string
  segment: 'hour'
  // The sessions the report covers, in place of the ones on air
  sessions?: DevHourSession[]
  // Or the design system's first 1 to 7 sample sessions
  samples?: number
  // With samples: every one working, and no story this hour
  quiet?: boolean
}

export type DevCue = DevStoryCue | DevHourCue

export type Checked = { cue: DevCue } | { problem: string }

export const MAX_STORIES = 8
export const MAX_SESSIONS = 24
export const SAMPLES = 7
const MAX_TEXT = 1_000
const MAX_COUNT = 9_999_999
const MAX_MINUTES = 9_999

const KINDS: readonly StoryKind[] = ['needs-input', 'ready', 'complete', 'error']
const STATES: readonly SessionState[] = ['working', 'needs-input', 'ready', 'error']
const ID = /^[A-Za-z0-9_-]{1,64}$/

const STORY_CUE_FIELDS = ['id', 'segment', 'stories']
const HOUR_CUE_FIELDS = ['id', 'segment', 'sessions', 'samples', 'quiet']
const STORY_FIELDS = ['kind', 'session', 'title', 'project', 'command', 'quote', 'added', 'removed', 'files', 'minutes']
const SESSION_FIELDS = ['title', 'project', 'state', 'story', 'added', 'removed', 'files', 'minutes']

// The kinds of story a field is for, where it is not for all of them
const FOR_KINDS: Record<string, readonly StoryKind[]> = {
  command: ['needs-input'],
  quote: ['needs-input', 'complete', 'error'],
  added: ['ready'],
  removed: ['ready'],
  files: ['ready'],
}

// The state a story leaves its session in
export const STATE_AFTER: Record<StoryKind, SessionState> = {
  'needs-input': 'needs-input',
  ready: 'ready',
  complete: 'ready',
  error: 'error',
}

class CueProblem extends Error {}

function fail(problem: string): never {
  throw new CueProblem(problem)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// "a, b or c"
function either(words: readonly string[], last: string): string {
  if (words.length <= 1) {
    return words[0] ?? ''
  }
  return `${words.slice(0, -1).join(', ')} ${last} ${words[words.length - 1] ?? ''}`
}

function onlyFields(value: Record<string, unknown>, fields: readonly string[], path: string): void {
  for (const name of Object.keys(value)) {
    if (!fields.includes(name)) {
      fail(`unknown field ${path}${name}`)
    }
  }
}

function text(value: unknown, path: string): string | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'string' || value === '' || value.length > MAX_TEXT) {
    fail(`${path} must be text of 1 to ${MAX_TEXT} characters`)
  }
  return value
}

function whole(value: unknown, max: number, path: string): number | undefined {
  if (value === undefined) {
    return undefined
  }
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    fail(`${path} must be a whole number from 0 to ${max}`)
  }
  return value
}

function kind(value: unknown, path: string): StoryKind {
  const found = KINDS.find((one) => one === value)
  if (found === undefined) {
    fail(`${path} must be ${either(KINDS, 'or')}`)
  }
  return found
}

function story(value: unknown, path: string): DevStory {
  if (!isObject(value)) {
    fail(`${path} must be an object`)
  }
  onlyFields(value, STORY_FIELDS, `${path}.`)
  const out: DevStory = { kind: kind(value.kind, `${path}.kind`) }
  for (const [field, kinds] of Object.entries(FOR_KINDS)) {
    if (value[field] !== undefined && !kinds.includes(out.kind)) {
      fail(`${path}.${field} is for ${either(kinds, 'and')} stories`)
    }
  }
  return {
    ...out,
    ...defined('session', text(value.session, `${path}.session`)),
    ...defined('title', text(value.title, `${path}.title`)),
    ...defined('project', text(value.project, `${path}.project`)),
    ...defined('command', text(value.command, `${path}.command`)),
    ...defined('quote', text(value.quote, `${path}.quote`)),
    ...defined('added', whole(value.added, MAX_COUNT, `${path}.added`)),
    ...defined('removed', whole(value.removed, MAX_COUNT, `${path}.removed`)),
    ...defined('files', whole(value.files, MAX_COUNT, `${path}.files`)),
    ...defined('minutes', whole(value.minutes, MAX_MINUTES, `${path}.minutes`)),
  }
}

// { [name]: value }, or nothing when the value is not there
function defined<K extends string, V>(name: K, value: V | undefined): Partial<Record<K, V>> {
  return value === undefined ? {} : ({ [name]: value } as Record<K, V>)
}

function hourSession(value: unknown, path: string): DevHourSession {
  if (!isObject(value)) {
    fail(`${path} must be an object`)
  }
  onlyFields(value, SESSION_FIELDS, `${path}.`)
  const out: DevHourSession = {
    ...defined('title', text(value.title, `${path}.title`)),
    ...defined('project', text(value.project, `${path}.project`)),
  }
  if (value.state !== undefined) {
    const state = STATES.find((one) => one === value.state)
    if (state === undefined) {
      fail(`${path}.state must be ${either(STATES, 'or')}`)
    }
    out.state = state
  }
  if (value.story !== undefined) {
    out.story = kind(value.story, `${path}.story`)
  }
  const minutes = whole(value.minutes, MAX_MINUTES, `${path}.minutes`)
  if (minutes !== undefined) {
    const state = out.state ?? (out.story === undefined ? 'working' : STATE_AFTER[out.story])
    if (state !== 'needs-input' && state !== 'error') {
      fail(`${path}.minutes is for a session that needs input or stopped on an error`)
    }
  }
  return {
    ...out,
    ...defined('added', whole(value.added, MAX_COUNT, `${path}.added`)),
    ...defined('removed', whole(value.removed, MAX_COUNT, `${path}.removed`)),
    ...defined('files', whole(value.files, MAX_COUNT, `${path}.files`)),
    ...defined('minutes', minutes),
  }
}

function cue(value: unknown): DevCue {
  if (!isObject(value)) {
    fail('a cue is a JSON object')
  }
  if (typeof value.id !== 'string' || !ID.test(value.id)) {
    fail('id must be 1 to 64 letters, digits, - or _')
  }
  const id = value.id
  if (value.segment === 'story') {
    onlyFields(value, STORY_CUE_FIELDS, '')
    if (!Array.isArray(value.stories) || value.stories.length < 1 || value.stories.length > MAX_STORIES) {
      fail(`stories must be a list of 1 to ${MAX_STORIES} stories`)
    }
    const stories: unknown[] = value.stories
    return { id, segment: 'story', stories: stories.map((item, index) => story(item, `stories[${index}]`)) }
  }
  if (value.segment === 'hour') {
    onlyFields(value, HOUR_CUE_FIELDS, '')
    if (value.sessions !== undefined && value.samples !== undefined) {
      fail("sessions and samples can't both be given")
    }
    const out: DevHourCue = { id, segment: 'hour' }
    if (value.sessions !== undefined) {
      if (!Array.isArray(value.sessions) || value.sessions.length < 1 || value.sessions.length > MAX_SESSIONS) {
        fail(`sessions must be a list of 1 to ${MAX_SESSIONS} sessions`)
      }
      const sessions: unknown[] = value.sessions
      out.sessions = sessions.map((item, index) => hourSession(item, `sessions[${index}]`))
    }
    if (value.samples !== undefined) {
      const samples = value.samples
      if (typeof samples !== 'number' || !Number.isInteger(samples) || samples < 1 || samples > SAMPLES) {
        fail(`samples must be a whole number from 1 to ${SAMPLES}`)
      }
      out.samples = samples
    }
    if (value.quiet !== undefined) {
      if (typeof value.quiet !== 'boolean') {
        fail('quiet must be true or false')
      }
      if (out.samples === undefined) {
        fail('quiet goes with samples')
      }
      out.quiet = value.quiet
    }
    return out
  }
  fail('segment must be story or hour')
}

// A cue as an object: the cue, with only the fields it may hold, or the first
// problem found with it
export function checkCue(value: unknown): Checked {
  try {
    return { cue: cue(value) }
  } catch (error) {
    if (error instanceof CueProblem) {
      return { problem: error.message }
    }
    throw error
  }
}

// A cue as its file's text
export function parseCue(source: string): Checked {
  let value: unknown
  try {
    value = JSON.parse(source)
  } catch {
    return { problem: 'not JSON' }
  }
  return checkCue(value)
}
