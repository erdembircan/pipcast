#!/usr/bin/env node
// Cues a segment in the development build of the station: BREAKING NEWS, or
// the report on the next hour, from the sessions on air or with words and
// figures of your own. scripts/live.sh story, hour and cue run it, from the
// live checkout, whose development build is the only one that takes a cue.
//
//   story [<kind>] [options]   BREAKING NEWS: needs-input, ready (the
//                              default), complete or error
//   hour [--sessions <n>] [--quiet]
//                              the report on the next hour
//   cue <file>|-               what a JSON file holds, or the input
//
// A cue is a JSON file in the store's dev folder, written through a temporary
// file, which the development build's station takes, hands to its page and
// deletes. packages/dev/src/cue.ts says what one holds, and this script checks
// a cue with it, with Node itself, before it writes one. PIPCAST_HOME names
// another store, as for the station, and PIPCAST_DEV_WAIT_MS how long to wait
// for the station to take a cue, 3000 by default.

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const USAGE = `usage: scripts/live.sh story [<kind>] [--title <text>] [--project <text>] [--session <id or title>]
                             [--command <text>] [--quote <text>] [--added <n>] [--removed <n>]
                             [--files <n>] [--minutes <n>]
       scripts/live.sh hour [--sessions <1 to 7>] [--quiet]
       scripts/live.sh cue <file>|-`

function fail(message) {
  process.stderr.write(`${message}\n`)
  process.exit(1)
}

// Node runs the repository's TypeScript itself from 22.18 and 23.6 on
const [major = 0, minor = 0] = process.versions.node.split('.').map(Number)
if (!(major > 23 || (major === 23 && minor >= 6) || (major === 22 && minor >= 18))) {
  fail(`Cues are checked with the repository's TypeScript, which Node runs itself from 22.18 on. This is Node ${process.versions.node}.`)
}

const { checkCue } = await import('../packages/dev/src/cue.ts')
const { defaultHome, storePaths } = await import('../packages/contract/src/paths.ts')
const { isStationAlive, onAir, parseSessionRecord, parseStationStatus } = await import('../packages/contract/src/validate.ts')

const paths = storePaths(process.env.PIPCAST_HOME || defaultHome(homedir()))
const cues = `${paths.root}/dev`
const waitMs = Number(process.env.PIPCAST_DEV_WAIT_MS ?? '3000')

const KINDS = { 'needs-input': 'needs your input', ready: 'ready for review', complete: 'work complete', error: 'stopped on an error' }
const STORY_OPTIONS = ['title', 'project', 'session', 'command', 'quote', 'added', 'removed', 'files', 'minutes']
// What a story says or shows, besides its session
const CONTENT = ['command', 'quote', 'added', 'removed', 'files', 'minutes']
const NUMBERS = ['added', 'removed', 'files', 'minutes']
// The kinds of story an option is for, where it is not for all of them
const FOR = { command: ['needs-input'], quote: ['needs-input', 'complete', 'error'], added: ['ready'], removed: ['ready'], files: ['ready'] }

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

// "a, b and c"
function list(words, last) {
  return words.length === 1 ? words[0] : `${words.slice(0, -1).join(', ')} ${last} ${words[words.length - 1]}`
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function names(folder) {
  try {
    return readdirSync(folder)
  } catch {
    return []
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

// The station on air, with whether it takes cues, or null
function station() {
  const status = parseStationStatus(readJson(paths.station))
  if (status === null || !isStationAlive(status, Date.now()) || !alive(status.pid)) {
    return null
  }
  return { pid: status.pid, dev: status.version.endsWith('+dev') }
}

// The sessions on air, in the order on air
function sessionsOnAir() {
  const records = names(paths.sessions)
    .filter((name) => name.endsWith('.json'))
    .map((name) => parseSessionRecord(readJson(join(paths.sessions, name))))
    .filter((record) => record !== null)
  return onAir(records, Date.now())
}

// --name value pairs, and the flags named; a repeated option keeps its last value
function options(args, allowed, flags = []) {
  const values = {}
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const name = arg.startsWith('--') ? arg.slice(2) : ''
    if (flags.includes(name)) {
      values[name] = true
      continue
    }
    if (!allowed.includes(name)) {
      fail(`Unknown option ${arg}.\n${USAGE}`)
    }
    if (index + 1 >= args.length) {
      fail(`${arg} needs a value.`)
    }
    values[name] = args[index + 1]
    index += 1
  }
  return values
}

// The session on air an option names: its id, or a piece of its title
function findSession(value) {
  const sessions = sessionsOnAir()
  const exact = sessions.find((session) => session.id === value)
  if (exact !== undefined) {
    return exact
  }
  const matches = sessions.filter((session) => session.title.toLowerCase().includes(value.toLowerCase()))
  if (matches.length === 1) {
    return matches[0]
  }
  if (matches.length > 1) {
    fail(`"${value}" matches ${matches.length} sessions on air: ${matches.map((session) => session.title).join('; ')}. Give more of the title, or the session's id.`)
  }
  if (sessions.length === 0) {
    fail(`No session on air matches "${value}": none is on air.`)
  }
  fail(`No session on air matches "${value}". On air: ${sessions.map((session) => `${session.title} (${session.id})`).join('; ')}.`)
}

// A session's id, title and project, as a cue's story carries them
function named(session) {
  return {
    session: session.id,
    ...(session.title === '' ? {} : { title: session.title }),
    ...(session.project === '' ? {} : { project: session.project }),
  }
}

// A session's own newest story, to air again as it was
function again(session) {
  const story = session.stories[session.stories.length - 1]
  if (story === undefined) {
    fail(`${session.title} has no story to air again. Name a kind, as in scripts/live.sh story ready --session ${session.id}.`)
  }
  const input = { kind: story.kind, ...named(session) }
  if (story.kind === 'needs-input' && story.command) {
    input.command = story.command
  }
  if (story.kind !== 'ready' && story.quote) {
    input.quote = story.quote
  }
  if (story.kind === 'ready') {
    input.added = story.added ?? 0
    input.removed = story.removed ?? 0
    input.files = story.files ?? 0
  }
  if (story.kind === 'needs-input') {
    // How long it has waited so far, so it airs waiting as long
    input.minutes = Math.min(9_999, Math.max(0, Math.floor((Date.now() - story.at) / 60_000)))
  }
  if (story.kind !== 'needs-input' && story.durationMs !== undefined) {
    input.minutes = Math.round(story.durationMs / 60_000)
  }
  return input
}

// Writes a cue into the store's dev folder through a temporary file, named by
// when it was written, for the development build's station to take
function send(cue, what) {
  const now = station()
  if (now === null) {
    fail('No station is on air, so nothing would take the cue. Tune a session in with /pipcast.')
  }
  if (!now.dev) {
    fail("The station on air takes no cues: it isn't the live checkout's development build. scripts/live.sh says what the app runs.")
  }
  const name = `${Date.now()}-${randomBytes(2).toString('hex')}`
  const full = { ...cue, id: name }
  const checked = checkCue(full)
  if ('problem' in checked) {
    fail(`That cue would be dropped: ${checked.problem}.`)
  }
  mkdirSync(cues, { recursive: true, mode: 0o700 })
  const path = join(cues, `${name}.json`)
  writeFileSync(`${path}.tmp`, `${JSON.stringify(full)}\n`)
  renameSync(`${path}.tmp`, path)
  console.log(`Cued ${what}.`)
  if (waitMs <= 0) {
    return
  }
  for (let waited = 0; waited < waitMs && existsSync(path); waited += 100) {
    sleep(100)
  }
  console.log(
    existsSync(path)
      ? "The station hasn't taken it yet: scripts/live.sh says whether the development build is still on air."
      : 'It airs as soon as the window shows and nothing else is on air, and waits 5 min at most.',
  )
}

function story(args) {
  let kind
  if (args[0] !== undefined && !args[0].startsWith('--')) {
    kind = args[0]
    if (!(kind in KINDS)) {
      fail('The kind of story is needs-input, ready, complete or error.')
    }
    args = args.slice(1)
  }
  const given = options(args, STORY_OPTIONS)
  if (given.session !== undefined && (given.title !== undefined || given.project !== undefined)) {
    fail('--session takes the title and project of the session it names: leave out --title and --project.')
  }
  let input
  if (given.session !== undefined && kind === undefined && !CONTENT.some((name) => given[name] !== undefined)) {
    input = again(findSession(given.session))
  } else {
    kind ??= 'ready'
    for (const [name, kinds] of Object.entries(FOR)) {
      if (given[name] !== undefined && !kinds.includes(kind)) {
        fail(`--${name} is for ${list(kinds, 'and')} stories.`)
      }
    }
    input = { kind }
    for (const name of STORY_OPTIONS) {
      if (name === 'session' || given[name] === undefined) {
        continue
      }
      if (NUMBERS.includes(name)) {
        if (!/^\d+$/.test(given[name])) {
          fail(`--${name} takes a whole number.`)
        }
        input[name] = Number(given[name])
      } else {
        input[name] = given[name]
      }
    }
    if (given.session !== undefined) {
      Object.assign(input, named(findSession(given.session)))
    }
  }
  const on = input.session === undefined ? '' : `, on ${input.title ?? input.session}`
  send({ segment: 'story', stories: [input] }, `BREAKING NEWS, ${KINDS[input.kind]}${on}`)
}

function hour(args) {
  const given = options(args, ['sessions'], ['quiet'])
  const cue = { segment: 'hour' }
  if (given.sessions !== undefined) {
    if (!/^\d+$/.test(given.sessions)) {
      fail('--sessions takes a whole number.')
    }
    cue.samples = Number(given.sessions)
  }
  if (given.quiet === true) {
    cue.samples ??= 4
    cue.quiet = true
  }
  const from =
    cue.samples === undefined ? 'the sessions on air' : cue.samples === 1 ? '1 sample session' : `${cue.samples} sample sessions`
  send(cue, `the report on the next hour${cue.quiet ? ', a quiet one,' : ','} from ${from}`)
}

function cueFile(args) {
  if (args.length !== 1) {
    fail(`scripts/live.sh cue takes one file, or - for its input.\n${USAGE}`)
  }
  let text
  try {
    text = readFileSync(args[0] === '-' ? 0 : args[0], 'utf8')
  } catch {
    fail(`Cannot read ${args[0]}.`)
  }
  let value
  try {
    value = JSON.parse(text)
  } catch {
    fail(`${args[0] === '-' ? 'The input' : args[0]} is not JSON.`)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('A cue is a JSON object.')
  }
  send(value, value.segment === 'hour' ? 'the report on the next hour' : 'BREAKING NEWS')
}

const [command, ...rest] = process.argv.slice(2)
switch (command) {
  case 'story':
    story(rest)
    break
  case 'hour':
    hour(rest)
    break
  case 'cue':
    cueFile(rest)
    break
  case 'help':
  case '--help':
  case '-h':
    console.log(USAGE)
    break
  default:
    fail(`${command === undefined ? 'Say what to cue.' : `Unknown command ${command}.`}\n${USAGE}`)
}
