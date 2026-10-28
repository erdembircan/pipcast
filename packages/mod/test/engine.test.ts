import { describe, expect, it } from 'vitest'

import { parentOf, processTag } from '../src/core/engine.ts'

const tag = 'pipcast-bf01352aefa5'
const header = `            ${tag}`
const listing = [
  header,
  '    1     0 /sbin/launchd',
  `49528 49524 /bin/ps -A -o pid= -o ppid= -o command=${tag}`,
  '49524 49519 /Users/me/Library/Application Support/Claude/claude-code/2.1.309/x/claude.app/Contents/MacOS/claude',
  '',
].join('\n')

describe('parentOf', () => {
  it('finds the parent of the ps that carries the tag', () => {
    expect(parentOf(listing, tag)).toBe(49524)
  })

  it('skips the header, which carries the tag alone', () => {
    expect(parentOf(header, tag)).toBeNull()
  })

  it('finds nothing when no line carries the tag', () => {
    expect(parentOf(listing, 'pipcast-other')).toBeNull()
  })

  it('finds nothing in an empty listing', () => {
    expect(parentOf('', tag)).toBeNull()
  })
})

describe('processTag', () => {
  it('is pipcast- and letters and digits', () => {
    expect(processTag()).toMatch(/^pipcast-[0-9a-z]+$/)
  })

  it('differs from one call to the next', () => {
    expect(processTag()).not.toBe(processTag())
  })
})
