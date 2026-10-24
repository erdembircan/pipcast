// Tuning in, tuning out and checking in. The services reach the world only
// through the Io port, which register.tsx builds from `$`.

import { storePaths } from '../../../contract/src/paths.ts'
import { isStationAlive, parseControl, parseSharedOptions, parseStationStatus, trimRecord } from '../../../contract/src/validate.ts'
import type { SessionRecord, SharedOptions } from '../../../contract/src/types.ts'
import type { SessionModel } from './model.ts'
import { answerFor, stillPressed } from './options.ts'

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

// What came of a press of the window's Transparent window button: none to
// answer; taken away, its value being the option's already; saved; refused by
// Claude Code, and the file put back to this load's value; or overtaken by a
// newer press or a /pipcast transparency while it was being saved, and left
// for the next check-in
export type PressOutcome = 'none' | 'cleared' | 'saved' | 'refused' | 'overtaken'

// Answers a press of the window's Transparent window button, as a session on
// air does at its check-in. `transparent` is this load's value of the option,
// and `save` saves a value as the option, true once Claude Code has. The file
// is written again only while it still holds the same press: with the press's
// value once that is the option's, else with this load's, and either way
// without the press.
export async function answerPress(
  io: Io,
  home: string,
  transparent: boolean,
  writer: string,
  save: (on: boolean) => Promise<boolean>,
): Promise<PressOutcome> {
  const answer = answerFor(await readSharedOptions(io, home), transparent)
  if (answer.kind === 'none') {
    return 'none'
  }
  const saved = answer.kind === 'clear' || (await save(answer.transparent))
  if (!stillPressed(await readSharedOptions(io, home), answer.pressedAt)) {
    return 'overtaken'
  }
  await shareOptions(io, home, { v: 1, transparent: saved ? answer.transparent : transparent }, writer)
  return answer.kind === 'clear' ? 'cleared' : saved ? 'saved' : 'refused'
}
