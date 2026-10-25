import { describe, expect, it } from 'vitest'

import type { SessionRecord } from '@pipcast/contract'

import { inListingOrder, waitingSince } from '../src/listing.ts'
import { at, session, story } from './helpers.ts'

function ids(sessions: SessionRecord[]): string[] {
  return sessions.map((record) => record.id)
}

describe("the listing's order", () => {
  it('puts what needs you first: needs input, then error, then ready, then working', () => {
    const sorted = inListingOrder([
      session('working', { state: 'working' }),
      session('ready', { state: 'ready' }),
      session('error', { state: 'error' }),
      session('asking', { state: 'needs-input' }),
    ])
    expect(ids(sorted)).toEqual(['asking', 'error', 'ready', 'working'])
  })

  it('puts the longest waiting first within needs input', () => {
    const sorted = inListingOrder([
      session('later', { state: 'needs-input', stateAt: at(14, 20), stories: [story('later:1', 'needs-input', at(14, 20))] }),
      session('earlier', { state: 'needs-input', stateAt: at(14, 5), stories: [story('earlier:1', 'needs-input', at(14, 5))] }),
    ])
    expect(ids(sorted)).toEqual(['earlier', 'later'])
  })

  it('puts the longest waiting first within error', () => {
    const sorted = inListingOrder([
      session('later', { state: 'error', stateAt: at(14, 25), stories: [story('later:1', 'error', at(14, 25))] }),
      session('earlier', { state: 'error', stateAt: at(14, 10), stories: [story('earlier:1', 'error', at(14, 10))] }),
    ])
    expect(ids(sorted)).toEqual(['earlier', 'later'])
  })

  it('counts a wait from the newest ask, as the ticker does', () => {
    // Asked at 14:00 and again at 14:20, so it has waited since 14:20
    const twice = session('twice', {
      state: 'needs-input',
      stateAt: at(14, 0),
      stories: [story('twice:1', 'needs-input', at(14, 0)), story('twice:2', 'needs-input', at(14, 20))],
    })
    const once = session('once', {
      state: 'needs-input',
      stateAt: at(14, 10),
      stories: [story('once:1', 'needs-input', at(14, 10))],
    })
    expect(ids(inListingOrder([twice, once]))).toEqual(['once', 'twice'])
  })

  it('puts the newest change first within ready', () => {
    const sorted = inListingOrder([
      session('earlier', { state: 'ready', stateAt: at(1, 12) }),
      session('later', { state: 'ready', stateAt: at(12, 21) }),
    ])
    expect(ids(sorted)).toEqual(['later', 'earlier'])
  })

  it('puts the newest change first within working', () => {
    const sorted = inListingOrder([
      session('earlier', { state: 'working', stateAt: at(11, 45) }),
      session('later', { state: 'working', stateAt: at(12, 21) }),
    ])
    expect(ids(sorted)).toEqual(['later', 'earlier'])
  })

  it('keeps the order on air for sessions that tie', () => {
    const sorted = inListingOrder([
      session('b', { state: 'ready', stateAt: at(14) }),
      session('a', { state: 'ready', stateAt: at(14) }),
      session('c', { state: 'ready', stateAt: at(14) }),
    ])
    expect(ids(sorted)).toEqual(['b', 'a', 'c'])
  })

  it('leaves the list it is given as it was', () => {
    const given = [session('working', { state: 'working' }), session('asking', { state: 'needs-input' })]
    inListingOrder(given)
    expect(ids(given)).toEqual(['working', 'asking'])
  })
})

describe('waitingSince', () => {
  it("counts from the session's newest story of its state", () => {
    const record = session('a', {
      state: 'needs-input',
      stateAt: at(14, 0),
      stories: [story('a:1', 'needs-input', at(14, 0)), story('a:2', 'needs-input', at(14, 20))],
    })
    expect(waitingSince(record)).toBe(at(14, 20))
  })

  it("counts only stories of the session's state", () => {
    const record = session('a', {
      state: 'error',
      stateAt: at(14, 10),
      stories: [story('a:1', 'error', at(14, 10)), story('a:2', 'ready', at(14, 20))],
    })
    expect(waitingSince(record)).toBe(at(14, 10))
  })

  it('counts from when the state last changed, with no story of that kind', () => {
    expect(waitingSince(session('a', { state: 'needs-input', stateAt: at(14, 5) }))).toBe(at(14, 5))
  })
})
