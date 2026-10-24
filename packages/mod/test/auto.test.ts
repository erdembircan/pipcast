import { describe, expect, it } from 'vitest'

import { startKind } from '../src/core/auto.ts'

describe('startKind', () => {
  it('reads a fresh start, a /clear and a fork as a new session', () => {
    expect(startKind('startup')).toBe('new')
    expect(startKind('clear')).toBe('new')
    expect(startKind('fork')).toBe('new')
  })

  it('reads a resume as an old session carried on', () => {
    expect(startKind('resume')).toBe('old')
  })

  it('reads a compaction as the same session going on', () => {
    expect(startKind('compact')).toBe('same')
  })

  it('reads a source it does not know as an old session', () => {
    expect(startKind('teleport')).toBe('old')
    expect(startKind(undefined)).toBe('old')
    expect(startKind(42)).toBe('old')
  })
})
