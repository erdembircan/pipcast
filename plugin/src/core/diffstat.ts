// Lines changed during a turn: from git when the session is in a repository,
// else from what the edit tools were asked to do.

import type { ToolInput } from './describe.ts'

export type Numstat = Map<string, [number, number]>

export interface Changes {
  added: number
  removed: number
  files: number
}

// `git diff-index -M --numstat HEAD`:"added<TAB>removed<TAB>path" per file, "-" for a binary file's counts
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

// What changed since `before`. A file whose counts differ counts once, with
// the increases in added and removed lines; `newFiles` holds the line count of
// each new untracked file, which counts as a file with all its lines added.
export function delta(before: Numstat, after: Numstat, newFiles: readonly number[]): Changes {
  let added = 0
  let removed = 0
  let files = 0
  const paths = new Set([...before.keys(), ...after.keys()])
  for (const path of paths) {
    const [oldAdded, oldRemoved] = before.get(path) ?? [0, 0]
    const [newAdded, newRemoved] = after.get(path) ?? [0, 0]
    if (oldAdded === newAdded && oldRemoved === newRemoved) {
      continue
    }
    files += 1
    added += Math.max(0, newAdded - oldAdded)
    removed += Math.max(0, newRemoved - oldRemoved)
  }
  for (const lines of newFiles) {
    files += 1
    added += lines
  }
  return { added, removed, files }
}

// With no repository: what an edit tool changed, and the file it touched
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
