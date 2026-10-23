// Tuning in, tuning out and checking in. The services reach the world only
// through the Io port, which register.tsx builds from `$`.

import { MAX_ON_AIR } from '../contract/constants.ts'
import { storePaths } from '../contract/paths.ts'
import {
  isOnAir,
  isStationAlive,
  onAir,
  parseControl,
  parseSessionRecord,
  parseStationStatus,
  trimRecord,
} from '../contract/validate.ts'
import type { SessionRecord } from '../contract/types.ts'
import { countLines, delta, parseNumstat } from './diffstat.ts'
import type { Changes, Numstat } from './diffstat.ts'
import type { SessionModel } from './model.ts'

export interface RunResult {
  exitCode: number
  stdout: string
  stderr: string
}

export interface Io {
  now(): Promise<number>
  // PIPCAST_HOME, else defaultHome(HOME)
  storeHome(): Promise<string>
  // CLAUDE_CONFIG_DIR, else `${HOME}/.claude`: where the engine keeps its projects
  claudeConfigDir(): Promise<string>
  // null when missing
  read(path: string): Promise<string | null>
  // A file's size in bytes; null when it cannot be told
  size(path: string): Promise<number | null>
  // `${path}.tmp`, then renamed into place
  write(path: string, text: string): Promise<void>
  // fine when missing
  remove(path: string): Promise<void>
  // names; [] when missing
  list(dir: string): Promise<string[]>
  run(argv: readonly string[], cwd?: string): Promise<RunResult>
  // PIPCAST_STATION_BIN, else `${plugin root}/station/pipcast-station`
  stationBinary(): Promise<string>
  // `${plugin root}/station`
  stationAssets(): string
  // PIPCAST_TARGET_BUNDLE_ID
  targetBundleId(): Promise<string | null>
}

export type TuneInResult = { status: 'on'; tunedInAt: number } | { status: 'full' } | { status: 'cannot-start' }

async function readJson(io: Io, path: string): Promise<unknown> {
  const text = await io.read(path)
  if (text === null) {
    return null
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return null
  }
}

// Every parseable sessions/*.json; a half-written .tmp is never read
export async function readRecords(io: Io, home: string): Promise<SessionRecord[]> {
  const paths = storePaths(home)
  const records: SessionRecord[] = []
  for (const name of await io.list(paths.sessions)) {
    if (!name.endsWith('.json')) {
      continue
    }
    const record = parseSessionRecord(await readJson(io, `${paths.sessions}/${name}`))
    if (record !== null) {
      records.push(record)
    }
  }
  return records
}

export async function countOnAir(io: Io, home: string, now: number): Promise<number> {
  return onAir(await readRecords(io, home), now).length
}

// The record as it is written: this model's, with its two times
export function recordOf(model: SessionModel, tunedInAt: number, checkedInAt: number): SessionRecord {
  return trimRecord({ ...model.record, tunedInAt, checkedInAt })
}

export async function writeRecord(io: Io, home: string, model: SessionModel, tunedInAt: number, now: number): Promise<void> {
  await io.write(storePaths(home).session(model.record.id), JSON.stringify(recordOf(model, tunedInAt, now)))
}

// Starts the station unless one is serving; true when it says so
export async function ensureStation(io: Io, home: string): Promise<boolean> {
  try {
    const binary = await io.stationBinary()
    await io.run(['/bin/chmod', '+x', binary])
    const argv = [binary, 'launch', '--home', home, '--assets', io.stationAssets()]
    const target = await io.targetBundleId()
    if (target !== null && target !== '') {
      argv.push('--target-bundle-id', target)
    }
    const result = await io.run(argv)
    const out = result.stdout.trim()
    return result.exitCode === 0 && (out.startsWith('started') || out.startsWith('running'))
  } catch {
    return false
  }
}

export async function tuneIn(io: Io, model: SessionModel): Promise<TuneInResult> {
  const home = await io.storeHome()
  const now = await io.now()
  const id = model.record.id
  const others = (await readRecords(io, home)).filter((record) => record.id !== id)
  if (onAir(others, now).length >= MAX_ON_AIR) {
    return { status: 'full' }
  }
  await writeRecord(io, home, model, now, now)
  // Another session may have written at the same moment: the later reader of
  // the same rule loses
  if (!isOnAir(id, await readRecords(io, home), now)) {
    await io.remove(storePaths(home).session(id))
    return { status: 'full' }
  }
  if (!(await ensureStation(io, home))) {
    await io.remove(storePaths(home).session(id))
    return { status: 'cannot-start' }
  }
  return { status: 'on', tunedInAt: now }
}

export async function tuneOut(io: Io, home: string, id: string): Promise<void> {
  await io.remove(storePaths(home).session(id))
}

// The heartbeat of a tuned-in session
export async function checkIn(io: Io, model: SessionModel, tunedInAt: number): Promise<{ closed: boolean; onAir: number }> {
  const home = await io.storeHome()
  const now = await io.now()
  const paths = storePaths(home)
  const { closedAt } = parseControl(await readJson(io, paths.control))
  if (closedAt !== null && closedAt >= tunedInAt) {
    await io.remove(paths.session(model.record.id))
    return { closed: true, onAir: await countOnAir(io, home, now) }
  }
  await writeRecord(io, home, model, tunedInAt, now)
  if (!isStationAlive(parseStationStatus(await readJson(io, paths.station)), now)) {
    await ensureStation(io, home)
  }
  return { closed: false, onAir: await countOnAir(io, home, now) }
}

// What the turn's changes are measured against: git's counts and the untracked
// files at the turn's start; null when git cannot say (no repository, no commit)
export interface Baseline {
  numstat: Numstat
  untracked: Set<string>
}

const MAX_NEW_FILES_READ = 200
const MAX_NEW_FILE_BYTES = 1_000_000
// git takes a file with a NUL byte in its first 8,000 bytes for binary
const BINARY_PROBE = 8_000

// git's counts and the untracked files. `git diff-index`, not `git diff`: when
// files were touched without changing, `git diff` writes the index back under
// .git/index.lock, and a git command of Claude's or yours that needs the lock
// at that moment fails. -M finds renames, as `git diff` does.
async function gitState(io: Io, cwd: string): Promise<Baseline | null> {
  const diff = await io.run(['/usr/bin/git', 'diff-index', '-M', '--numstat', 'HEAD'], cwd)
  if (diff.exitCode !== 0) {
    return null
  }
  const others = await io.run(['/usr/bin/git', 'ls-files', '--others', '--exclude-standard', '-z'], cwd)
  if (others.exitCode !== 0) {
    return null
  }
  return { numstat: parseNumstat(diff.stdout), untracked: new Set(others.stdout.split('\0').filter((path) => path !== '')) }
}

export async function takeBaseline(io: Io, cwd: string): Promise<Baseline | null> {
  try {
    return await gitState(io, cwd)
  } catch {
    return null
  }
}

// A new untracked file's lines, as git counts them once it is added: none for
// a binary file or one over MAX_NEW_FILE_BYTES. The size is looked up first,
// so a big file is not read at all.
async function newFileLines(io: Io, path: string): Promise<number> {
  const size = await io.size(path)
  if (size !== null && size > MAX_NEW_FILE_BYTES) {
    return 0
  }
  const text = await io.read(path)
  if (text === null || text.length > MAX_NEW_FILE_BYTES || text.slice(0, BINARY_PROBE).includes('\u0000')) {
    return 0
  }
  return countLines(text)
}

// The turn's changes: git's counts and untracked files now, against the baseline
export async function changesSince(io: Io, cwd: string, baseline: Baseline): Promise<Changes> {
  const now = await gitState(io, cwd)
  if (now === null) {
    return { added: 0, removed: 0, files: 0 }
  }
  const fresh = [...now.untracked].filter((path) => !baseline.untracked.has(path))
  const newFiles: number[] = []
  for (const [index, path] of fresh.entries()) {
    newFiles.push(index < MAX_NEW_FILES_READ ? await newFileLines(io, `${cwd}/${path}`) : 0)
  }
  return delta(baseline.numstat, now.numstat, newFiles)
}
