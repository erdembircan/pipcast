import {
  clock,
  errorWords,
  figure,
  filesChanged,
  finishedFoot,
  FINISHED,
  stoppedFoot,
  waited,
  waitingFoot,
  duration,
} from '@pipcast/contract'
import type { Jingle, SessionRecord, Snapshot, Story } from '@pipcast/contract'
import type { ClawdAct, NewsEvent, Scene } from '@pipcast/design'

import { DESK_MS, REDUCED_OPENER_MS, STINGER_MS, STORY_OUTRO_MS } from './timing.ts'
import type { Step } from './types.ts'

export interface Segment {
  id: string
  steps: Step[]
  // Reduced motion leaves the outro out; its jingle fires as the board returns
  endCue?: Jingle
}

function newest(stories: Story[], kind: Story['kind']): Story | undefined {
  let found: Story | undefined
  for (const story of stories) {
    if (story.kind === kind && (found === undefined || story.at >= found.at)) {
      found = story
    }
  }
  return found
}

export function findSession(snapshot: Snapshot | null, sessionId: string): SessionRecord | undefined {
  return snapshot?.sessions.find((session) => session.id === sessionId)
}

// Has the session moved on from this story: is the thing it announced over?
export function movedOn(snapshot: Snapshot | null, sessionId: string, story: Story): boolean {
  const session = findSession(snapshot, sessionId)
  if (session === undefined) {
    return true
  }
  switch (story.kind) {
    case 'needs-input':
    case 'error':
      return session.state !== story.kind || newest(session.stories, story.kind)?.id !== story.id
    case 'ready':
    case 'complete': {
      const index = session.stories.findIndex((other) => other.id === story.id)
      if (index < 0) {
        return true
      }
      const newer = session.stories.some((other, i) => i > index || other.at > story.at)
      return newer || (session.state === 'working' && session.stateAt > story.at)
    }
  }
}

const ACT: Record<Story['kind'], ClawdAct> = {
  'needs-input': 'urgent',
  ready: 'cheer',
  complete: 'talk',
  error: 'glance',
}

function took(story: Story): string | undefined {
  return story.durationMs === undefined ? undefined : duration(story.durationMs)
}

function deskEvent(now: number, story: Story, title: string, project: string): NewsEvent {
  const event: NewsEvent = { kind: story.kind, session: title, project }
  switch (story.kind) {
    case 'needs-input':
      if (story.command !== undefined) {
        event.command = story.command
      }
      if (story.quote !== undefined) {
        event.quote = story.quote
      }
      event.foot = waitingFoot(waited(now - story.at))
      break
    case 'ready': {
      event.figure = figure(story.added ?? 0, story.removed ?? 0)
      event.sub = filesChanged(story.files ?? 0)
      const length = took(story)
      if (length !== undefined) {
        event.foot = finishedFoot(length)
      }
      break
    }
    case 'complete': {
      event.quote = story.quote || FINISHED
      const length = took(story)
      if (length !== undefined) {
        event.foot = finishedFoot(length)
      }
      break
    }
    case 'error': {
      event.quote = story.quote || errorWords('unknown')
      const length = took(story)
      if (length !== undefined) {
        event.foot = stoppedFoot(length)
      }
      break
    }
  }
  return event
}

// A story's segment: BREAKING NEWS, the desk, the outro
export function storySegment(
  sessionId: string,
  story: Story,
  snapshot: Snapshot | null,
  reducedMotion: boolean,
): Segment {
  const session = findSession(snapshot, sessionId)
  const title = session?.title ?? ''
  const project = session?.project ?? ''
  const opener: Step = {
    role: 'opener',
    length: reducedMotion ? REDUCED_OPENER_MS : STINGER_MS,
    cue: 'breaking',
    scene: ({ now }): Scene => ({ mode: 'stinger', clock: clock(now), progress: 1, event: { kind: story.kind } }),
  }
  const desk: Step = {
    role: 'desk',
    length: DESK_MS,
    scene: ({ now, ticker }): Scene => ({
      mode: 'desk',
      clock: clock(now),
      act: ACT[story.kind],
      event: deskEvent(now, story, title, project),
      ticker,
    }),
  }
  const outro: Step = {
    role: 'outro',
    length: STORY_OUTRO_MS,
    cue: 'breaking-out',
    scene: ({ now, board }): Scene => ({ mode: 'outro', clock: clock(now), progress: 1, board }),
  }
  const id = `story:${story.id}`
  if (reducedMotion) {
    return { id, steps: [opener, desk], endCue: 'breaking-out' }
  }
  return { id, steps: [opener, desk, outro] }
}
