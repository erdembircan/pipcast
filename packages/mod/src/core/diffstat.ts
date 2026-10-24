// Lines changed: from git where the work happens in a repository, else from
// what the edit tools were asked to do.

import type { ToolInput } from './describe.ts'

// Per path, the lines added and removed against a commit
export type Numstat = Map<string, [number, number]>

// Lines changed, and the files they changed in, each named once across the
// session's trees
export interface Booking {
  added: number
  removed: number
  files: readonly string[]
}

// `git diff-index -M --numstat <commit>`: "added<TAB>removed<TAB>path" per file, "-" for a binary file's counts
export function parseNumstat(stdout: string): Numstat {
  const out: Numstat = new Map()
  for (const line of stdout.split('\n')) {
    const parts = line.split('\t')
    if (parts.length < 3) {
      continue
    }
    const added = Number.parseInt(parts[0] ?? '', 10)
    const removed = Number.parseInt(parts[1] ?? '', 10)
    out.set(parts.slice(2).join('\t'), [Number.isFinite(added) ? added : 0, Number.isFinite(removed) ? removed : 0])
  }
  return out
}

// The lines in a text; a final newline does not start a new one
export function countLines(text: string): number {
  if (text === '') {
    return 0
  }
  const breaks = text.split('\n').length - 1
  return text.endsWith('\n') ? breaks : breaks + 1
}

// What moved between two readings of a tree: the increases in added and
// removed lines, and every path that changed. A path changed when its counts
// differ, or when it is in one reading and not the other, as a binary file
// with no lines is.
export function delta(before: Numstat, after: Numstat): { added: number; removed: number; changed: string[] } {
  let added = 0
  let removed = 0
  const changed: string[] = []
  const paths = new Set([...before.keys(), ...after.keys()])
  for (const path of paths) {
    const [oldAdded, oldRemoved] = before.get(path) ?? [0, 0]
    const [newAdded, newRemoved] = after.get(path) ?? [0, 0]
    if (before.has(path) === after.has(path) && oldAdded === newAdded && oldRemoved === newRemoved) {
      continue
    }
    changed.push(path)
    added += Math.max(0, newAdded - oldAdded)
    removed += Math.max(0, newRemoved - oldRemoved)
  }
  return { added, removed, changed }
}

// Outside git: what an edit tool changed, and the file it touched
export function editCounts(tool: string, input: ToolInput): { added: number; removed: number; file: string } | null {
  const text = (value: unknown): string => (typeof value === 'string' ? value : '')
  switch (tool) {
    case 'Edit': {
      const file = text(input.file_path)
      return file === '' ? null : { added: countLines(text(input.new_string)), removed: countLines(text(input.old_string)), file }
    }
    case 'MultiEdit': {
      const file = text(input.file_path)
      if (file === '' || !Array.isArray(input.edits)) {
        return null
      }
      let added = 0
      let removed = 0
      for (const edit of input.edits as unknown[]) {
        if (typeof edit === 'object' && edit !== null) {
          added += countLines(text((edit as ToolInput).new_string))
          removed += countLines(text((edit as ToolInput).old_string))
        }
      }
      return { added, removed, file }
    }
    case 'Write': {
      const file = text(input.file_path)
      return file === '' ? null : { added: countLines(text(input.content)), removed: 0, file }
    }
    case 'NotebookEdit': {
      const file = text(input.notebook_path)
      return file === '' ? null : { added: countLines(text(input.new_source)), removed: 0, file }
    }
    default:
      return null
  }
}
