/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { renameShellNames } from '../../../scripts/lib/react-dom-names.mjs'

describe('renameShellNames', () => {
  it('renames sh and Sh, and nothing else', () => {
    expect(renameShellNames('function sh(a){return a}\nfunction Sh(){return sh(1)}\nvar o={useEffect:Sh,label:"sh"};Sh()')).toBe(
      'function sQ9(a){return a}\nfunction SQ9(){return sQ9(1)}\nvar o={useEffect:SQ9,label:"sh"};SQ9()',
    )
  })

  it('refuses to rename a property name', () => {
    expect(() => renameShellNames('var o={sh:1}')).toThrow()
  })

  it('refuses a file that already has a new name', () => {
    expect(() => renameShellNames('var sQ9=1;function sh(){}')).toThrow()
  })

  it('leaves React DOM with no sh or Sh, and React DOM again when named back', () => {
    const original = readFileSync(new URL('../../../node_modules/react-dom/umd/react-dom.production.min.js', import.meta.url), 'utf8')
    const result = renameShellNames(original)
    expect(result).not.toMatch(/(?<![\w$])(sh|Sh)(?![\w$])/)
    expect(result.replace(/sQ9/g, 'sh').replace(/SQ9/g, 'Sh')).toBe(original)
  })
})
