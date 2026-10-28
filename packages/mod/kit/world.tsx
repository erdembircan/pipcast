import type { On, PluginOptions, RenderSurface } from 'claude-code'
import { mock } from 'claude-code/testing'

import type { SessionRecord, SharedOptions } from '../../contract/src/types.ts'
import { parseSessionRecord, parseSharedOptions } from '../../contract/src/validate.ts'

export const ID = '8253106f-ce3e-4af6-824a-21845bad3955'
export const HOME = '/pip/home'
export const ROOT = '/work/proj'
export const STATION = '/pip/stand-in-station'
// The Claude Code binary, as the parent of the ps the mod tags
export const ENGINE = '/pip/engine/claude'
export const T0 = 1_792_600_000_000
export const SESSIONS = `${HOME}/sessions`
export const RECORD = `${SESSIONS}/${ID}.json`
// What the station reads of the plugin's options
export const OPTIONS_FILE = `${HOME}/options.json`
// Where the engine keeps the session's transcript and its title file
export const PROJECT_DIR = '/Users/me/.claude/projects/-work-proj'
export const TRANSCRIPT = `${PROJECT_DIR}/${ID}.jsonl`
export const TITLE_FILE = `${PROJECT_DIR}/${ID}/custom-title.json`

// A subagent's worktree, inside the session's checkout as the engine puts it
export const WORKTREE = `${ROOT}/.claude/worktrees/agent-a1`

// Where the engine writes each background command's output, and its own pid
export const TASKS = `/private/tmp/claude-501/-work-proj/${ID}/tasks`
export const ENGINE_PID = 4000
// The ps the mod tags to find its parent, which is the engine
export const PS_PID = 4242

// A git working tree as the fake git sees it: its commit, what `diff-index`
// prints, and its untracked files
export interface FakeTree {
  head: string
  numstat: string
  untracked: string[]
}

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
  // Where `find` finds the session's transcript; unset, it finds nothing
  transcriptDir?: string
  launchExit?: number
  launchOut?: string
  hasRepo?: boolean
  // What the band holds beneath ours: another mod's line, as one plain Box or a
  // row like usage-band's; nothing, where the engine answers with its own
  // drawing, as it does when no other mod draws there; or an empty Box. Unset,
  // one plain Box
  otherBand?: 'plain' | 'row' | 'nothing' | 'empty'
  // The plugin's options, as settings hold them; unset, the manifest's defaults
  settings?: PluginOptions
  // What shows the session when it starts; unset, nothing, as in a headless run
  surfaces?: RenderSurface[]
  // What the engine's path reads as; null when it cannot be told
  engine?: string | null
  // What `claude plugin list --json` prints; unset, no plugins
  plugins?: string
  // `claude plugin configure` fails
  configureFails?: boolean
  // The plugin's options as Claude Code has saved them, as `configure --json`
  // prints them; unset, the manifest's defaults, which it prints for an option
  // nothing has saved
  saved?: Record<string, string>
  // The account's usage limits as the engine reports them; unset, none, as for an account with no plan
  limits?: { kind: string; percentUsed: number; resetsAt?: string }[]
}

// The world beneath the mod: a session with an id, an in-memory file system
// for the store, a station stand-in that answers `launch`, and git.
export function world(on: On, options: WorldOptions = {}) {
  const clock = mock.clock(on, { now: T0 })
  mock.env(on, { HOME: '/Users/me', PIPCAST_HOME: HOME, PIPCAST_STATION_BIN: STATION, ...options.env })

  const files = new Map<string, string>()
  // Each file's last write, by the kit's clock, as the engine's fs.stat reports it
  const mtimes = new Map<string, number>()
  const ran: (readonly string[])[] = []
  const writes: string[] = []
  // Every path read, and the title of every record written, in order
  const reads: string[] = []
  const written: string[] = []
  const launched: (readonly string[])[] = []
  const toasts: string[] = []
  // What shows the session, as $.session.surfaces() reads it; an attach adds its surface
  const surfaces: RenderSurface[] = [...(options.surfaces ?? [])]
  // The engine the mod finds, the options Claude Code has saved, and every
  // command the mod gives the engine
  const engine = options.env?.CLAUDE_CODE_EXECPATH ?? (options.engine === null ? null : (options.engine ?? ENGINE))
  const saved: Record<string, string> = { autoTuneIn: 'true', transparentWindow: 'false', ...options.saved }
  const engineCalls: { argv: readonly string[]; stdin: string | undefined }[] = []
  // What the engine reports of the account's usage limits when asked; a test can change it as it goes
  const engineLimits = { reported: [...(options.limits ?? [])] }
  // The session's own tree at ROOT, and other trees by their top folder
  const git = {
    head: 'c0ffee1',
    numstat: '',
    untracked: [] as string[],
    fails: false,
    worktrees: new Map<string, FakeTree>(),
  }
  const launch = { exit: options.launchExit ?? 0, out: options.launchOut ?? 'started 4242' }
  // The Mac's processes as `ps` and `lsof` see them: each one's parent and
  // process group, the files they write to, the ones that listen on a TCP
  // port, and what each output file holds. `fails`: neither program answers.
  const procs = {
    table: [
      { pid: 1, ppid: 0, pgid: 1 },
      { pid: ENGINE_PID, ppid: 1, pgid: ENGINE_PID },
    ] as { pid: number; ppid: number; pgid: number }[],
    writing: [{ pid: ENGINE_PID, name: 'pipe' }] as { pid: number; name: string }[],
    listening: new Set<number>(),
    outputs: new Map<string, string>(),
    fails: false,
    next: 5000,
  }

  const done = (exitCode: number, stdout = '', stderr = '') => ({
    value: { exitCode, stdout, stderr, isStdoutTruncated: false, isStderrTruncated: false },
  })

  // The engine's own plugin commands, as Claude Code answers them
  const engineRun = (args: string[], stdin: string | undefined) => {
    engineCalls.push({ argv: [engine ?? '', ...args], stdin })
    const rest = args[0] === '--plugin-dir' ? args.slice(2) : args
    if (rest[0] !== 'plugin') {
      return done(0)
    }
    if (rest[1] === 'list') {
      return done(0, options.plugins ?? '[]')
    }
    if (rest[1] !== 'configure') {
      return done(0)
    }
    if (options.configureFails === true) {
      return done(1, '', 'configure failed')
    }
    const id = rest.at(-1) ?? ''
    if (rest.includes('--values-stdin')) {
      const values = JSON.parse(stdin ?? '{}') as Record<string, string>
      Object.assign(saved, values)
      return done(0, JSON.stringify({ pluginId: id, saved: Object.keys(values), unconfigured: [] }))
    }
    return done(0, JSON.stringify({ pluginId: id, inputs: { ...saved }, configured: [], unconfigured: [] }))
  }

  on('session.id', () => ({ value: ID }))
  on('session.root', () => ({ value: ROOT }))
  on('session.cwd', () => ({ value: ROOT }))
  on('session.repo', () => ({
    value: options.hasRepo === false ? null : { root: ROOT, remote: null, internal: false, name: null },
  }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('session.surfaces', () => ({ value: [...surfaces] }))
  on('session.usage', () => ({
    value: { startedAt: T0, context: { window: 200_000 }, rateLimits: [...engineLimits.reported] },
  }))
  on('session.measure', (_, e) => ({ changed: e.changed }))
  on('session.attach', (_, e) => {
    if (!surfaces.includes(e.surface)) {
      surfaces.push(e.surface)
    }
    return { clientId: e.clientId }
  })
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
  on('tool.call', (_, e) => {
    const text = files.get(RECORD)
    atTool.push(text === undefined ? undefined : (JSON.parse(text) as SessionRecord).state)
    const command = (e as { command?: unknown }).command
    const readOnly = typeof command === 'string' && command.startsWith('git log')
    return { result: { stdout: '', stderr: '', interrupted: false }, text: '', ...(readOnly ? { isReadOnly: true } : {}) } as never
  })

  on('fs.read', (_, e) => {
    reads.push(e.path)
    const text = files.get(e.path)
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('fs.write', (_, e) => {
    writes.push(e.path)
    files.set(e.path, e.text)
    mtimes.set(e.path, clock.now())
    if (e.path === `${RECORD}.tmp`) {
      written.push((JSON.parse(e.text) as SessionRecord).title)
    }
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
      : { value: names.map((path) => ({ name: path.slice(prefix.length), kind: 'file' as const, size: 0, mtimeMs: mtimes.get(path) ?? clock.now(), isLink: false })) }
  })
  on('fs.stat', (_, e) => {
    const text = files.get(e.path)
    return text === undefined
      ? { deny: 'ENOENT' }
      : { value: { kind: 'file' as const, size: text.length, mtimeMs: mtimes.get(e.path) ?? clock.now(), isLink: false } }
  })

  // Which tree holds a folder: the longest worktree that is or holds it, else the session's own, when the session has a repository
  const treeAt = (folder: string): { top: string; tree: FakeTree } | null => {
    let best: string | null = null
    for (const top of git.worktrees.keys()) {
      if ((folder === top || folder.startsWith(`${top}/`)) && (best === null || top.length > best.length)) {
        best = top
      }
    }
    const found = best === null ? undefined : git.worktrees.get(best)
    if (best !== null && found !== undefined) {
      return { top: best, tree: found }
    }
    if (options.hasRepo !== false && (folder === ROOT || folder.startsWith(`${ROOT}/`))) {
      return { top: ROOT, tree: { head: git.head, numstat: git.numstat, untracked: git.untracked } }
    }
    return null
  }
  const gitRun = (args: string[], folder: string) => {
    if (git.fails) {
      return done(128, '', 'not a git repository')
    }
    const at = treeAt(folder)
    if (at === null) {
      return done(128, '', 'not a git repository')
    }
    switch (args[0]) {
      case 'rev-parse':
        return args[1] === '--show-toplevel' ? done(0, `${at.top}\n`) : done(0, `${at.tree.head}\n`)
      case 'diff-index':
        return done(0, at.tree.numstat)
      case 'ls-files':
        return done(0, at.tree.untracked.join('\0'))
      default:
        return done(0)
    }
  }

  on('process.run', (_, e) => {
    ran.push(e.argv)
    const [program, ...args] = e.argv
    if (engine !== null && program === engine) {
      return engineRun(args, (e as { init?: { stdin?: string } }).init?.stdin)
    }
    switch (program) {
      case '/bin/mv': {
        const [from, to] = args.filter((arg) => arg !== '-f')
        const text = from === undefined ? undefined : files.get(from)
        if (from === undefined || to === undefined || text === undefined) {
          return done(1, '', 'no such file')
        }
        mtimes.set(to, mtimes.get(from) ?? clock.now())
        mtimes.delete(from)
        files.delete(from)
        files.set(to, text)
        return done(0)
      }
      case '/bin/rm':
        for (const path of args.filter((arg) => arg !== '-f')) {
          files.delete(path)
          mtimes.delete(path)
        }
        return done(0)
      case STATION:
        launched.push(args)
        return done(launch.exit, launch.out)
      case '/usr/bin/find':
        return done(0, options.transcriptDir === undefined ? '' : `${options.transcriptDir}/${ID}.jsonl\n`)
      case '/usr/bin/git':
        return gitRun(args, (e as { init?: { cwd?: string } }).init?.cwd ?? ROOT)
      case '/bin/ps': {
        // The engine, as the parent of the ps the mod tagged, and its program
        const tagged = args.find((arg) => arg.startsWith('command='))
        if (tagged !== undefined) {
          return engine === null
            ? done(1, '', 'ps: no')
            : done(0, [`${' '.repeat(12)}${tagged.slice('command='.length)}`, `${PS_PID} ${ENGINE_PID} /bin/ps ${args.join(' ')}`, `${ENGINE_PID} 1 ${engine}`, ''].join('\n'))
        }
        if (args.includes('comm=')) {
          return engine !== null && args[args.indexOf('-p') + 1] === String(ENGINE_PID) ? done(0, `${engine}\n`) : done(1)
        }
        return procs.fails ? done(1, '', 'ps: no') : done(0, procs.table.map((p) => `${p.pid} ${p.ppid} ${p.pgid}`).join('\n'))
      }
      case '/usr/sbin/lsof': {
        if (procs.fails) {
          return done(1, '', 'lsof: no')
        }
        if (args.includes('-iTCP')) {
          const asked = (args[args.indexOf('-p') + 1] ?? '').split(',').map(Number)
          const found = asked.filter((pid) => procs.listening.has(pid))
          return done(found.length === 0 ? 1 : 0, found.map((pid) => `p${pid}`).join('\n'))
        }
        return done(0, procs.writing.flatMap((file) => [`p${file.pid}`, 'f1', `n${file.name}`]).join('\n'))
      }
      case '/usr/bin/head':
      case '/usr/bin/tail':
        return done(0, procs.outputs.get(args.at(-1) ?? '') ?? '')
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
    surfaces,
    engineCalls,
    engineLimits,
    saved,
    atTool,
    reads,
    written,
    git,
    procs,
    // A command left running in the background, as the engine runs one: a
    // shell leading its own process group, writing to `<task id>.output`, and
    // the program it started. `listens`: the program listens on a TCP port;
    // `output`: what the command has printed. `listen()` and `say()` change
    // that later; `end()` takes both processes away.
    task(id: string, options: { listens?: boolean; output?: string } = {}) {
      const shell = procs.next
      const program = shell + 1
      procs.next += 10
      const output = `${TASKS}/${id}.output`
      procs.table.push({ pid: shell, ppid: ENGINE_PID, pgid: shell }, { pid: program, ppid: shell, pgid: shell })
      procs.writing.push({ pid: shell, name: output }, { pid: program, name: output })
      procs.outputs.set(output, options.output ?? '')
      if (options.listens === true) {
        procs.listening.add(program)
      }
      return {
        listen: () => procs.listening.add(program),
        say: (text: string) => procs.outputs.set(output, text),
        end: () => {
          procs.table = procs.table.filter((p) => p.pid !== shell && p.pid !== program)
          procs.writing = procs.writing.filter((file) => file.pid !== shell && file.pid !== program)
        },
      }
    },
    // A subagent in a worktree of its own, as the engine's note beside the
    // transcript names it; its tree starts clean
    subagent(agentId: string, worktree = WORKTREE): FakeTree {
      files.set(
        `${PROJECT_DIR}/${ID}/subagents/agent-${agentId}.meta.json`,
        JSON.stringify({ agentType: 'implementer', worktreePath: worktree, spawnedWithWorktree: true }),
      )
      const tree: FakeTree = { head: 'beef001', numstat: '', untracked: [] }
      git.worktrees.set(worktree, tree)
      return tree
    },
    // The session's own record, as the store has it
    record(): SessionRecord | null {
      const text = files.get(RECORD)
      return text === undefined ? null : parseSessionRecord(JSON.parse(text) as unknown)
    },
    // What options.json tells the station, as the store has it; null when there is none
    shared(): SharedOptions | null {
      const text = files.get(OPTIONS_FILE)
      return text === undefined ? null : parseSharedOptions(JSON.parse(text) as unknown)
    },
    // The engine's title file for the session: a title, or null to remove the file
    titleFile(title: string | null): void {
      if (title === null) {
        files.delete(TITLE_FILE)
      } else {
        files.set(TITLE_FILE, JSON.stringify({ customTitle: title }))
      }
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
      mtimes.set(`${SESSIONS}/${id}.json`, checkedInAt)
    },
    // Whether the store holds the record of the session `id`
    hasRecord(id: string): boolean {
      return files.has(`${SESSIONS}/${id}.json`)
    },
  }
}
