import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

// The sections the plugin's README and this repository's README share, word for word
const SHARED = ['What Pipcast runs and reads', 'Privacy']

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

// A "## heading" section, up to the next "## " heading, or null when there is none
function section(readme: string, heading: string): string | null {
  const lines = readme.split('\n')
  const start = lines.indexOf(`## ${heading}`)
  if (start === -1) {
    return null
  }
  const end = lines.findIndex((line, i) => i > start && line.startsWith('## '))
  return lines
    .slice(start, end === -1 ? undefined : end)
    .join('\n')
    .trimEnd()
}

describe('the READMEs', () => {
  const plugin = read('../README.md')
  const root = read('../../../README.md')

  for (const heading of SHARED) {
    it(`share "## ${heading}" word for word`, () => {
      expect(section(plugin, heading)).not.toBeNull()
      expect(section(plugin, heading)).toBe(section(root, heading))
    })
  }
})
