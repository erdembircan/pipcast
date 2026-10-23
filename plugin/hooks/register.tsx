import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement, Timer } from 'claude-code'

import { ACTIVITY_WRITE_MS, HEARTBEAT_MS } from '../src/contract/constants.ts'
import { COMMAND_DESCRIPTION, COMMAND_NAME, REPLY, TOAST_CANNOT_START, fallbackTitle } from '../src/contract/copy.ts'
import { defaultHome, storePaths } from '../src/contract/paths.ts'
import { parseSessionRecord } from '../src/contract/validate.ts'
import { BAND_HEIGHT, REACH, band, blankLabel } from '../src/core/band.ts'
import { activity, lastWords, permission, question } from '../src/core/describe.ts'
import type { ToolInput } from '../src/core/describe.ts'
import { editCounts } from '../src/core/diffstat.ts'
import type { Booking } from '../src/core/diffstat.ts'
import { FILE_TOOLS, MAX_FOLDERS, NOTHING, agentMetaPath, look, parseAgentMeta, readTree, remember, topOf } from '../src/core/ledger.ts'
import type { Reading } from '../src/core/ledger.ts'
import * as record from '../src/core/model.ts'
import type { SessionModel } from '../src/core/model.ts'
import { willWake } from '../src/core/wake.ts'
import {
  checkIn,
  countOnAir,
  ensureStation,
  tuneIn,
  tuneOut,
  writeRecord,
} from '../src/core/services.ts'
import type { Io, TuneInResult } from '../src/core/services.ts'
import { TITLE_CHECK_MS, findTranscriptDir, readTitleFile, transcriptDirOf } from '../src/core/title.ts'

const tuned = atom({ plugin: 'pipcast', key: 'tuned' } as const, false)
const onAir = atom({ plugin: 'pipcast', key: 'onAir' } as const, 0)

// What the hooks share. A reload starts the module over, and session.start
// builds all of this again from $.state and the session's own record.
let model: SessionModel | null = null
let sessionRoot = ''
// When this session tuned in; null while it is not tuned in
let tunedInAt: number | null = null
let heartbeat: Timer | undefined
let activityTimer: Timer | undefined
// Reads the engine's title file while tuned in
let titleTimer: Timer | undefined
let checkingTitle = false
// The folder of the session's transcript, for the session it was found for; dir is null when it is not known
let transcriptDir: { id: string; dir: string | null } | null = null
let lastWriteAt = 0
// classic.SessionStart arrives before session.start: its title waits here
let hookTitle: string | null = null
// Writes run one after another, so an older state never lands after a newer one
let queue: Promise<void> = Promise.resolve()
// The git trees the session's work runs in: each one's latest reading by its
// top folder, least recently read first
const trees = new Map<string, Reading>()
// The top folder of the tree that holds each folder seen, or null outside git
const tops = new Map<string, string | null>()
// The worktree each subagent runs in, or null for one in the session's folder
const agentFolders = new Map<string, string | null>()
// Readings run one after another, so that two never book the same change
let readings: Promise<void> = Promise.resolve()

// The engine's own band is an empty Box; another mod's band has content.
const hasContent = (drawn: RenderElement) => drawn.type !== 'Box' || (drawn.children?.length ?? 0) > 0

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task, task)
  return queue
}

// A tool call's arguments: the event, less the envelope around them
function toolInput(e: object): ToolInput {
  const input: ToolInput = {}
  for (const [key, value] of Object.entries(e)) {
    if (key !== 'tool' && key !== 'tool_use_id' && key !== 'agentId') {
      input[key] = value
    }
  }
  return input
}

function baseName(path: string): string {
  return path.replace(/\/+$/, '').split('/').pop() ?? ''
}

function failure($: EngineInterface, where: string, error: unknown): void {
  const text = error instanceof Error ? error.message : String(error)
  $.ui.log(`pipcast: ${where}: ${text}`, { to: 'debug' })
}

function ioFor($: EngineInterface): Io {
  return {
    now: () => $.clock.now(),
    async storeHome() {
      const home = await $.env.get('PIPCAST_HOME')
      return home !== undefined && home !== '' ? home : defaultHome((await $.env.get('HOME')) ?? '')
    },
    async claudeConfigDir() {
      const dir = await $.env.get('CLAUDE_CONFIG_DIR')
      return dir !== undefined && dir !== '' ? dir : `${(await $.env.get('HOME')) ?? ''}/.claude`
    },
    async read(path) {
      try {
        return (await $.fs.read(path)) as string
      } catch {
        return null
      }
    },
    async stat(path) {
      try {
        const found: unknown = await $.fs.stat(path)
        if (typeof found !== 'object' || found === null) {
          return null
        }
        const { size, mtimeMs } = found as { size?: unknown; mtimeMs?: unknown }
        return typeof size === 'number' && typeof mtimeMs === 'number' ? { size, mtimeMs } : null
      } catch {
        return null
      }
    },
    async write(path, text) {
      const dir = path.slice(0, path.lastIndexOf('/'))
      if (!(await $.fs.exists(dir))) {
        // The store is private to the user
        await $.process.run(['/bin/mkdir', '-p', '-m', '700', dir.slice(0, dir.lastIndexOf('/'))])
        await $.process.run(['/bin/mkdir', '-m', '700', dir])
      }
      await $.fs.write(`${path}.tmp`, text)
      const moved = await $.process.run(['/bin/mv', '-f', `${path}.tmp`, path])
      if (moved.exitCode !== 0) {
        throw new Error(moved.stderr)
      }
    },
    async remove(path) {
      await $.process.run(['/bin/rm', '-f', path, `${path}.tmp`])
    },
    async list(dir) {
      try {
        return (await $.fs.list(dir)).map((entry) => entry.name)
      } catch {
        return []
      }
    },
    async run(argv, cwd, timeoutMs) {
      const init: { cwd?: string; timeoutMs?: number } = {}
      if (cwd !== undefined) {
        init.cwd = cwd
      }
      if (timeoutMs !== undefined) {
        init.timeoutMs = timeoutMs
      }
      const done = await $.process.run(argv, cwd === undefined && timeoutMs === undefined ? undefined : init)
      return { exitCode: done.exitCode, stdout: done.stdout, stderr: done.stderr }
    },
    async stationBinary() {
      const bin = await $.env.get('PIPCAST_STATION_BIN')
      return bin !== undefined && bin !== '' ? bin : `${$.plugin.root}/station/pipcast-station`
    },
    stationAssets: () => `${$.plugin.root}/station`,
    async targetBundleId() {
      const id = await $.env.get('PIPCAST_TARGET_BUNDLE_ID')
      return id !== undefined && id !== '' ? id : null
    },
  }
}

// Saves the record, when tuned in
async function save($: EngineInterface): Promise<void> {
  await enqueue(async () => {
    const m = model
    const at = tunedInAt
    if (m === null || at === null) {
      return
    }
    try {
      const io = ioFor($)
      const now = await $.clock.now()
      await writeRecord(io, await io.storeHome(), m, at, now)
      lastWriteAt = now
    } catch (error) {
      failure($, 'writing the record', error)
    }
  })
}

// An activity line writes at most every ACTIVITY_WRITE_MS; a timer catches the last
async function saveActivity($: EngineInterface): Promise<void> {
  if (tunedInAt === null || activityTimer !== undefined) {
    return
  }
  const wait = lastWriteAt + ACTIVITY_WRITE_MS - (await $.clock.now())
  if (wait <= 0) {
    await save($)
    return
  }
  activityTimer = $.clock.after(wait, () => {
    activityTimer = undefined
    void save($)
  })
}

async function setState($: EngineInterface, hasTuned: boolean, count: number): Promise<void> {
  if ((await read($, tuned)) !== hasTuned) {
    await update($, tuned, () => hasTuned)
  }
  if ((await read($, onAir)) !== count) {
    await update($, onAir, () => count)
  }
}

async function refreshOnAir($: EngineInterface): Promise<void> {
  const io = ioFor($)
  const count = await countOnAir(io, await io.storeHome(), await $.clock.now())
  if ((await read($, onAir)) !== count) {
    await update($, onAir, () => count)
  }
}

function stopTimers(): void {
  activityTimer?.cancel()
  activityTimer = undefined
  titleTimer?.cancel()
  titleTimer = undefined
}

// Where the engine keeps the session's files, from a classic hook's input
function noteTranscript(e: object): void {
  const { session_id: id, transcript_path: path } = e as { session_id?: unknown; transcript_path?: unknown }
  if (typeof id !== 'string' || typeof path !== 'string') {
    return
  }
  const dir = transcriptDirOf(path, id)
  if (dir !== null) {
    transcriptDir = { id, dir }
  }
}

// The folder of the session's transcript: from a hook, else found once
async function transcriptDirFor(io: Io, id: string): Promise<string | null> {
  if (transcriptDir === null || transcriptDir.id !== id) {
    transcriptDir = { id, dir: await findTranscriptDir(io, id) }
  }
  return transcriptDir.dir
}

function inLine<T>(task: () => Promise<T>): Promise<T> {
  const run = readings.then(task, task)
  readings = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

// A new session, or none: its trees are found again
function forgetTrees(): void {
  trees.clear()
  tops.clear()
  agentFolders.clear()
}

function folderPart(path: string): string {
  const at = path.lastIndexOf('/')
  return at > 0 ? path.slice(0, at) : path
}

async function topFor(io: Io, folder: string): Promise<string | null> {
  if (!tops.has(folder)) {
    if (tops.size >= MAX_FOLDERS) {
      tops.clear()
    }
    tops.set(folder, await topOf(io, folder))
  }
  return tops.get(folder) ?? null
}

// The folder a call runs in: a subagent's worktree, as the engine's note on
// the subagent names it, else the session's own
async function folderOf($: EngineInterface, io: Io, agent: string | null): Promise<string> {
  const m = model
  if (agent !== null && m !== null) {
    if (!agentFolders.has(agent)) {
      const dir = await transcriptDirFor(io, m.record.id)
      const found = dir === null ? undefined : parseAgentMeta(await io.read(agentMetaPath(dir, m.record.id, agent)))
      // With no note yet, the subagent's next call looks again
      if (found !== undefined) {
        if (agentFolders.size >= MAX_FOLDERS) {
          agentFolders.clear()
        }
        agentFolders.set(agent, found)
      }
    }
    const worktree = agentFolders.get(agent)
    if (typeof worktree === 'string') {
      return worktree
    }
  }
  return $.session.cwd()
}

// Reads the tree at `top` again and keeps the reading: what changed since the last one
function lookAt(io: Io, top: string): Promise<Booking> {
  return inLine(async () => {
    const before = trees.get(top)
    if (before === undefined) {
      return NOTHING
    }
    const { reading, booking } = await look(io, before)
    if (reading === null) {
      trees.delete(top)
    } else {
      remember(trees, reading)
    }
    return booking
  })
}

// Books lines on the model of the session they were counted for; true when the model changed
async function bookNow($: EngineInterface, id: string | undefined, booking: Booking): Promise<boolean> {
  const now = await $.clock.now()
  if (model === null || model.record.id !== id) {
    return false
  }
  const next = record.booked(model, now, booking)
  const changed = next !== model
  model = next
  return changed
}

// What a call is watched in: the trees it can change, and whether its folder
// is outside git, where the edit tools' own figures count
interface Watch {
  tops: string[]
  plain: boolean
}

// Before a call that can change files: the trees it runs in, each read first
// when it is new to the session
async function watch($: EngineInterface, agent: string | null, tool: string, input: ToolInput): Promise<Watch> {
  const io = ioFor($)
  const own = await topFor(io, await folderOf($, io, agent))
  const found = own === null ? [] : [own]
  const edit = editCounts(tool, input)
  if (edit !== null) {
    const top = await topFor(io, folderPart(edit.file))
    if (top !== null && !found.includes(top)) {
      found.push(top)
    }
  }
  for (const top of found) {
    await inLine(async () => {
      if (!trees.has(top)) {
        const reading = await readTree(io, top, null)
        if (reading !== null) {
          remember(trees, reading)
        }
      }
    })
  }
  return { tops: found, plain: own === null }
}

// After the call: each tree it could have changed is read again and what
// changed is booked; outside git, the edit tool's own figures are. Nothing
// for a call that was refused, or that the engine ran read-only.
async function book($: EngineInterface, watched: Watch, tool: string, input: ToolInput, result: unknown): Promise<void> {
  const { deny, isError, isReadOnly } = (typeof result === 'object' && result !== null ? result : {}) as {
    deny?: unknown
    isError?: unknown
    isReadOnly?: unknown
  }
  if (deny !== undefined || isReadOnly === true) {
    return
  }
  const io = ioFor($)
  const id = model?.record.id
  let changed = false
  for (const top of watched.tops) {
    changed = (await bookNow($, id, await lookAt(io, top))) || changed
  }
  const edit = watched.plain && isError !== true ? editCounts(tool, input) : null
  if (edit !== null) {
    changed = (await bookNow($, id, { added: edit.added, removed: edit.removed, files: [edit.file] })) || changed
  }
  if (changed) {
    await saveActivity($)
  }
}

// The session's own tree as a turn ends: what changed during the turn that no
// call's reading caught
async function lookOwnTree($: EngineInterface): Promise<void> {
  try {
    const io = ioFor($)
    const id = model?.record.id
    const top = await topFor(io, await $.session.cwd())
    if (top !== null) {
      await bookNow($, id, await lookAt(io, top))
    }
  } catch (error) {
    failure($, 'lines', error)
  }
}

// A turn starts from a fresh reading of the session's own tree, so what you
// changed between turns is not counted as the session's
async function rebaseOwnTree($: EngineInterface): Promise<void> {
  try {
    const io = ioFor($)
    const top = await topFor(io, await $.session.cwd())
    if (top === null) {
      return
    }
    await inLine(async () => {
      const reading = await readTree(io, top, trees.get(top) ?? null)
      if (reading === null) {
        trees.delete(top)
      } else {
        remember(trees, reading)
      }
    })
  } catch (error) {
    failure($, 'lines', error)
  }
}

// Puts the engine's title file's title on the model, and writes the record at
// once when the title changed
async function checkTitle($: EngineInterface): Promise<void> {
  const m = model
  if (m === null || checkingTitle) {
    return
  }
  checkingTitle = true
  try {
    const io = ioFor($)
    const id = m.record.id
    const dir = await transcriptDirFor(io, id)
    const found = dir === null ? undefined : await readTitleFile(io, dir, id)
    if (found === undefined || model === null || model.record.id !== id) {
      return
    }
    const next = record.fileTitled(model, found)
    const changed = next.record.title !== model.record.title
    model = next
    if (changed) {
      await save($)
    }
  } catch (error) {
    failure($, 'title', error)
  } finally {
    checkingTitle = false
  }
}

function startTitleChecks($: EngineInterface): void {
  titleTimer?.cancel()
  titleTimer = $.clock.every(TITLE_CHECK_MS, () => {
    void checkTitle($)
  })
}

// The heartbeat: a tuned-in session checks in; every session counts who is on air
async function beat($: EngineInterface): Promise<void> {
  try {
    const io = ioFor($)
    let outcome: { closed: boolean; onAir: number } | null = null
    await enqueue(async () => {
      if (model === null || tunedInAt === null) {
        return
      }
      outcome = await checkIn(io, model, tunedInAt)
      lastWriteAt = await $.clock.now()
    })
    if (outcome === null) {
      await refreshOnAir($)
      return
    }
    const done: { closed: boolean; onAir: number } = outcome
    if (done.closed) {
      tunedInAt = null
      stopTimers()
      await setState($, false, done.onAir)
    } else {
      await setState($, true, done.onAir)
    }
  } catch (error) {
    failure($, 'heartbeat', error)
  }
}

// The model for this session, built on the first need and again for a new session id
async function ensureSession($: EngineInterface): Promise<SessionModel> {
  const id = await $.session.id()
  if (model !== null && model.record.id === id) {
    return model
  }
  const root = await $.session.root()
  const repo = await $.session.repo()
  const project = baseName(repo?.root ?? root) || baseName(root)
  const now = await $.clock.now()
  let built = record.newModel(id, project, fallbackTitle(project, id), now)
  if (hookTitle !== null) {
    built = record.hookTitled(built, hookTitle)
  }
  model = built
  sessionRoot = root
  tunedInAt = null
  stopTimers()
  forgetTrees()
  heartbeat?.cancel()
  heartbeat = $.clock.every(HEARTBEAT_MS, () => {
    void beat($)
  })
  return built
}

async function startSession($: EngineInterface): Promise<void> {
  const built = await ensureSession($)
  const io = ioFor($)
  const home = await io.storeHome()
  if ((await read($, tuned)) === true) {
    // A reload: carry on from the session's own record
    const own = parseSessionRecord(
      await io.read(storePaths(home).session(built.record.id)).then((text) => (text === null ? null : (JSON.parse(text) as unknown))),
    )
    if (own === null) {
      await update($, tuned, () => false)
    } else {
      // The module before the reload kept the session's stories and hours on its record
      if (model !== null) {
        model = record.restored(model, own)
      }
      await checkTitle($)
      tunedInAt = own.tunedInAt
      await save($)
      await ensureStation(io, home)
      startTitleChecks($)
    }
  }
  await refreshOnAir($)
}

async function endSession($: EngineInterface): Promise<void> {
  heartbeat?.cancel()
  heartbeat = undefined
  stopTimers()
  const m = model
  const wasTuned = tunedInAt !== null
  model = null
  tunedInAt = null
  hookTitle = null
  transcriptDir = null
  forgetTrees()
  if (m !== null) {
    const io = ioFor($)
    const home = await io.storeHome()
    await enqueue(() => tuneOut(io, home, m.record.id).catch(() => undefined))
  }
  if (wasTuned) {
    await update($, tuned, () => false).catch(() => undefined)
  }
}

async function tuneInNow($: EngineInterface): Promise<TuneInResult['status']> {
  const built = await ensureSession($)
  // The record's first write carries the title the engine has now
  await checkTitle($)
  const m = model ?? built
  const io = ioFor($)
  let result = { status: 'cannot-start' } as TuneInResult
  await enqueue(async () => {
    result = await tuneIn(io, m)
  })
  if (result.status === 'on') {
    tunedInAt = result.tunedInAt
    lastWriteAt = result.tunedInAt
    startTitleChecks($)
    await setState($, true, await countOnAir(io, await io.storeHome(), await $.clock.now()))
    // The model may have moved on while the station started
    await save($)
  } else if (result.status === 'full') {
    await refreshOnAir($)
  }
  return result.status
}

async function tuneOutNow($: EngineInterface): Promise<void> {
  const m = await ensureSession($)
  const io = ioFor($)
  tunedInAt = null
  stopTimers()
  const home = await io.storeHome()
  await enqueue(() => tuneOut(io, home, m.record.id))
  await setState($, false, await countOnAir(io, home, await $.clock.now()))
}

// The band's tab and /pipcast do the same: tune in, or tune out
async function toggle($: EngineInterface): Promise<'in' | 'out' | 'full' | 'cannot-start'> {
  try {
    if ((await read($, tuned)) === true) {
      await tuneOutNow($)
      return 'out'
    }
    const status = await tuneInNow($)
    return status === 'on' ? 'in' : status
  } catch (error) {
    failure($, 'tuning', error)
    return 'cannot-start'
  }
}

async function pressed($: EngineInterface): Promise<void> {
  if ((await toggle($)) === 'cannot-start') {
    $.ui.toast(TOAST_CANNOT_START)
  }
}

async function onTitle($: EngineInterface, title: unknown): Promise<void> {
  if (typeof title !== 'string' || title.trim() === '') {
    return
  }
  hookTitle = title.trim()
  if (model !== null) {
    const next = record.hookTitled(model, hookTitle)
    const changed = next.record.title !== model.record.title
    model = next
    if (changed) {
      await save($)
    }
  }
}

async function onTurnStart($: EngineInterface, turnId: string): Promise<void> {
  await ensureSession($)
  if (model === null) {
    return
  }
  model = record.turnStarted(model, await $.clock.now(), turnId)
  await save($)
  await rebaseOwnTree($)
}

async function onToolBefore($: EngineInterface, tool: string, input: ToolInput): Promise<void> {
  if (model === null) {
    return
  }
  const now = await $.clock.now()
  const text = activity(tool, input, sessionRoot)
  if (text !== null) {
    model = record.activity(model, now, text)
  }
  const asked = tool === 'AskUserQuestion' ? question(input) : null
  if (asked !== null) {
    model = record.askedQuestion(model, now, asked)
    await save($)
  } else if (text !== null) {
    await saveActivity($)
  }
}

// A tool call returned: the loop that made it has moved on, so if the session was waiting on it, it works again
async function onToolAfter($: EngineInterface, agent: string | null): Promise<void> {
  if (model === null) {
    return
  }
  const next = record.resumed(model, await $.clock.now(), agent)
  if (next !== model) {
    model = next
    await save($)
  }
}

async function onPermission($: EngineInterface, tool: string, input: unknown, agent: string | null): Promise<void> {
  if (model === null) {
    return
  }
  const described = permission(tool, typeof input === 'object' && input !== null ? (input as ToolInput) : {}, sessionRoot)
  model = record.askedPermission(model, await $.clock.now(), described.command, described.quote, agent)
  await save($)
}

async function onStop($: EngineInterface, e: { last_assistant_message?: string; background_tasks?: unknown[]; session_crons?: unknown[] }): Promise<void> {
  if (model === null) {
    return
  }
  const background = willWake(e)
  await lookOwnTree($)
  if (model === null) {
    return
  }
  model = record.finished(model, await $.clock.now(), {
    lastWords: lastWords(e.last_assistant_message ?? ''),
    background,
  })
  await save($)
}

async function onFailure($: EngineInterface, kind: string): Promise<void> {
  if (model === null) {
    return
  }
  await lookOwnTree($)
  if (model === null) {
    return
  }
  model = record.failed(model, await $.clock.now(), kind)
  await save($)
}

async function onComplete($: EngineInterface, isAborted: boolean, reason: string): Promise<void> {
  if (model === null || model.turn.ended) {
    return
  }
  await lookOwnTree($)
  if (model === null || model.turn.ended) {
    return
  }
  // No Stop or StopFailure ended this turn for the mod. An API error is an
  // error story; an interrupt, or a Stop that never reached the mod, leaves the
  // session ready with no story: either way it is not working any more.
  const now = await $.clock.now()
  model = reason === 'error' && !isAborted ? record.failed(model, now, 'unknown') : record.aborted(model, now)
  await save($)
}

export const register: Register = (on) => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({ name: COMMAND_NAME, description: COMMAND_DESCRIPTION })
      await startSession($)
    } catch (error) {
      failure($, 'session.start', error)
    }
    return next(e)
  })

  // /clear and /resume end the session too, and reset $.state
  on('session.end', async ($, e, next) => {
    try {
      await endSession($)
    } catch (error) {
      failure($, 'session.end', error)
    }
    return next(e)
  })

  on('command.run', { command: COMMAND_NAME }, async ($) => {
    const done = await toggle($)
    switch (done) {
      case 'in':
        return { text: REPLY.tunedIn }
      case 'out':
        return { text: REPLY.tunedOut }
      case 'full':
        return { text: REPLY.full }
      default:
        return { text: REPLY.cannotStart }
    }
  })

  on('turn.start', async ($, e, next) => {
    try {
      await onTurnStart($, e.turnId)
    } catch (error) {
      failure($, 'turn.start', error)
    }
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    // A subagent's calls make no activity or questions here, and its permission
    // is answered when its own call returns. The lines it changes count as the
    // main loop's do.
    const agent = typeof e.agentId === 'string' && e.agentId !== '' ? e.agentId : null
    const input = toolInput(e)
    if (agent === null) {
      try {
        await onToolBefore($, e.tool, input)
      } catch (error) {
        failure($, 'tool.call', error)
      }
    }
    let watched: Watch | null = null
    if (FILE_TOOLS.includes(e.tool)) {
      try {
        watched = await watch($, agent, e.tool, input)
      } catch (error) {
        failure($, 'lines', error)
      }
    }
    const result = await next(e)
    try {
      await onToolAfter($, agent)
    } catch (error) {
      failure($, 'tool.call', error)
    }
    if (watched !== null) {
      try {
        await book($, watched, e.tool, input, result)
      } catch (error) {
        failure($, 'lines', error)
      }
    }
    return result
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      noteTranscript(e)
      const agent: unknown = (e as { agent_id?: unknown }).agent_id
      await onPermission($, e.tool_name, e.tool_input, typeof agent === 'string' && agent !== '' ? agent : null)
    } catch (error) {
      failure($, 'PermissionRequest', error)
    }
    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    try {
      noteTranscript(e)
      await onStop($, e)
    } catch (error) {
      failure($, 'Stop', error)
    }
    return next(e)
  })

  on('classic.StopFailure', async ($, e, next) => {
    try {
      noteTranscript(e)
      await onFailure($, String(e.error))
    } catch (error) {
      failure($, 'StopFailure', error)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }
    try {
      await onComplete($, e.isAborted, e.reason)
    } catch (error) {
      failure($, 'turn.complete', error)
    }
    return next(e)
  })

  on('classic.SessionStart', async ($, e, next) => {
    try {
      noteTranscript(e)
      await onTitle($, e.session_title)
    } catch (error) {
      failure($, 'SessionStart', error)
    }
    return next(e)
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    try {
      noteTranscript(e)
      await onTitle($, e.session_title)
    } catch (error) {
      failure($, 'UserPromptSubmit', error)
    }
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // The band is one tree for every mod: each adds its own line and passes the
    // lines beneath through as they came. Ours goes under what another mod drew;
    // we never open that up or set it in our row.
    const beneath = await next(e)
    if (e.surface !== 'desktop' || e.props.hasSurvey) {
      return beneath
    }
    const { Box, Button, Svg } = $.ui.resolve(e)
    const view = band({ tuned: (await read($, tuned)) === true, onAir: (await read($, onAir)) ?? 0 })
    const ownLine = (
      <Box alignItems="center" columnGap={1}>
        <Svg source={view.chip.svg} alt={view.chip.alt} width={view.chip.width} height={BAND_HEIGHT} />
        <Box>
          <Svg source={view.tab.svg} alt={view.tab.alt} width={view.tab.width} height={BAND_HEIGHT} />
          {view.kind !== 'off' && (
            <Box position="absolute" top={0} bottom={0} left={-REACH} right={-REACH} alignItems="center" justifyContent="center">
              <Button
                key={view.kind === 'in' ? 'tune-in' : 'tune-out'}
                label={blankLabel(view.tab.width)}
                plain
                onPress={() => pressed($)}
              />
            </Box>
          )}
        </Box>
      </Box>
    )
    if (!hasContent(beneath)) {
      return ownLine
    }
    return (
      <Box flexDirection="column" rowGap="md">
        {beneath}
        {ownLine}
      </Box>
    )
  })
}
