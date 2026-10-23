// What each command a session left running in the background is doing. The
// engine wakes the session when such a command ends, so the session stays
// working while one of them works. A command that runs until it is stopped
// never ends by itself, and the session does not wait on it: a dev server, a
// file watcher, a log it follows.
//
// The engine runs each background command in a shell of its own, which leads
// its own process group and writes the command's output, and that of
// everything it starts, to a file named after the task: `<task id>.output`.
// A look tells what each command is doing from three things, cheapest first:
// what the command runs; whether one of its processes, found from that file
// with `ps` and `lsof`, listens on a TCP port; and what its output says.

import type { Io } from './services.ts'

// A background command as a Stop lists it: its task id and the line it runs
export interface Shell {
  id: string
  command: string
}

// What a look finds a background command doing
//   working:   nothing says it will not end by itself, so the session waits on it
//   following: what it runs never ends by itself: a file watcher, `tail -f`, `docker compose up`
//   serving:   one of its processes listens on a TCP port: a dev server, a database, a tunnel
//   watching:  its output says it is waiting for files to change
export type ShellState = 'working' | 'following' | 'serving' | 'watching'

// How long each `ps`, `lsof`, `head` or `tail` of a look may run
export const LOOK_TIMEOUT_MS = 3000

// How much of the start, and of the end, of a command's output a look reads
export const OUTPUT_PEEK_BYTES = 4096

// After a turn ends with background commands at work, the heartbeat looks at
// them again: at every beat for LOOK_FAST_FOR_MS after the turn ended, so a
// dev server that takes a few seconds to listen is seen soon, then once
// LOOK_SLOW_MS has passed since the last look, about once a minute
export const LOOK_FAST_FOR_MS = 120_000
export const LOOK_SLOW_MS = 55_000

// Commands that never end by themselves, each known by the program it runs.
// Never a bare flag or word: `gh pr checks --watch` and `gh run watch` end
// when the checks do, and a `while true` loop ends at its `break`.
const FOLLOWS: readonly RegExp[] = [
  // tail -f, tail -F, tail -n 200 -f, tail --follow
  /\btail\b[^|;&]*?\s(?:-[A-Za-z0-9]*[fF][A-Za-z0-9]*|--follow(?:=\S*)?)(?=\s|$)/,
  // docker compose up and its kin, unless detached
  /\b(?:docker-compose|podman-compose|(?:docker|podman)\s+compose)\b[^|;&]*?\sup\b(?![^|;&]*\s(?:-d|--detach|--wait)\b)/,
  // docker logs -f, docker compose logs -f, kubectl logs -f
  /\b(?:docker(?:-compose|\s+compose)?|podman(?:-compose|\s+compose)?|kubectl)\s+logs\b[^|;&]*?\s(?:-f|--follow)\b/,
  // programs that run a command on every change
  /\b(?:fswatch|watchexec|nodemon|entr)\b/,
  /\binotifywait\b[^|;&]*?\s(?:-m|--monitor)\b/,
  // build tools, test runners and runtimes in watch mode
  /\b(?:tsc|webpack|rollup|esbuild|vite|vitest|jest|tsup|sass|tailwindcss|babel|swc|node|bun|deno)\b[^|;&]*?\s(?:--watch(?:All)?|-w)(?![=\w-])/,
  /\b(?:cargo|tsx|vitest|parcel|turbo)\s+watch\b/,
  /\b(?:npm|pnpm|yarn|bun)\s+(?:run\s+)?watch\b/,
  /\bsleep\s+infinity\b/,
]

// A program that waits for files to change says so, at the start of its
// output or after each run: "Starting compilation in watch mode" and
// "Watching for file changes." (tsc), "watching files for updates"
// (webpack-cli), "[nodemon] watching path(s)", "watching for changes"
// (esbuild, Sass, tsup, Vite), "waiting for changes" (Rollup), "Waiting for
// file changes" (Vitest, node --watch), "Watcher Process started." (Deno)
export const WATCHING = /\b(?:watching (?:for|the|files?|paths?|extensions)|watch mode|waiting for (?:file )?changes|watcher process started)\b/i

// A task id as the engine makes them, which also keeps it safe in a file name
const TASK_ID = /^[A-Za-z0-9_-]{1,64}$/

// One row of `ps -A -o pid=,ppid=,pgid=`
export interface Proc {
  pid: number
  ppid: number
  pgid: number
}

// One file a process has open, from `lsof -F pn`
export interface OpenFile {
  pid: number
  name: string
}

// A command's processes and the file they write its output to; null when no
// process writes to it
export interface CommandProcesses {
  pids: Set<number>
  output: string | null
}

// The line runs a program that never ends by itself
export function follows(command: string): boolean {
  return FOLLOWS.some((pattern) => pattern.test(command))
}

// A Stop's task id, when the engine's look can use it
export function isTaskId(id: string): boolean {
  return TASK_ID.test(id)
}

// Text as a terminal shows it, with its colour and cursor codes taken out
export function plainText(text: string): string {
  return text
    .split('\u001b')
    .map((part, index) => (index === 0 ? part : part.replace(/^\[[0-9;?]*[ -/]*[@-~]/, '')))
    .join('')
}

function count(field: string): number | null {
  const n = Number(field)
  return field !== '' && Number.isInteger(n) && n >= 0 ? n : null
}

// The process table, one process a line; a line that does not parse is left out
export function parseProcesses(text: string): Proc[] {
  const procs: Proc[] = []
  for (const line of text.split('\n')) {
    const fields = line.trim().split(/\s+/).map(count)
    const [pid, ppid, pgid] = fields
    if (fields.length === 3 && typeof pid === 'number' && typeof ppid === 'number' && typeof pgid === 'number') {
      procs.push({ pid, ppid, pgid })
    }
  }
  return procs
}

// `lsof -F pn` prints a `p<pid>` line for each process, then an `n<name>`
// line for each of its files, each after an `f<descriptor>` line
export function parseOpenFiles(text: string): OpenFile[] {
  const files: OpenFile[] = []
  let pid: number | null = null
  for (const line of text.split('\n')) {
    if (line.startsWith('p')) {
      pid = count(line.slice(1))
    } else if (line.startsWith('n') && pid !== null) {
      files.push({ pid, name: line.slice(1) })
    }
  }
  return files
}

// The processes `lsof -F p` lists
export function parsePids(text: string): Set<number> {
  const pids = new Set<number>()
  for (const line of text.split('\n')) {
    const pid = line.startsWith('p') ? count(line.slice(1)) : null
    if (pid !== null) {
      pids.add(pid)
    }
  }
  return pids
}

// Each command's processes: those that write to its output file, the rest of
// any process group one of them leads, as the command's shell does, and
// everything any of them started. A group counts only when one of the writers
// leads it, so it is never the engine's own.
export function commandProcesses(
  shells: readonly Shell[],
  procs: readonly Proc[],
  files: readonly OpenFile[],
): Map<string, CommandProcesses> {
  const children = new Map<number, number[]>()
  for (const proc of procs) {
    const siblings = children.get(proc.ppid)
    if (siblings === undefined) {
      children.set(proc.ppid, [proc.pid])
    } else {
      siblings.push(proc.pid)
    }
  }
  const found = new Map<string, CommandProcesses>()
  for (const shell of shells) {
    const suffix = `/${shell.id}.output`
    const pids = new Set<number>()
    let output: string | null = null
    for (const file of files) {
      if (file.pid > 1 && file.name.endsWith(suffix)) {
        pids.add(file.pid)
        output = file.name
      }
    }
    const groups = new Set<number>()
    for (const proc of procs) {
      if (pids.has(proc.pid) && proc.pgid === proc.pid) {
        groups.add(proc.pgid)
      }
    }
    for (const proc of procs) {
      if (groups.has(proc.pgid)) {
        pids.add(proc.pid)
      }
    }
    const stack = [...pids]
    for (let pid = stack.pop(); pid !== undefined; pid = stack.pop()) {
      for (const child of children.get(pid) ?? []) {
        if (!pids.has(child)) {
          pids.add(child)
          stack.push(child)
        }
      }
    }
    found.set(shell.id, { pids, output })
  }
  return found
}

// The first and last OUTPUT_PEEK_BYTES of a command's output, as a terminal shows them
async function peek(io: Pick<Io, 'run'>, path: string): Promise<string> {
  const size = String(OUTPUT_PEEK_BYTES)
  const head = await io.run(['/usr/bin/head', '-c', size, path], undefined, LOOK_TIMEOUT_MS)
  const tail = await io.run(['/usr/bin/tail', '-c', size, path], undefined, LOOK_TIMEOUT_MS)
  return plainText(`${head.stdout}\n${tail.stdout}`)
}

// What each command is doing. What it runs is read first, and only the
// commands that leaves open are looked at further. A command whose processes
// cannot be found is working: a Monitor's output goes to the engine, not to
// the file, and a Monitor ends by its deadline. So is every command still open
// when the look cannot be made: `ps` or `lsof` missing, failing or too slow.
export async function lookAtShells(io: Pick<Io, 'run'>, shells: readonly Shell[]): Promise<Map<string, ShellState>> {
  const states = new Map<string, ShellState>()
  const open: Shell[] = []
  for (const shell of shells) {
    if (follows(shell.command)) {
      states.set(shell.id, 'following')
    } else {
      states.set(shell.id, 'working')
      if (isTaskId(shell.id)) {
        open.push(shell)
      }
    }
  }
  if (open.length === 0) {
    return states
  }
  try {
    const table = await io.run(['/bin/ps', '-A', '-o', 'pid=,ppid=,pgid='], undefined, LOOK_TIMEOUT_MS)
    const writing = await io.run(['/usr/sbin/lsof', '-nP', '-w', '-F', 'pn', '-d', '1,2'], undefined, LOOK_TIMEOUT_MS)
    const procs = parseProcesses(table.stdout)
    const files = parseOpenFiles(writing.stdout)
    // Every Mac has processes writing somewhere: a look that finds none was not made
    if (procs.length === 0 || files.length === 0) {
      return states
    }
    const found = commandProcesses(open, procs, files)
    const all = new Set<number>()
    for (const { pids } of found.values()) {
      for (const pid of pids) {
        all.add(pid)
      }
    }
    if (all.size === 0) {
      return states
    }
    const listening = parsePids(
      (await io.run(['/usr/sbin/lsof', '-nP', '-w', '-a', '-p', [...all].join(','), '-iTCP', '-sTCP:LISTEN', '-F', 'p'], undefined, LOOK_TIMEOUT_MS)).stdout,
    )
    for (const shell of open) {
      const one = found.get(shell.id)
      if (one === undefined || one.pids.size === 0) {
        continue
      }
      if ([...one.pids].some((pid) => listening.has(pid))) {
        states.set(shell.id, 'serving')
      } else if (one.output !== null && WATCHING.test(await peek(io, one.output))) {
        states.set(shell.id, 'watching')
      }
    }
  } catch {
    // What the look found before it failed stands; the rest stays working
  }
  return states
}

// The commands a look left working
export function stillWorking(shells: readonly Shell[], states: ReadonlyMap<string, ShellState>): Shell[] {
  return shells.filter((shell) => (states.get(shell.id) ?? 'working') === 'working')
}

// The heartbeat looks again: at every beat for LOOK_FAST_FOR_MS after the turn
// ended, then once LOOK_SLOW_MS has passed since the last look
export function lookDue(stoppedAt: number, lookedAt: number, now: number): boolean {
  return now - stoppedAt < LOOK_FAST_FOR_MS || now - lookedAt >= LOOK_SLOW_MS
}
