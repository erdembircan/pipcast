import { describe, expect, it } from 'vitest'

import { OPTIONS, installedId, parseRequest, readBoolean, wasSaved } from '../../plugin/src/core/options.ts'

const auto = OPTIONS.find((option) => option.word === 'auto')

describe('parseRequest', () => {
  it('reads /pipcast on its own as tuning in or out', () => {
    expect(parseRequest('')).toEqual({ kind: 'toggle' })
    expect(parseRequest('   ')).toEqual({ kind: 'toggle' })
  })

  it('reads an option on its own as a question, and with on or off as a change', () => {
    expect(parseRequest('auto')).toEqual({ kind: 'show', option: auto })
    expect(parseRequest('auto on')).toEqual({ kind: 'set', option: auto, on: true })
    expect(parseRequest('auto off')).toEqual({ kind: 'set', option: auto, on: false })
  })

  it('reads the words in any case and spacing', () => {
    expect(parseRequest('  AUTO   On ')).toEqual({ kind: 'set', option: auto, on: true })
  })

  it('names a word it does not know as it was typed', () => {
    expect(parseRequest('Volume on')).toEqual({ kind: 'unknown', word: 'Volume' })
  })

  it('refuses a value that is not on or off, and words after it', () => {
    expect(parseRequest('auto maybe')).toEqual({ kind: 'bad-value', option: auto })
    expect(parseRequest('auto on now')).toEqual({ kind: 'bad-value', option: auto })
  })
})

describe('installedId', () => {
  const root = '/dev/pipcast-live/plugin'

  it('finds the entry read from the folder, or installed at it, trailing slashes aside', () => {
    expect(installedId(JSON.stringify([{ id: 'pipcast@pipcast', readFromFolder: `${root}/` }]), root)).toBe('pipcast@pipcast')
    expect(installedId(JSON.stringify([{ id: 'pipcast@market', installPath: root }]), root)).toBe('pipcast@market')
  })

  it('finds nothing for another folder or an answer it cannot read', () => {
    expect(installedId(JSON.stringify([{ id: 'pipcast@pipcast', readFromFolder: '/elsewhere' }]), root)).toBeNull()
    expect(installedId('not json', root)).toBeNull()
    expect(installedId('{}', root)).toBeNull()
  })
})

describe('what claude plugin configure answers', () => {
  it('reads a boolean field from inputs, after any lines before the JSON', () => {
    expect(readBoolean('{"inputs":{"autoTuneIn":"true"}}', 'autoTuneIn')).toBe(true)
    expect(readBoolean('Checking...\n{"inputs":{"autoTuneIn":"false"}}', 'autoTuneIn')).toBe(false)
    expect(readBoolean('{"inputs":{}}', 'autoTuneIn')).toBeNull()
    expect(readBoolean('nothing', 'autoTuneIn')).toBeNull()
  })

  it('tells a save from its saved list', () => {
    expect(wasSaved('{"saved":["autoTuneIn"]}', 'autoTuneIn')).toBe(true)
    expect(wasSaved('{"saved":[]}', 'autoTuneIn')).toBe(false)
    expect(wasSaved('', 'autoTuneIn')).toBe(false)
  })
})
