// @vitest-environment jsdom
import '../../renderer/src/react-global.ts'

import { describe, expect, it } from 'vitest'

import { samples } from '../../renderer/src/design.ts'
import { HOUR_SAMPLES, defaultsFrom } from '../src/defaults.ts'

import { DEFAULTS } from './helpers.ts'

describe('defaultsFrom', () => {
  it('reads the design system’s sample scenes into what the tests hold as the defaults', () => {
    expect(defaultsFrom(samples)).toEqual(DEFAULTS)
  })

  it('has one hour sample for each of the sample sessions', () => {
    expect(HOUR_SAMPLES).toHaveLength(DEFAULTS.sessions.length)
  })

  it('throws when the design system lacks a sample', () => {
    expect(() => defaultsFrom({})).toThrow('the design system has no sample review-seven')
  })
})
