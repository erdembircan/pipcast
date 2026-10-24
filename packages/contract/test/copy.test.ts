import { describe, expect, it } from 'vitest'
import {
  BAND_ALT,
  ERROR_WORDS,
  afterReportLine,
  deskLine,
  doing,
  errorWords,
  fallbackTitle,
  hourHeadline,
  hourSoFarLine,
  hourStrap,
  reviewDetail,
  stillWaitingLine,
  storyLine,
} from '@pipcast/contract'

describe('the ticker', () => {
  it('writes a line for each kind of story', () => {
    expect(storyLine('needs-input', 'T')).toBe('T needs your input')
    expect(storyLine('ready', 'T')).toBe('T ready for review')
    expect(storyLine('complete', 'T')).toBe('T: work complete')
    expect(storyLine('error', 'T')).toBe('T stopped on an error')
  })

  it('adds the wait to a story that is still waiting', () => {
    expect(stillWaitingLine('needs-input', 'Fix flaky checkout test', 5)).toBe(
      'Fix flaky checkout test needs your input · 5 min',
    )
    expect(stillWaitingLine('error', 'T', 0)).toBe('T stopped on an error')
  })

  it('writes the line after a report', () => {
    expect(afterReportLine(2, '15:00', '16:00')).toBe('2 stories at 15:00 · next report 16:00')
    expect(afterReportLine(1, '15:00', '16:00')).toBe('1 story at 15:00 · next report 16:00')
    expect(afterReportLine(0, '15:00', '16:00')).toBe('A quiet hour · next report 16:00')
  })

  it('writes the line for the report while it is on air', () => {
    expect(hourSoFarLine(2, '14:00', 3, 4)).toBe('2 stories since 14:00')
    expect(hourSoFarLine(1, '14:00', 3, 4)).toBe('1 story since 14:00')
    expect(hourSoFarLine(0, '10:00', 4, 4)).toBe('A quiet hour: 4 sessions working')
  })

  it('writes the desk line', () => {
    expect(deskLine(1, 4)).toBe('1 session working')
    expect(deskLine(0, 3)).toBe('3 sessions on KLWD')
    expect(deskLine(0, 1)).toBe('1 session on KLWD')
  })
})

describe('doing', () => {
  it('turns a command description into what the session is doing', () => {
    expect(doing('Run the test suite')).toBe('running the test suite')
    expect(doing('Install dependencies.')).toBe('installing dependencies')
    expect(doing('Sync files')).toBe('syncing files')
  })

  it('leaves a verb it does not know as it is', () => {
    expect(doing('Bump the version')).toBe('bump the version')
  })

  it('gives nothing for nothing', () => {
    expect(doing('   ')).toBe('')
  })
})

describe('the band and the station', () => {
  it('names the band for a screen reader: KLWD and the action', () => {
    expect(BAND_ALT.in).toBe('KLWD, Tune in')
    expect(BAND_ALT.out).toBe('KLWD, Tune out')
  })

  it('names a session that has no title yet', () => {
    expect(fallbackTitle('web-shop', '3f2a9c10')).toBe('web-shop-3f')
  })
})

describe('errors', () => {
  it('falls back to the plain words for a kind it does not know', () => {
    expect(errorWords('nope')).toBe('Claude stopped on an error.')
  })

  it('has words for a kind it does know', () => {
    expect(errorWords('rate_limit')).toBe(ERROR_WORDS.rate_limit)
  })
})

describe('the report on the hour', () => {
  it('counts the stories in the headline', () => {
    expect(hourHeadline(0)).toBe('A QUIET HOUR')
    expect(hourHeadline(1)).toBe('1 STORY')
    expect(hourHeadline(3)).toBe('3 STORIES')
  })

  it('writes the strap', () => {
    expect(hourStrap({ needsInput: 1, ready: 1, complete: 0, error: 0 })).toBe('1 needs you · 1 ready for review')
    expect(hourStrap({ needsInput: 2, ready: 0, complete: 1, error: 1 })).toBe(
      '2 need you · 1 finished · 1 stopped on an error',
    )
  })

  it('writes the detail of a row in the review', () => {
    expect(reviewDetail({ kind: 'waiting', minutes: 0 })).toBe('Waiting')
    expect(reviewDetail({ kind: 'waiting', minutes: 4 })).toBe('Waiting 4 min')
    expect(reviewDetail({ kind: 'error' })).toBe('Stopped on an error')
    expect(reviewDetail({ kind: 'lines', added: 182, removed: 40 })).toBe('+182 −40')
    expect(reviewDetail({ kind: 'lines', added: 0, removed: 0 })).toBe('No changes this hour')
  })
})
