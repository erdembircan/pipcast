import { describe, expect, it } from 'vitest'

import { countLines, delta, editCounts, parseNumstat } from '../../plugin/src/core/diffstat.ts'

describe('parseNumstat', () => {
  it('reads added, removed and path per line', () => {
    const out = parseNumstat('12\t3\tsrc/a.ts\n0\t7\tb.md\n')
    expect([...out]).toEqual([
      ['src/a.ts', [12, 3]],
      ['b.md', [0, 7]],
    ])
  })

  it('counts a binary file as 0 and 0', () => {
    expect(parseNumstat('-\t-\timage.png\n').get('image.png')).toEqual([0, 0])
  })

  it('keeps a path with a tab or a rename arrow whole', () => {
    expect(parseNumstat('1\t1\ta\tb\n').get('a\tb')).toEqual([1, 1])
    expect(parseNumstat('1\t0\told => new\n').get('old => new')).toEqual([1, 0])
  })

  it('is empty for nothing and skips lines it cannot read', () => {
    expect(parseNumstat('').size).toBe(0)
    expect(parseNumstat('warning: something\n').size).toBe(0)
  })
})

describe('countLines', () => {
  it('counts lines, a final newline not starting a new one', () => {
    expect(countLines('')).toBe(0)
    expect(countLines('a')).toBe(1)
    expect(countLines('a\n')).toBe(1)
    expect(countLines('a\nb')).toBe(2)
    expect(countLines('a\nb\n')).toBe(2)
    expect(countLines('\n')).toBe(1)
    expect(countLines('\n\n')).toBe(2)
  })
})

describe('delta', () => {
  const before = parseNumstat('5\t1\tsrc/a.ts\n2\t2\tsrc/b.ts\n')

  it('is nothing when nothing moved', () => {
    expect(delta(before, parseNumstat('5\t1\tsrc/a.ts\n2\t2\tsrc/b.ts\n'))).toEqual({ added: 0, removed: 0, changed: [] })
  })

  it('counts a changed file once, with the increases', () => {
    const after = parseNumstat('9\t4\tsrc/a.ts\n2\t2\tsrc/b.ts\n')
    expect(delta(before, after)).toEqual({ added: 4, removed: 3, changed: ['src/a.ts'] })
  })

  it('counts a file that is new to the diff from zero', () => {
    const after = parseNumstat('5\t1\tsrc/a.ts\n2\t2\tsrc/b.ts\n8\t0\tsrc/c.ts\n')
    expect(delta(before, after)).toEqual({ added: 8, removed: 0, changed: ['src/c.ts'] })
  })

  it('counts only the increases when a file shrinks, and still the file', () => {
    const after = parseNumstat('3\t1\tsrc/a.ts\n2\t2\tsrc/b.ts\n')
    expect(delta(before, after)).toEqual({ added: 0, removed: 0, changed: ['src/a.ts'] })
    expect(delta(before, new Map())).toEqual({ added: 0, removed: 0, changed: ['src/a.ts', 'src/b.ts'] })
  })

  it('names a file that comes or goes with no lines, as git names a binary one', () => {
    expect(delta(new Map(), new Map([['image.png', [0, 0]]]))).toEqual({ added: 0, removed: 0, changed: ['image.png'] })
    expect(delta(new Map([['gone.ts', [3, 1]]]), new Map())).toEqual({ added: 0, removed: 0, changed: ['gone.ts'] })
  })
})

describe('editCounts', () => {
  it('counts an Edit as the lines of old_string removed and new_string added', () => {
    expect(editCounts('Edit', { file_path: '/p/a.ts', old_string: 'a\nb\n', new_string: 'x\ny\nz' })).toEqual({
      added: 3,
      removed: 2,
      file: '/p/a.ts',
    })
  })

  it('sums a MultiEdit over its edits', () => {
    expect(
      editCounts('MultiEdit', {
        file_path: '/p/a.ts',
        edits: [
          { old_string: 'a', new_string: 'b\nc' },
          { old_string: 'd\ne', new_string: '' },
          'junk',
        ],
      }),
    ).toEqual({ added: 2, removed: 3, file: '/p/a.ts' })
  })

  it('counts a Write as its lines added, and a NotebookEdit its new source', () => {
    expect(editCounts('Write', { file_path: '/p/b.ts', content: 'one\ntwo\n' })).toEqual({ added: 2, removed: 0, file: '/p/b.ts' })
    expect(editCounts('NotebookEdit', { notebook_path: '/p/n.ipynb', new_source: 'print(1)' })).toEqual({
      added: 1,
      removed: 0,
      file: '/p/n.ipynb',
    })
  })

  it('is null for any other tool or for an edit that names no file', () => {
    expect(editCounts('Bash', { command: 'ls' })).toBeNull()
    expect(editCounts('Edit', { old_string: 'a', new_string: 'b' })).toBeNull()
    expect(editCounts('MultiEdit', { file_path: '/p/a.ts' })).toBeNull()
    expect(editCounts('Write', { content: 'x' })).toBeNull()
  })
})
