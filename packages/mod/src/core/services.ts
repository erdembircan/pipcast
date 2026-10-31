// Tuning in, tuning out and checking in. The services reach the world only
// through the Io port, which register.tsx builds from `$`.

import { storePaths } from '../../../contract/src/paths.ts'
import { isStationAlive, parseControl, parseSharedOptions, parseStationStatus, trimRecord } from '../../../contract/src/validate.ts'
import type { SessionRecord, SharedOptions } from '../../../contract/src/types.ts'
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
  // `temp`, by default `${path}.tmp`, then renamed into place
  write(path: string, text: string, temp?: string): Promise<void>
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

// A record no session has written for this long belongs to a session that
// stopped without tuning out, as when Claude Code was force-quit. A session
// on air writes its whole record every HEARTBEAT_MS; one that a Mac's sleep
// kept quiet longer writes it again at its first heartbeat after the Mac wakes.
export const ORPHAN_MS = 3_600_000

// Deletes every record in the store, with the temporary file beside it, that no
// session has written for ORPHAN_MS, and a temporary file left alone that old,
// but never the record of the session `own`
export async function sweepOrphans(io: Io, home: string, own: string): Promise<void> {
  const { sessions } = storePaths(home)
  const now = await io.now()
  for (const name of await io.list(sessions)) {
    if (!name.endsWith('.json') && !name.endsWith('.json.tmp')) {
      continue
    }
    if (name === `${own}.json` || name === `${own}.json.tmp`) {
      continue
    }
    const found = await io.stat(`${sessions}/${name}`)
    if (found !== null && now - found.mtimeMs > ORPHAN_MS) {
      await io.remove(`${sessions}/${name}`)
    }
  }
}

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
  // Records a session left behind go first; a failure here never stops a tune-in
  await sweepOrphans(io, home, id).catch(() => undefined)
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

// A tuned-in session that has been ready this long goes off the air at its
// next heartbeat. The hour counts from the latest of when it went ready, when
// it tuned in and its newest activity line: tuning in again gives it a full
// hour, and so do the tool calls of a turn that a reload left showing ready
export const READY_IDLE_MS = 3_600_000

function idleTooLong(record: SessionRecord, tunedInAt: number, now: number): boolean {
  if (record.state !== 'ready') {
    return false
  }
  const since = Math.max(record.stateAt, tunedInAt, ...record.activity.map((line) => line.at))
  return now - since >= READY_IDLE_MS
}

// Why a heartbeat took the session off the air: the window's close, or an
// hour ready; null while it stays on
export type OffAir = 'closed' | 'idle' | null

// The heartbeat of a tuned-in session
export async function checkIn(io: Io, model: SessionModel, tunedInAt: number): Promise<{ off: OffAir }> {
  const home = await io.storeHome()
  const now = await io.now()
  const paths = storePaths(home)
  const { closedAt } = parseControl(await readJson(io, paths.control))
  if (closedAt !== null && closedAt >= tunedInAt) {
    await io.remove(paths.session(model.record.id))
    return { off: 'closed' }
  }
  if (idleTooLong(model.record, tunedInAt, now)) {
    await io.remove(paths.session(model.record.id))
    return { off: 'idle' }
  }
  await writeRecord(io, home, model, tunedInAt, now)
  if (!isStationAlive(parseStationStatus(await readJson(io, paths.station)), now)) {
    await ensureStation(io, home)
  }
  return { off: null }
}

// options.json, what the station follows of the plugin's options; null when
// it is missing or not one
export async function readSharedOptions(io: Io, home: string): Promise<SharedOptions | null> {
  return parseSharedOptions(await readJson(io, storePaths(home).options))
}

// Writes options.json through a temporary file named after the writer, so two
// sessions writing at once never move each other's
export async function shareOptions(io: Io, home: string, options: SharedOptions, writer: string): Promise<void> {
  const path = storePaths(home).options
  await io.write(path, JSON.stringify(options), `${path}.${writer}.tmp`)
}
