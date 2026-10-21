import { describe, expect, it } from 'vitest'

import {
  AFTER_REPORT_MS,
  BREAKING_MS,
  DESK_MS,
  GAP_MS,
  HOUR_OUTRO_MS,
  IDENT_LEAD_MS,
  IDENT_MS,
  REDUCED_OPENER_MS,
  REPORT_GRACE_MS,
  REVIEW_MS,
  STINGER_MS,
  STORY_OUTRO_MS,
} from '../src/timing.ts'

describe('timing', () => {
  it('keeps the lengths of the steps', () => {
    expect([STINGER_MS, DESK_MS, STORY_OUTRO_MS]).toEqual([1900, 10_000, 1400])
    expect([IDENT_MS, DESK_MS, REVIEW_MS, HOUR_OUTRO_MS]).toEqual([7500, 10_000, 10_000, 1600])
    expect(REDUCED_OPENER_MS).toBe(1000)
  })

  it('keeps the other lengths of time', () => {
    expect(GAP_MS).toBe(2000)
    expect(IDENT_LEAD_MS).toBe(5000)
    expect(REPORT_GRACE_MS).toBe(10 * 60_000)
    expect(BREAKING_MS).toBe(40_000)
    expect(AFTER_REPORT_MS).toBe(10 * 60_000)
  })
})
