// The options /pipcast sets, against the plugin's own manifest: each is a
// boolean userConfig field under the title its replies use. Tune in every new
// session is on by default, and Transparent window off.

import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { COMMAND_ARGUMENT_HINT, OPTION_WORDS } from '../../../contract/src/copy.ts'
import { OPTIONS } from '../../src/core/options.ts'

interface Field {
  type?: string
  title?: string
  default?: unknown
}

const manifest = JSON.parse(readFileSync(new URL('../../plugin.json', import.meta.url), 'utf8')) as { userConfig?: Record<string, Field> }

describe('the options /pipcast sets', () => {
  it('are each a boolean field of the manifest, under the title the replies use', () => {
    for (const option of OPTIONS) {
      const field = manifest.userConfig?.[option.key]
      expect(field?.type).toBe('boolean')
      expect(field?.title).toBe(OPTION_WORDS[option.word]?.title)
    }
  })

  it('start with Tune in every new session on and Transparent window off', () => {
    expect(manifest.userConfig?.autoTuneIn?.default).toBe(true)
    expect(manifest.userConfig?.transparentWindow?.default).toBe(false)
  })

  it('have their words, and no others', () => {
    expect(Object.keys(OPTION_WORDS).sort()).toEqual(OPTIONS.map((option) => option.word).sort())
  })

  it('show in the slash menu after /pipcast', () => {
    expect(COMMAND_ARGUMENT_HINT).toBe('[auto|transparency on|off]')
  })
})
