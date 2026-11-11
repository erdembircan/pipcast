import { describe, expect, it } from 'vitest'

import { OPTIONS, installedId, mergedOptions, needsSharing, parseRequest, readBoolean, wasSaved } from '../src/core/options.ts'

const auto = OPTIONS.find((option) => option.word === 'auto')
const transparency = OPTIONS.find((option) => option.word === 'transparency')
const tv = OPTIONS.find((option) => option.word === 'tv')

describe('parseRequest', () => {
  it('reads /pipcast on its own as tuning in or out', () => {
    expect(parseRequest('')).toEqual({ kind: 'toggle' })
    expect(parseRequest('   ')).toEqual({ kind: 'toggle' })
  })

  it('reads an option on its own as a question, and with on or off as a change', () => {
    expect(parseRequest('auto')).toEqual({ kind: 'show', option: auto })
    expect(parseRequest('auto on')).toEqual({ kind: 'set', option: auto, enabled: true })
    expect(parseRequest('auto off')).toEqual({ kind: 'set', option: auto, enabled: false })
  })

  it('reads transparency the same way', () => {
    expect(parseRequest('transparency')).toEqual({ kind: 'show', option: transparency })
    expect(parseRequest('Transparency ON')).toEqual({ kind: 'set', option: transparency, enabled: true })
    expect(parseRequest('transparency off')).toEqual({ kind: 'set', option: transparency, enabled: false })
  })

  it('reads tv the same way', () => {
    expect(parseRequest('tv')).toEqual({ kind: 'show', option: tv })
    expect(parseRequest('TV On')).toEqual({ kind: 'set', option: tv, enabled: true })
    expect(parseRequest('tv off')).toEqual({ kind: 'set', option: tv, enabled: false })
    expect(tv?.key).toBe('oldTv')
  })

  it('reads the words in any case and spacing', () => {
    expect(parseRequest('  AUTO   On ')).toEqual({ kind: 'set', option: auto, enabled: true })
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

describe('needsSharing', () => {
  it('writes options.json when it is missing or says otherwise, and leaves it when it agrees', () => {
    const wanted = (transparent: boolean, oldTv: boolean) => ({ transparent, oldTv })
    expect(needsSharing(null, wanted(false, false))).toBe(true)
    expect(needsSharing({ v: 1, transparent: true, oldTv: false }, wanted(false, false))).toBe(true)
    expect(needsSharing({ v: 1, transparent: false, oldTv: false }, wanted(false, false))).toBe(false)
    expect(needsSharing({ v: 1, transparent: true, oldTv: false }, wanted(true, false))).toBe(false)
    expect(needsSharing({ v: 1, transparent: false, oldTv: false }, wanted(false, true))).toBe(true)
    expect(needsSharing({ v: 1, transparent: false, oldTv: true }, wanted(false, true))).toBe(false)
    expect(needsSharing({ v: 1, transparent: true, oldTv: true }, wanted(true, false))).toBe(true)
  })
})

describe('mergedOptions', () => {
  const own = { transparent: true, oldTv: false }

  it('replaces only the key that was set, keeping the other as the file holds it', () => {
    const file = { v: 1 as const, transparent: false, oldTv: true }
    expect(mergedOptions(file, own, 'oldTv', false)).toEqual({ transparent: false, oldTv: false })
    expect(mergedOptions(file, own, 'transparentWindow', true)).toEqual({ transparent: true, oldTv: true })
  })

  it('falls back to this load\'s values for the other key when there is no file', () => {
    expect(mergedOptions(null, own, 'oldTv', true)).toEqual({ transparent: true, oldTv: true })
    expect(mergedOptions(null, own, 'transparentWindow', false)).toEqual({ transparent: false, oldTv: false })
  })
})
