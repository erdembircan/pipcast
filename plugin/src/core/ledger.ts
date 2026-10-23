// The lines a session's work changes, counted in every git working tree the
// work runs in: the session's own and each subagent's worktree. A tree is
// read after every call that can change files, and what changed since the
// last reading is booked at once, in the hour it happened.

import { countLines, delta, parseNumstat } from './diffstat.ts'
import type { Booking, Numstat } from './diffstat.ts'
import type { Io } from './services.ts'

// The tools that can change files. A call the engine ran read-only changes none.
export const FILE_TOOLS: readonly string[] = ['Bash', 'Edit', 'MultiEdit', 'Write', 'NotebookEdit']

// How long one git command may run before the reading is given up
export const GIT_TIMEOUT_MS = 10_000

// How many trees a session keeps readings of; the least recently read goes first
export const MAX_TREES = 8

// How many folders and subagents a session remembers the trees of before it
// forgets them all and finds them again
export const MAX_FOLDERS = 64

const MAX_UNTRACKED = 200
const MAX_NEW_FILE_BYTES = 1_000_000
// git takes a file with a NUL byte in its first 8,000 bytes for binary
const BINARY_PROBE = 8_000

export const NOTHING: Booking = { added: 0, removed: 0, files: [] }

// An untracked file's lines, and the size and time they were counted at
export interface FileMark {
  size: number
  mtimeMs: number
  lines: number
}

// One reading of a tree. `counts` holds each tracked file's lines against
// `head`, and each untracked file as all its lines added, so a file that is
// added or committed later has the same counts as before.
export interface Reading {
  top: string
  head: string
  counts: Numstat
  untracked: Map<string, FileMark>
}

async function git(io: Io, folder: string, args: readonly string[]): Promise<string | null> {
  const done = await io.run(['/usr/bin/git', ...args], folder, GIT_TIMEOUT_MS)
  return done.exitCode === 0 ? done.stdout : null
}

// The top folder of the git working tree that holds `folder`; null outside
// git, or when git cannot say
export async function topOf(io: Io, folder: string): Promise<string | null> {
  try {
    const top = (await git(io, folder, ['rev-parse', '--show-toplevel']))?.trim() ?? ''
    return top === '' ? null : top
  } catch {
    return null
  }
}

// An untracked file's lines, as git counts them once it is added: none for a
// binary file or one over MAX_NEW_FILE_BYTES, which is not read at all
async function fileLines(io: Io, path: string, size: number): Promise<number> {
  if (size > MAX_NEW_FILE_BYTES) {
    return 0
  }
  const text = await io.read(path)
  if (text === null || text.length > MAX_NEW_FILE_BYTES || text.slice(0, BINARY_PROBE).includes('\u0000')) {
    return 0
  }
  return countLines(text)
}

// Reads the tree at `top`; null when git cannot say: no commit yet, a tree
// that is gone, a command that failed or ran too long. An untracked file
// whose size and time match `before` keeps its count and is not read again.
// `git diff-index`, not `git diff`, which writes the index back under
// .git/index.lock when files were touched without changing; -M finds renames.
export async function readTree(io: Io, top: string, before: Reading | null): Promise<Reading | null> {
  try {
    const head = (await git(io, top, ['rev-parse', '--verify', '-q', 'HEAD']))?.trim() ?? ''
    if (head === '') {
      return null
    }
    const diff = await git(io, top, ['diff-index', '-M', '--numstat', head])
    if (diff === null) {
      return null
    }
    const others = await git(io, top, ['ls-files', '--others', '--exclude-standard', '-z'])
    if (others === null) {
      return null
    }
    const counts = parseNumstat(diff)
    const untracked = new Map<string, FileMark>()
    for (const path of others.split('\0').filter((name) => name !== '').slice(0, MAX_UNTRACKED)) {
      const stat = await io.stat(`${top}/${path}`)
      if (stat === null) {
        continue
      }
      const known = before?.untracked.get(path)
      const lines =
        known !== undefined && known.size === stat.size && known.mtimeMs === stat.mtimeMs
          ? known.lines
          : await fileLines(io, `${top}/${path}`, stat.size)
      untracked.set(path, { size: stat.size, mtimeMs: stat.mtimeMs, lines })
      counts.set(path, [lines, 0])
    }
    return { top, head, counts, untracked }
  } catch {
    return null
  }
}

// Reads the tree again and books what changed since `before`. A new commit,
// the session's own, a pull, a rebase or a checkout, books nothing: the
// readings go on from it, and the lines the session wrote were booked when
// it wrote them. The reading is null when the tree cannot be read any more.
export async function look(io: Io, before: Reading): Promise<{ reading: Reading | null; booking: Booking }> {
  const reading = await readTree(io, before.top, before)
  if (reading === null || reading.head !== before.head) {
    return { reading, booking: NOTHING }
  }
  const moved = delta(before.counts, reading.counts)
  return {
    reading,
    booking: { added: moved.added, removed: moved.removed, files: moved.changed.map((path) => `${before.top}/${path}`) },
  }
}

// Keeps a reading as the most recent, and only the newest MAX_TREES
export function remember(trees: Map<string, Reading>, reading: Reading): void {
  trees.delete(reading.top)
  trees.set(reading.top, reading)
  while (trees.size > MAX_TREES) {
    const oldest = trees.keys().next().value
    if (oldest === undefined) {
      break
    }
    trees.delete(oldest)
  }
}

// `<the transcript's folder>/<session id>/subagents/agent-<agent id>.meta.json`:
// the engine's note on a subagent, which names the worktree it runs in
export function agentMetaPath(transcriptDir: string, sessionId: string, agentId: string): string {
  return `${transcriptDir}/${sessionId}/subagents/agent-${agentId}.meta.json`
}

// The worktree a subagent runs in, from the engine's note on it; null when it
// runs in the session's folder; undefined when there is no note yet, or the
// note does not parse
export function parseAgentMeta(text: string | null): string | null | undefined {
  if (text === null) {
    return undefined
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null) {
    return undefined
  }
  const path = (parsed as { worktreePath?: unknown }).worktreePath
  return typeof path === 'string' && path !== '' ? path : null
}
