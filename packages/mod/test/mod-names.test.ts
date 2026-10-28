/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { modNameFindings } from '../../../scripts/lib/mod-names.mjs'

const plain = `export function register(on, options) {
  on('session.start', async ($, e, next) => next(e))
  on('classic.PermissionRequest', async ($, e, next) => {
    return next(e)
  })
}
`

describe('modNameFindings', () => {
  it('passes a module that uses on only to register hooks', () => {
    expect(modNameFindings(plain)).toEqual([])
  })

  it('finds a parameter called on', () => {
    const findings = modNameFindings(`function optionState(word, on) {\n  return on ? 'on' : 'off'\n}\n` + plain)
    expect(findings.length).toBeGreaterThan(0)
    for (const finding of findings) {
      expect(finding).toContain('MOD_CAPABILITY_USE_NOT_PLAIN')
    }
    expect(findings[0]?.startsWith('plugin/hooks/register.js:1 ')).toBe(true)
  })

  it('lets on be a property name', () => {
    expect(modNameFindings(`const words = { on: 'yes' }\nconst said = words.on\n` + plain)).toEqual([])
  })

  it('finds next bound outside a hook', () => {
    const findings = modNameFindings(`const next = 1\n` + plain)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toContain('MOD_PERMISSION_ANSWER_UNREAD')
  })

  it("finds e as another function's parameter", () => {
    const findings = modNameFindings(`function noteTranscript(e) {\n  return e\n}\n` + plain)
    expect(findings).toHaveLength(1)
    expect(findings[0]).toContain('MOD_PERMISSION_ANSWER_UNREAD')
  })

  it("counts a .catch handler's parameters as other bindings", () => {
    const source = `export function register(on, options) {
  on('tool.call', async ($, e, next) => next(e)).catch(async ($, e, next) => next(e))
}
`
    const findings = modNameFindings(source)
    expect(findings.some((finding) => finding.includes('MOD_PERMISSION_ANSWER_UNREAD') && finding.includes('binds e,'))).toBe(true)
    expect(findings.some((finding) => finding.includes('MOD_PERMISSION_ANSWER_UNREAD') && finding.includes('binds next,'))).toBe(true)
    expect(findings.some((finding) => finding.includes('MOD_CAPABILITY_USE_NOT_PLAIN'))).toBe(false)
  })

  it('finds nothing in the built mod', () => {
    expect(modNameFindings(readFileSync(new URL('../../../plugin/hooks/register.js', import.meta.url), 'utf8'))).toEqual([])
  })
})
