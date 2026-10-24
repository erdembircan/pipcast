// The options /pipcast sets. `/pipcast <option> on` or `off` saves one, and
// `/pipcast <option>` says what it is. Each is a boolean field of the plugin
// manifest's userConfig, which Claude Code keeps with its other plugin options.

import type { SharedOptions } from '../../../contract/src/types.ts'

export interface OptionSpec {
  // The word after /pipcast
  word: string
  // The field's key in the manifest's userConfig
  key: string
}

export const OPTIONS: readonly OptionSpec[] = [
  { word: 'auto', key: 'autoTuneIn' },
  { word: 'transparency', key: 'transparentWindow' },
]

// The one option the station follows, through options.json
export const TRANSPARENT_KEY = 'transparentWindow'

// Whether a session that tunes in, or reloads while tuned in, writes its own
// value to options.json: when the file is missing, cannot be read or says otherwise
export function needsSharing(file: SharedOptions | null, transparent: boolean): boolean {
  return file === null || file.transparent !== transparent
}

// What the words after /pipcast ask for
export type Request =
  | { kind: 'toggle' }
  | { kind: 'show'; option: OptionSpec }
  | { kind: 'set'; option: OptionSpec; on: boolean }
  | { kind: 'unknown'; word: string }
  | { kind: 'bad-value'; option: OptionSpec }

export function parseRequest(args: string): Request {
  const typed = args.trim().split(/\s+/).filter((word) => word !== '')
  const [first, value, ...rest] = typed.map((word) => word.toLowerCase())
  if (first === undefined) {
    return { kind: 'toggle' }
  }
  const option = OPTIONS.find((candidate) => candidate.word === first)
  if (option === undefined) {
    return { kind: 'unknown', word: typed[0] ?? first }
  }
  if (value === undefined) {
    return { kind: 'show', option }
  }
  if (rest.length === 0 && (value === 'on' || value === 'off')) {
    return { kind: 'set', option, on: value === 'on' }
  }
  return { kind: 'bad-value', option }
}

const trimmed = (path: string) => path.replace(/\/+$/, '')

// The plugin's id in `claude plugin list --json`: the entry read from, or
// installed at, the folder the mod runs from. Null when Claude Code did not
// install this copy, as with a --plugin-dir copy or one the desktop app hands
// to the session itself.
export function installedId(listJson: string, root: string): string | null {
  let entries: unknown
  try {
    entries = JSON.parse(listJson) as unknown
  } catch {
    return null
  }
  if (!Array.isArray(entries)) {
    return null
  }
  const here = trimmed(root)
  for (const entry of entries as unknown[]) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const { id, readFromFolder, installPath } = entry as { id?: unknown; readFromFolder?: unknown; installPath?: unknown }
    const isHere = [readFromFolder, installPath].some((path) => typeof path === 'string' && trimmed(path) === here)
    if (typeof id === 'string' && isHere) {
      return id
    }
  }
  return null
}

// The object in a `claude plugin configure --json` answer, from its first line that opens one
function answerOf(stdout: string): Record<string, unknown> | null {
  const at = stdout.search(/^\{/m)
  if (at < 0) {
    return null
  }
  try {
    const parsed = JSON.parse(stdout.slice(at)) as unknown
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

// What a `claude plugin configure --json` answer says a boolean field holds; null when it does not say
export function readBoolean(stdout: string, key: string): boolean | null {
  const inputs = answerOf(stdout)?.inputs
  const value = typeof inputs === 'object' && inputs !== null ? (inputs as Record<string, unknown>)[key] : undefined
  return value === 'true' ? true : value === 'false' ? false : null
}

// Whether a `claude plugin configure --json --values-stdin` answer lists the field as saved
export function wasSaved(stdout: string, key: string): boolean {
  const saved = answerOf(stdout)?.saved
  return Array.isArray(saved) && saved.includes(key)
}
