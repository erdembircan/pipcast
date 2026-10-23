// The look at background commands on this Mac's own processes: each command
// runs as the engine runs one, in a shell that leads its own process group
// and writes to `<task id>.output`. macOS only: elsewhere these are skipped.

import { execFile, spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { closeSync, mkdtempSync, openSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { lookAtShells } from '../../plugin/src/core/shells.ts'
import type { Shell } from '../../plugin/src/core/shells.ts'
import type { RunResult } from '../../plugin/src/core/services.ts'

const io = {
  run(argv: readonly string[], _cwd?: string, timeoutMs?: number): Promise<RunResult> {
    return new Promise((resolve, reject) => {
      const [program = '', ...args] = argv
      execFile(program, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (error !== null && typeof error.code !== 'number') {
          reject(error)
          return
        }
        resolve({ exitCode: error === null ? 0 : Number(error.code), stdout, stderr })
      })
    })
  },
}

// The commands, as a Stop would list them
const server: Shell = { id: 'bpiptest1', command: 'npm run dev' }
const watcher: Shell = { id: 'bpiptest2', command: 'npm run build:watch' }
const timer: Shell = { id: 'bpiptest3', command: 'sleep 30' }

// What each one really runs: a server on a port of the system's choosing, its
// output through a pipe; a program that says it watches; a timer
const RUNS: Record<string, string> = {
  [server.id]: `node -e "require('http').createServer().listen(0, '127.0.0.1', () => console.log('up'))" | cat`,
  [watcher.id]: `node -e "console.log('Found 0 errors. Watching for file changes.'); setInterval(() => {}, 1000)"`,
  [timer.id]: 'sleep 30',
}

describe.runIf(process.platform === 'darwin')('a look at real background commands', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pipcast-shells-'))
  const shells: ChildProcess[] = []

  beforeAll(async () => {
    for (const [id, command] of Object.entries(RUNS)) {
      const out = openSync(join(dir, `${id}.output`), 'w')
      shells.push(spawn('/bin/sh', ['-c', command], { detached: true, stdio: ['ignore', out, out] }))
      closeSync(out)
    }
    // Until the server listens and the watcher has spoken
    const ready = () =>
      readFileSync(join(dir, `${server.id}.output`), 'utf8').includes('up') &&
      readFileSync(join(dir, `${watcher.id}.output`), 'utf8').includes('Watching')
    for (let waited = 0; !ready() && waited < 10_000; waited += 100) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  })

  afterAll(() => {
    for (const shell of shells) {
      if (shell.pid !== undefined) {
        try {
          process.kill(-shell.pid, 'SIGTERM')
        } catch {
          // already gone
        }
      }
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('finds the server listening, the watcher watching and the timer at work', async () => {
    const states = await lookAtShells(io, [server, watcher, timer, { id: 'bpiptest4', command: 'sleep 60' }])
    expect(states).toEqual(
      new Map([
        [server.id, 'serving'],
        [watcher.id, 'watching'],
        [timer.id, 'working'],
        ['bpiptest4', 'working'],
      ]),
    )
  })
})
