import type { On } from 'claude-code'
import { mock } from 'claude-code/testing'

import type { SessionRecord } from '../src/contract/types.ts'
import { parseSessionRecord } from '../src/contract/validate.ts'

export const ID = '8253106f-ce3e-4af6-824a-21845bad3955'
export const HOME = '/pip/home'
export const ROOT = '/work/proj'
export const STATION = '/pip/stand-in-station'
export const T0 = 1_792_600_000_000
export const SESSIONS = `${HOME}/sessions`
export const RECORD = `${SESSIONS}/${ID}.json`

export const BAND = {
  plugin: 'pipcast',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 120,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

export const RUN = {
  command: 'pipcast',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: false, columns: 120 },
} as const

export interface WorldOptions {
  env?: Record<string, string>
  transcript?: string
  launchExit?: number
  launchOut?: string
  hasRepo?: boolean
  hasOtherBand?: boolean
}

// The world beneath the mod: a session with an id, an in-memory file system
// for the store, a station stand-in that answers `launch`, and git.
export function world(on: On, options: WorldOptions = {}) {
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { HOME: '/Users/me', PIPCAST_HOME: HOME, PIPCAST_STATION_BIN: STATION, ...options.env })

  const files = new Map<string, string>()
  const ran: (readonly string[])[] = []
  const writes: string[] = []
  const launched: (readonly string[])[] = []
  const toasts: string[] = []
  const git = { numstat: '', untracked: [] as string[], fails: false }
  const launch = { exit: options.launchExit ?? 0, out: options.launchOut ?? 'started 4242' }

  const done = (exitCode: number, stdout = '', stderr = '') => ({
    value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
  })

  on('session.id', () => ({ value: ID }))
  on('session.root', () => ({ value: ROOT }))
  on('session.repo', () => ({
    value: options.hasRepo === false ? null : { root: ROOT, remote: null, internal: false, name: null },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('command.register', (_, e) => ({ value: { command: e.name } }))
  on('turn.start', (_, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.toast', (_, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('classic.PermissionRequest', () => ({}))
  on('classic.Stop', () => ({}))
  on('classic.StopFailure', () => ({}))
  on('classic.SessionStart', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  // What the record said when a tool call reached the engine, below the mod
  const atTool: (string | undefined)[] = []
  on('tool.call', () => {
    const text = files.get(RECORD)
    atTool.push(text === undefined ? undefined : (JSON.parse(text) as SessionRecord).state)
    return { result: { stdout: '', stderr: '', interrupted: false }, text: '' } as never
  })

  on('fs.read', (_, e) => {
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', (_, e) => {
    writes.push(e.path)
    files.set(e.path, e.text)
    return { value: undefined }
  })
  on('fs.exists', (_, e) => ({
    value: [...files.keys()].some((path) => path === e.path || path.startsWith(`${e.path}/`)),
  }))
  on('fs.list', (_, e) => {
    const prefix = `${e.path}/`
    const names = [...files.keys()].filter((path) => path.startsWith(prefix) && !path.slice(prefix.length).includes('/'))
    return names.length === 0
      ? { deny: 'ENOENT' }
      : { value: names.map((path) => ({ name: path.slice(prefix.length), kind: 'file' as const, size: 0, mtimeMs: 0, isLink: false })) }
  })

  on('process.run', (_, e) => {
    ran.push(e.argv)
    const [program, ...args] = e.argv
    switch (program) {
      case '/bin/mv': {
        const [from, to] = args.filter((arg) => arg !== '-f')
        const text = from === undefined ? undefined : files.get(from)
        if (from === undefined || to === undefined || text === undefined) {
          return done(1, '', 'no such file')
        }
        files.delete(from)
        files.set(to, text)
        return done(0)
      }
      case '/bin/rm':
        for (const path of args.filter((arg) => arg !== '-f')) {
          files.delete(path)
        }
        return done(0)
      case STATION:
        launched.push(args)
        return done(launch.exit, launch.out)
      case '/bin/sh':
        return options.transcript === undefined ? done(1) : done(0, options.transcript)
      case '/usr/bin/git':
        if (git.fails) {
          return done(128, '', 'not a git repository')
        }
        return args[0] === 'diff' ? done(0, git.numstat) : done(0, git.untracked.join('\0'))
      default:
        return done(0)
    }
  })

  return {
    clock,
    files,
    ran,
    writes,
    launched,
    launch,
    toasts,
    atTool,
    git,
    // The session's own record, as the store has it
    record(): SessionRecord | null {
      const text = files.get(RECORD)
      return text === undefined ? null : parseSessionRecord(JSON.parse(text) as unknown)
    },
    // Another session's record, checked in at the clock's now
    other(id: string, tunedInAt: number, checkedInAt = clock.now()): void {
      const record: SessionRecord = {
        v: 1,
        id,
        title: id,
        project: 'other',
        state: 'working',
        stateAt: tunedInAt,
        tunedInAt,
        checkedInAt,
        stories: [],
        activity: [],
        hours: [],
      }
      files.set(`${SESSIONS}/${id}.json`, JSON.stringify(record))
    },
  }
}
