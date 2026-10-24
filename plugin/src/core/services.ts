// Tuning in, tuning out and checking in. The services reach the world only
// through the Io port, which register.tsx builds from `$`.

import { storePaths } from '../contract/paths.ts'
import { isStationAlive, parseControl, parseStationStatus, trimRecord } from '../contract/validate.ts'
import type { SessionRecord } from '../contract/types.ts'
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
  // A file's size in bytes and when it last changed; null when it cannot be told
  stat(path: string): Promise<{ size: number; mtimeMs: number } | null>
  // `${path}.tmp`, then renamed into place
  write(path: string, text: string): Promise<void>
  // fine when missing
  remove(path: string): Promise<void>
  // names; [] when missing
  list(dir: string): Promise<string[]>
  // `timeoutMs` stops a command that runs longer, and the call then rejects;
  // `stdin` is written to the command's input
  run(argv: readonly string[], cwd?: string, timeoutMs?: number, stdin?: string): Promise<RunResult>
  // PIPCAST_STATION_BIN, else `${plugin root}/station/pipcast-station`
  stationBinary(): Promise<string>
  // `${plugin root}/station`
  stationAssets(): string
  // PIPCAST_TARGET_BUNDLE_ID
  targetBundleId(): Promise<string | null>
}

export type TuneInResult = { status: 'on'; tunedInAt: number } | { status: 'cannot-start' }

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
  await writeRecord(io, home, model, now, now)
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
export async function checkIn(io: Io, model: SessionModel, tunedInAt: number): Promise<{ closed: boolean }> {
  const home = await io.storeHome()
  const now = await io.now()
  const paths = storePaths(home)
  const { closedAt } = parseControl(await readJson(io, paths.control))
  if (closedAt !== null && closedAt >= tunedInAt) {
    await io.remove(paths.session(model.record.id))
    return { closed: true }
  }
  await writeRecord(io, home, model, tunedInAt, now)
  if (!isStationAlive(parseStationStatus(await readJson(io, paths.station)), now)) {
    await ensureStation(io, home)
  }
  return { closed: false }
}
