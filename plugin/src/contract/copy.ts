// Every word Pipcast says, in one place: the command's replies, the band's
// alternative text, the ticker, the desk and the report on the hour. The
// house style is the design system's (design/README.md, Content
// fundamentals): present tense, caps on tabs and labels, sentence case
// elsewhere, no exclamation marks.

import { figure, plural } from './format.ts'
import type { ErrorKind, StoryKind } from './types.ts'

// The command

export const COMMAND_NAME = 'pipcast'

export const COMMAND_DESCRIPTION = 'Tune this session in to KLWD, or tune it out'

export const REPLY = {
  tunedIn: 'Tuned in to KLWD. It shows when you switch to another app.',
  tunedOut: 'Tuned out of KLWD.',
  cannotStart: 'KLWD could not start. Run /pipcast to try again.',
} as const

export const TOAST_CANNOT_START = 'Pipcast: KLWD could not start.'

// The options /pipcast sets: `/pipcast <option> on` or `off` saves one, and
// `/pipcast <option>` says what it is. Each is named as Claude Code's plugin
// options show it, with what on and off mean.
export interface OptionWords {
  title: string
  on: string
  off: string
}

export const OPTION_WORDS: Record<string, OptionWords> = {
  auto: {
    title: 'Tune in every new session',
    on: 'Each new session in the desktop app tunes in to KLWD as it opens.',
    off: 'A new session waits for TUNE IN.',
  },
}

// What the slash menu shows after /pipcast: "[auto on|off]"
export const COMMAND_ARGUMENT_HINT = `[${Object.keys(OPTION_WORDS).join('|')} on|off]`

// "Tune in every new session is on. Each new session in the desktop app tunes in to KLWD as it opens."
export function optionState(word: string, on: boolean): string {
  const words = OPTION_WORDS[word]
  const state = `${words?.title ?? word} is ${on ? 'on' : 'off'}.`
  return words === undefined ? state : `${state} ${on ? words.on : words.off}`
}

export const OPTION_REPLY = {
  unknown: (word: string) => `/pipcast has no option called ${word}. Options: ${Object.keys(OPTION_WORDS).join(', ')}.`,
  badValue: (word: string) => `/pipcast ${word} takes on or off.`,
  cannotRead: (word: string) => `Pipcast could not read the ${word} setting. Run /pipcast ${word} to try again.`,
  cannotSave: (word: string, on: boolean) => `Pipcast could not save the ${word} setting. Run /pipcast ${word} ${on ? 'on' : 'off'} to try again.`,
} as const

// The band draws one picture; this is what a screen reader reads for it
export const BAND_ALT = {
  in: 'KLWD, Tune in',
  out: 'KLWD, Tune out',
} as const

// A session with no title yet goes by its project and the start of its id
export function fallbackTitle(project: string, id: string): string {
  return `${project}-${id.slice(0, 2)}`
}

// The ticker

export const LEAD = {
  comingUp: 'COMING UP',
  breaking: 'BREAKING',
  stillWaiting: 'STILL WAITING',
  ready: 'READY',
  onTheHour: 'ON THE HOUR',
  onTheDesk: 'ON THE DESK',
} as const

export function storyLine(kind: StoryKind, title: string): string {
  switch (kind) {
    case 'needs-input':
      return `${title} needs your input`
    case 'ready':
      return `${title} ready for review`
    case 'complete':
      return `${title}: work complete`
    case 'error':
      return `${title} stopped on an error`
  }
}

export function stillWaitingLine(kind: 'needs-input' | 'error', title: string, minutes: number): string {
  const line = storyLine(kind, title)
  return minutes >= 1 ? `${line} · ${minutes} min` : line
}

export function waitingForReviewLine(title: string): string {
  return `${title} waiting for review`
}

export function reportComingUp(hour: string): string {
  return `The ${hour} report`
}

export function afterReportLine(stories: number, hour: string, nextHour: string): string {
  if (stories === 0) {
    return `A quiet hour · next report ${nextHour}`
  }
  return `${stories} ${plural(stories, 'story', 'stories')} at ${hour} · next report ${nextHour}`
}

// While the report on the hour is on air: "2 stories since 14:00", or, in a
// quiet hour, "A quiet hour: 4 sessions working"
export function hourSoFarLine(stories: number, from: string, working: number, onAir: number): string {
  if (stories === 0) {
    return `A quiet hour: ${deskLine(working, onAir)}`
  }
  return `${stories} ${plural(stories, 'story', 'stories')} since ${from}`
}

export function deskLine(working: number, onAir: number): string {
  if (working > 0) {
    return `${working} ${plural(working, 'session', 'sessions')} working`
  }
  return `${onAir} ${plural(onAir, 'session', 'sessions')} on KLWD`
}

export function activityLine(project: string, text: string): string {
  return `${project}: ${text}`
}

// What a session is doing, for the ticker. Each takes what the tool call
// says and returns a phrase that follows "project: ".

export const ACTIVITY = {
  editing: (path: string) => `editing ${path}`,
  writing: (path: string) => `writing ${path}`,
  reading: (path: string) => `reading ${path}`,
  searchingCode: 'searching the code',
  searchingWeb: 'searching the web',
  readingSite: (host: string) => `reading ${host}`,
  withAgent: 'working with an agent',
  planning: 'updating its task list',
  running: (program: string) => `running ${program}`,
  using: (tool: string) => `using ${tool}`,
} as const

// A command's own description, as Bash gives it ("Run the test suite"),
// turned into what the session is doing ("running the test suite")
const GERUNDS: Record<string, string> = {
  add: 'adding',
  apply: 'applying',
  build: 'building',
  check: 'checking',
  clean: 'cleaning',
  clone: 'cloning',
  commit: 'committing',
  compile: 'compiling',
  copy: 'copying',
  count: 'counting',
  create: 'creating',
  delete: 'deleting',
  deploy: 'deploying',
  diff: 'diffing',
  download: 'downloading',
  edit: 'editing',
  fetch: 'fetching',
  find: 'finding',
  fix: 'fixing',
  format: 'formatting',
  generate: 'generating',
  get: 'getting',
  inspect: 'inspecting',
  install: 'installing',
  kill: 'stopping',
  lint: 'linting',
  list: 'listing',
  look: 'looking',
  make: 'making',
  merge: 'merging',
  move: 'moving',
  open: 'opening',
  print: 'printing',
  pull: 'pulling',
  push: 'pushing',
  read: 'reading',
  rebase: 'rebasing',
  remove: 'removing',
  rename: 'renaming',
  render: 'rendering',
  restart: 'restarting',
  review: 'reviewing',
  run: 'running',
  search: 'searching',
  set: 'setting',
  show: 'showing',
  start: 'starting',
  stop: 'stopping',
  sync: 'syncing',
  test: 'testing',
  update: 'updating',
  upload: 'uploading',
  validate: 'validating',
  verify: 'verifying',
  view: 'viewing',
  wait: 'waiting',
  write: 'writing',
}

export function doing(description: string): string {
  const text = description.trim().replace(/\s+/g, ' ').replace(/[.:]+$/, '')
  if (text === '') {
    return ''
  }
  const space = text.indexOf(' ')
  const first = (space < 0 ? text : text.slice(0, space)).toLowerCase()
  const rest = space < 0 ? '' : text.slice(space)
  const gerund = GERUNDS[first]
  if (gerund !== undefined) {
    return gerund + rest
  }
  return text.charAt(0).toLowerCase() + text.slice(1)
}

// CLAUDE ASKS, for a permission that is not a command: the verb and its
// target, shown in gold where a command would be ("Edit src/auth/session.ts")
export const PERMISSION = {
  edit: (path: string) => `Edit ${path}`,
  write: (path: string) => `Write ${path}`,
  read: (path: string) => `Read ${path}`,
  fetch: (host: string) => `Fetch ${host}`,
  search: 'Search the web',
} as const

// The desk

export function waitingFoot(waited: string): string {
  return `Waiting ${waited}`
}

export function finishedFoot(took: string): string {
  return `Finished in ${took}`
}

export function stoppedFoot(took: string): string {
  return `Stopped after ${took}`
}

// CLAUDE SAYS, when Claude finished without a word
export const FINISHED = 'Finished'

export function filesChanged(n: number): string {
  return `${n} ${plural(n, 'file', 'files')} changed`
}

// THE ERROR: what stopped the turn, in plain words
export const ERROR_WORDS: Record<ErrorKind, string> = {
  authentication_failed: 'Claude is signed out. Sign in again to carry on.',
  oauth_org_not_allowed: 'This organization cannot use Claude Code here.',
  account_on_hold: 'The account is on hold.',
  verification_required: 'The account needs verifying before Claude can carry on.',
  billing_error: 'There is a billing problem with the account.',
  rate_limit: 'Claude hit its usage limit. It can carry on once the limit resets.',
  overloaded: 'Claude is overloaded right now. Try again in a moment.',
  invalid_request: 'Claude sent a request the API could not accept.',
  model_not_found: 'The model this session uses is not available.',
  server_error: 'Claude ran into a server error. Try again in a moment.',
  unknown: 'Claude stopped on an error.',
  max_output_tokens: 'Claude’s reply ran too long and was cut off.',
  cloud_credential_error: 'The cloud credentials for Claude are not working.',
}

export function errorWords(kind: string): string {
  return (ERROR_WORDS as Record<string, string>)[kind] ?? ERROR_WORDS.unknown
}

// The report on the hour

export function hourHeadline(stories: number): string {
  if (stories === 0) {
    return 'A QUIET HOUR'
  }
  return stories === 1 ? '1 STORY' : `${stories} STORIES`
}

export interface StoryCounts {
  needsInput: number
  ready: number
  complete: number
  error: number
}

export function hourStrap(counts: StoryCounts): string {
  const parts: string[] = []
  if (counts.needsInput > 0) {
    parts.push(`${counts.needsInput} ${plural(counts.needsInput, 'needs', 'need')} you`)
  }
  if (counts.ready > 0) {
    parts.push(`${counts.ready} ready for review`)
  }
  if (counts.complete > 0) {
    parts.push(`${counts.complete} finished`)
  }
  if (counts.error > 0) {
    parts.push(`${counts.error} stopped on an error`)
  }
  return parts.join(' · ')
}

export function quietStrap(working: number): string {
  if (working > 0) {
    return `${working} ${plural(working, 'session', 'sessions')} working, nothing needs you`
  }
  return 'Nothing needs you'
}

export function acrossSessions(n: number): string {
  return `Across ${n} ${plural(n, 'session', 'sessions')}`
}

// The wall monitor's foot: "14:00 to 15:00"
export function hourFoot(from: string, to: string): string {
  return `${from} to ${to}`
}

// THE HOUR IN REVIEW's tab: "14:00–15:00"
export function reviewSpan(from: string, to: string): string {
  return `${from}–${to}`
}

// One row's detail in THE HOUR IN REVIEW
export function reviewDetail(row: { kind: 'waiting'; minutes: number } | { kind: 'error' } | { kind: 'lines'; added: number; removed: number }): string {
  switch (row.kind) {
    case 'waiting':
      return row.minutes >= 1 ? `Waiting ${row.minutes} min` : 'Waiting'
    case 'error':
      return 'Stopped on an error'
    case 'lines':
      return row.added + row.removed > 0 ? figure(row.added, row.removed) : 'No changes this hour'
  }
}
