import { describe, expect, it } from 'vitest'
import { defaultHome, storePaths } from '@pipcast/contract'

describe('the store paths', () => {
  it('puts the store under Application Support', () => {
    expect(defaultHome('/Users/me/')).toBe('/Users/me/Library/Application Support/Pipcast')
    expect(defaultHome('/Users/me')).toBe('/Users/me/Library/Application Support/Pipcast')
  })

  it('names every file in the store', () => {
    const paths = storePaths('/tmp/pipcast/')
    expect(paths.root).toBe('/tmp/pipcast')
    expect(paths.sessions).toBe('/tmp/pipcast/sessions')
    expect(paths.session('abc')).toBe('/tmp/pipcast/sessions/abc.json')
    expect(paths.station).toBe('/tmp/pipcast/station.json')
    expect(paths.control).toBe('/tmp/pipcast/control.json')
    expect(paths.prefs).toBe('/tmp/pipcast/prefs.json')
    expect(paths.lock).toBe('/tmp/pipcast/station.lock')
    expect(paths.log).toBe('/tmp/pipcast/station.log')
  })
})
