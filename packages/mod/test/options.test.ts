import { describe, expect, it } from 'vitest'

import { OPTIONS, answerFor, installedId, needsSharing, parseRequest, readBoolean, stillPressed, wasSaved } from '../src/core/options.ts'

const auto = OPTIONS.find((option) => option.word === 'auto')
const transparency = OPTIONS.find((option) => option.word === 'transparency')

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

  it('reads transparency the same way', () => {
    expect(parseRequest('transparency')).toEqual({ kind: 'show', option: transparency })
    expect(parseRequest('Transparency ON')).toEqual({ kind: 'set', option: transparency, on: true })
    expect(parseRequest('transparency off')).toEqual({ kind: 'set', option: transparency, on: false })
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

describe('needsSharing', () => {
  it('writes options.json when it is missing or says otherwise, and leaves it when it agrees', () => {
    expect(needsSharing(null, false)).toBe(true)
    expect(needsSharing({ v: 1, transparent: true }, false)).toBe(true)
    expect(needsSharing({ v: 1, transparent: false }, false)).toBe(false)
    expect(needsSharing({ v: 1, transparent: true }, true)).toBe(false)
  })

  it('leaves a press of the window\'s button waiting to be saved, whatever it asks for', () => {
    expect(needsSharing({ v: 1, transparent: true, pressedAt: 5 }, false)).toBe(false)
    expect(needsSharing({ v: 1, transparent: false, pressedAt: 5 }, false)).toBe(false)
  })
})

describe('a press of the window\'s button', () => {
  it('is nothing to answer in a file with no press, or no file', () => {
    expect(answerFor(null, false)).toEqual({ kind: 'none' })
    expect(answerFor({ v: 1, transparent: true }, false)).toEqual({ kind: 'none' })
  })

  it('is taken away when it asks for the value the load already has, and saved otherwise', () => {
    expect(answerFor({ v: 1, transparent: true, pressedAt: 5 }, true)).toEqual({ kind: 'clear', pressedAt: 5, transparent: true })
    expect(answerFor({ v: 1, transparent: true, pressedAt: 5 }, false)).toEqual({ kind: 'save', pressedAt: 5, transparent: true })
    expect(answerFor({ v: 1, transparent: false, pressedAt: 5 }, true)).toEqual({ kind: 'save', pressedAt: 5, transparent: false })
  })

  it('is still there only while the file holds the same press', () => {
    expect(stillPressed({ v: 1, transparent: true, pressedAt: 5 }, 5)).toBe(true)
    expect(stillPressed({ v: 1, transparent: true, pressedAt: 6 }, 5)).toBe(false)
    expect(stillPressed({ v: 1, transparent: true }, 5)).toBe(false)
    expect(stillPressed(null, 5)).toBe(false)
  })
})
