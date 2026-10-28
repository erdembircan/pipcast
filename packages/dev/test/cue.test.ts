import { describe, expect, it } from 'vitest'

import { checkCue, parseCue } from '../src/cue.ts'

const ready = { kind: 'ready' }
const nineReady = Array.from({ length: 9 }, () => ({ kind: 'ready' }))

describe('checkCue', () => {
  it.each([
    { id: 'c1', segment: 'story', stories: [{ kind: 'ready' }] },
    {
      id: 'ok',
      segment: 'story',
      stories: [
        { kind: 'needs-input', title: 'T', command: 'npm test', quote: 'Run?', minutes: 3 },
        { kind: 'ready', added: 5, removed: 1, files: 2, minutes: 9 },
      ],
    },
    { id: 'h', segment: 'hour' },
    { id: 'ok', segment: 'hour', sessions: [{ title: 'A', added: 3 }, { story: 'needs-input', minutes: 27 }] },
    { id: 'ok', segment: 'hour', samples: 4, quiet: true },
  ])('takes %j as it is', (input) => {
    expect(checkCue(input)).toEqual({ cue: input })
  })

  it('returns a copy, so changing the input afterwards leaves the cue as it was', () => {
    const input = { id: 'c1', segment: 'story', stories: [{ kind: 'ready', added: 1 }] }
    const checked = checkCue(input)
    input.stories[0]!.added = 99
    input.stories.push({ kind: 'ready', added: 2 })
    expect(checked).toEqual({ cue: { id: 'c1', segment: 'story', stories: [{ kind: 'ready', added: 1 }] } })
  })

  it.each<[string, unknown, string]>([
    ['not an object', [], 'a cue is a JSON object'],
    ['no id', { segment: 'story', stories: [ready] }, 'id must be 1 to 64 letters, digits, - or _'],
    ['an id with a space', { id: 'a b', segment: 'story', stories: [ready] }, 'id must be 1 to 64 letters, digits, - or _'],
    ['another segment', { id: 'c1', segment: 'news' }, 'segment must be story or hour'],
    ['no stories', { id: 'c1', segment: 'story', stories: [] }, 'stories must be a list of 1 to 8 stories'],
    ['nine stories', { id: 'c1', segment: 'story', stories: nineReady }, 'stories must be a list of 1 to 8 stories'],
    ['a story that is no object', { id: 'c1', segment: 'story', stories: ['x'] }, 'stories[0] must be an object'],
    [
      'another kind',
      { id: 'c1', segment: 'story', stories: [{ kind: 'done' }] },
      'stories[0].kind must be needs-input, ready, complete or error',
    ],
    [
      'a command on a ready story',
      { id: 'c1', segment: 'story', stories: [{ kind: 'ready', command: 'x' }] },
      'stories[0].command is for needs-input stories',
    ],
    [
      'a quote on a ready story',
      { id: 'c1', segment: 'story', stories: [{ kind: 'ready', quote: 'x' }] },
      'stories[0].quote is for needs-input, complete and error stories',
    ],
    [
      'lines on an error story',
      { id: 'c1', segment: 'story', stories: [{ kind: 'error', added: 1 }] },
      'stories[0].added is for ready stories',
    ],
    [
      'an unknown field in a story',
      { id: 'c1', segment: 'story', stories: [{ kind: 'ready', colour: 'red' }] },
      'unknown field stories[0].colour',
    ],
    [
      'a fraction of a line',
      { id: 'c1', segment: 'story', stories: [{ kind: 'ready', added: 1.5 }] },
      'stories[0].added must be a whole number from 0 to 9999999',
    ],
    [
      'too many minutes',
      { id: 'c1', segment: 'story', stories: [{ kind: 'ready', minutes: 10000 }] },
      'stories[0].minutes must be a whole number from 0 to 9999',
    ],
    [
      'an empty title',
      { id: 'c1', segment: 'story', stories: [{ kind: 'needs-input', title: '' }] },
      'stories[0].title must be text of 1 to 1000 characters',
    ],
    ['samples on a story cue', { id: 'c1', segment: 'story', samples: 2, stories: [ready] }, 'unknown field samples'],
    [
      'sessions and samples',
      { id: 'c1', segment: 'hour', sessions: [{}], samples: 2 },
      "sessions and samples can't both be given",
    ],
    ['no sessions', { id: 'c1', segment: 'hour', sessions: [] }, 'sessions must be a list of 1 to 24 sessions'],
    [
      'minutes for a working session',
      { id: 'c1', segment: 'hour', sessions: [{ minutes: 3 }] },
      'sessions[0].minutes is for a session that needs input or stopped on an error',
    ],
    [
      'another state',
      { id: 'c1', segment: 'hour', sessions: [{ state: 'busy' }] },
      'sessions[0].state must be working, needs-input, ready or error',
    ],
    [
      'another story kind',
      { id: 'c1', segment: 'hour', sessions: [{ story: 'x' }] },
      'sessions[0].story must be needs-input, ready, complete or error',
    ],
    ['eight samples', { id: 'c1', segment: 'hour', samples: 8 }, 'samples must be a whole number from 1 to 7'],
    ['no samples', { id: 'c1', segment: 'hour', samples: 0 }, 'samples must be a whole number from 1 to 7'],
    ['a fraction of samples', { id: 'c1', segment: 'hour', samples: 2.5 }, 'samples must be a whole number from 1 to 7'],
    ['quiet alone', { id: 'c1', segment: 'hour', quiet: true }, 'quiet goes with samples'],
    ['quiet as text', { id: 'c1', segment: 'hour', samples: 4, quiet: 'yes' }, 'quiet must be true or false'],
    ['stories on an hour cue', { id: 'c1', segment: 'hour', stories: [] }, 'unknown field stories'],
  ])('says what is wrong with %s', (_name, input, problem) => {
    expect(checkCue(input)).toEqual({ problem })
  })
})

describe('parseCue', () => {
  it('says when the text is not JSON', () => {
    expect(parseCue('{')).toEqual({ problem: 'not JSON' })
  })

  it('checks the cue in the text', () => {
    expect(parseCue('{"id":"h","segment":"hour"}')).toEqual({ cue: { id: 'h', segment: 'hour' } })
    expect(parseCue('{"id":"h","segment":"news"}')).toEqual({ problem: 'segment must be story or hour' })
  })
})
