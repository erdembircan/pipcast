// What a cue's made-up data falls back on: the design system's own sample
// scenes, the sessions and words its frames and the station's #demo use. The
// figures are the ones those sample desks and THE HOUR IN REVIEW show.

import type { StoryKind } from '../../contract/src/types.ts'

import type { DevHourSession } from './cue.ts'

export interface SampleSession {
  title: string
  project: string
}

// A sample story of one kind: its session, and the words and figures its desk
// shows
export interface SampleStory extends SampleSession {
  command?: string
  quote?: string
  added?: number
  removed?: number
  files?: number
  minutes?: number
}

export interface Defaults {
  // The design system's seven sample sessions, in the order review-seven lists them
  sessions: SampleSession[]
  stories: Record<StoryKind, SampleStory>
}

// The parts of the design system's sample scenes these defaults read
export interface SampleScene {
  event?: { session?: string; project?: string; command?: string; quote?: string }
  rows?: { name?: string; project?: string }[]
}

// What each of the seven sample sessions did in the sample hour, as
// review-seven shows it: checkout, notes, auth, sqlite, crash, search, runners
export const HOUR_SAMPLES: readonly DevHourSession[] = [
  { state: 'needs-input', story: 'needs-input', minutes: 27 },
  { state: 'ready', story: 'ready', added: 182, removed: 40, files: 4 },
  { added: 1204, removed: 310, files: 9 },
  { added: 64, removed: 12, files: 2 },
  { added: 18, removed: 3, files: 1 },
  { added: 240, removed: 88, files: 5 },
  { added: 31, removed: 9, files: 1 },
]

function scene(samples: Record<string, SampleScene>, name: string): SampleScene {
  const found = samples[name]
  if (found === undefined) {
    throw new Error(`the design system has no sample ${name}`)
  }
  return found
}

// A sample desk's session and words
function desk(samples: Record<string, SampleScene>, name: string): SampleStory {
  const event = scene(samples, name).event
  if (event?.session === undefined || event.project === undefined) {
    throw new Error(`the sample ${name} names no session`)
  }
  return {
    title: event.session,
    project: event.project,
    ...(event.command === undefined ? {} : { command: event.command }),
    ...(event.quote === undefined ? {} : { quote: event.quote }),
  }
}

export function defaultsFrom(samples: Record<string, SampleScene>): Defaults {
  const sessions = (scene(samples, 'review-seven').rows ?? []).map((row) => {
    if (row.name === undefined || row.project === undefined) {
      throw new Error('a row of the sample review-seven names no session')
    }
    return { title: row.name, project: row.project }
  })
  if (sessions.length !== HOUR_SAMPLES.length) {
    throw new Error(`the sample review-seven has ${sessions.length} rows, not ${HOUR_SAMPLES.length}`)
  }
  return {
    sessions,
    stories: {
      'needs-input': desk(samples, 'run-needs-input'),
      ready: { ...desk(samples, 'ready-desk'), added: 182, removed: 40, files: 4, minutes: 9 },
      complete: { ...desk(samples, 'complete-desk'), minutes: 6 },
      error: { ...desk(samples, 'error-desk'), minutes: 31 },
    },
  }
}
