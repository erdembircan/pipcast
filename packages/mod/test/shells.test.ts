import { describe, expect, it } from 'vitest'

import {
  LOOK_FAST_FOR_MS,
  LOOK_SLOW_MS,
  WATCHING,
  commandProcesses,
  follows,
  lookAtShells,
  lookDue,
  parseOpenFiles,
  parsePids,
  parseProcesses,
  plainText,
  stillWorking,
} from '../src/core/shells.ts'
import type { Shell } from '../src/core/shells.ts'
import type { RunResult } from '../src/core/services.ts'

const TASKS = '/private/tmp/claude-501/-Users-me-proj/8253106f-ce3e-4af6-824a-21845bad3955/tasks'
const ENGINE = 67022

describe('follows', () => {
  it('knows commands that never end by themselves by the program they run', () => {
    for (const command of [
      'tail -f /var/log/app.log',
      'tail -F logs/dev.log',
      'tail -n 200 -f server.log',
      'tail --follow=name app.log',
      'docker compose up',
      'docker-compose up',
      'docker compose -f docker-compose.dev.yml up --build',
      'docker compose up -d && docker compose logs -f',
      'kubectl logs -f pod/web',
      'nodemon server.js',
      'npx nodemon --exec ts-node src/index.ts',
      'fswatch -o src | xargs -n1 -I{} make',
      'watchexec -e ts -- npm test',
      'inotifywait -m -r src',
      'npx tsc --watch',
      'tsc -w -p .',
      'npx webpack --watch',
      'npx vite build --watch',
      'npx jest --watchAll',
      'node --watch server.js',
      'bun run --watch index.ts',
      'deno run --watch main.ts',
      'npx tailwindcss -i in.css -o out.css --watch',
      'npx rollup -c -w',
      'cd web && npx tsc --watch',
      'cargo watch -x check',
      'npx tsx watch src/index.ts',
      'npx vitest watch',
      'npm run watch',
      'pnpm watch',
      'npm run watch:css',
      'sleep infinity',
    ]) {
      expect(follows(command), command).toBe(true)
    }
  })

  it('never takes a bare flag or word for one: these end by themselves', () => {
    for (const command of [
      'gh pr checks 17 --watch',
      'gh run watch 123',
      'sleep 1800',
      'until curl -sf localhost:3000; do sleep 1; done',
      'while true; do gh pr checks 17 | grep -q pending || break; sleep 30; done',
      'npm test',
      'npx vitest run',
      'npx vitest run --watch=false',
      'kubectl rollout status deploy/web --watch',
      'docker compose up -d',
      'docker compose up --wait',
      'docker compose run --rm test',
      'tail -n 50 log.txt',
      'grep -w foo file',
      "curl -w '%{http_code}' localhost:3000",
      'git log --follow src/a.ts',
      'npm run watchdog-check',
      'cd packages/vite-plugin && npm test -- -w',
      'npm run dev',
      'python3 -m http.server 8000',
      '',
    ]) {
      expect(follows(command), command).toBe(false)
    }
  })
})

describe('WATCHING', () => {
  it('hears a program say it waits for files to change', () => {
    for (const text of [
      '\u001b[90m1:19:20 AM\u001b[0m - Found 0 errors. Watching for file changes.',
      '1:19:19 AM - Starting compilation in watch mode...',
      '[webpack-cli] watching files for updates...',
      '\u001b[33m[nodemon] watching path(s): *.*\u001b[39m',
      '[watch] build finished, watching for changes...',
      '[2026-10-24 01:00:00] waiting for changes...',
      ' \u001b[2mWaiting for file changes...\u001b[22m',
      "Completed running 'app.js'. Waiting for file changes before restarting...",
      'Watcher Process started.',
      '\u001b[1mWatching\u001b[22m for file changes',
    ]) {
      expect(WATCHING.test(plainText(text)), text).toBe(true)
    }
  })

  it('hears nothing in output that waits for something else', () => {
    for (const text of [
      'Refreshing checks status every 10 seconds. Press Ctrl+C to quit.',
      'Waiting for deployment "web" rollout to finish: 1 of 3 updated replicas are available...',
      'Tests: 12 passed, 12 total',
      '  VITE v5.4.0  ready in 300 ms\n\n  ➜  Local:   http://localhost:5173/',
    ]) {
      expect(WATCHING.test(plainText(text)), text).toBe(false)
    }
  })
})

describe('plainText', () => {
  it('takes out colour and cursor codes and keeps every other character', () => {
    expect(plainText('\u001b[1m\u001b[32mok\u001b[39m\u001b[22m done \u001b[2K\u001b[1Gnext')).toBe('ok done next')
    expect(plainText('plain [1m text')).toBe('plain [1m text')
  })
})

describe('the parsers', () => {
  it('reads the process table and leaves out what does not parse', () => {
    expect(parseProcesses('  421     1   421\n69447 67022 69447\n\nPID PPID PGID\n12 34\n')).toEqual([
      { pid: 421, ppid: 1, pgid: 421 },
      { pid: 69447, ppid: 67022, pgid: 69447 },
    ])
  })

  it('reads the files lsof lists, each with its process', () => {
    const text = `p69447\nf1\nn${TASKS}/b5aeeed2n.output\nf2\nn${TASKS}/b5aeeed2n.output\np610\nf1\nn/dev/null\n`
    expect(parseOpenFiles(text)).toEqual([
      { pid: 69447, name: `${TASKS}/b5aeeed2n.output` },
      { pid: 69447, name: `${TASKS}/b5aeeed2n.output` },
      { pid: 610, name: '/dev/null' },
    ])
    expect(parseOpenFiles('f1\nn/orphan\n')).toEqual([])
  })

  it('reads the processes lsof lists', () => {
    expect(parsePids('p70912\np71149\nf3\nx\n')).toEqual(new Set([70912, 71149]))
  })
})

describe('commandProcesses', () => {
  const shell: Shell = { id: 'b5aeeed2n', command: 'npm run dev | tee dev.log' }

  it('finds the shell, its process group and what they started, and the file they write to', () => {
    const procs = [
      { pid: ENGINE, ppid: 1, pgid: ENGINE },
      { pid: 100, ppid: ENGINE, pgid: 100 },
      { pid: 101, ppid: 100, pgid: 100 },
      { pid: 102, ppid: 100, pgid: 100 },
      { pid: 103, ppid: 101, pgid: 103 },
      { pid: 200, ppid: ENGINE, pgid: 200 },
    ]
    // 100 is the command's shell; 101 writes into a pipe; 103 left the group
    const files = [
      { pid: 100, name: `${TASKS}/b5aeeed2n.output` },
      { pid: 102, name: `${TASKS}/b5aeeed2n.output` },
      { pid: 101, name: '->0x6e8f50af50a8c23c' },
      { pid: 200, name: `${TASKS}/b9other00.output` },
    ]
    const found = commandProcesses([shell], procs, files).get(shell.id)
    expect(found?.pids).toEqual(new Set([100, 101, 102, 103]))
    expect(found?.output).toBe(`${TASKS}/b5aeeed2n.output`)
  })

  it('never takes in a group a writer does not lead, such as the engine\'s', () => {
    const procs = [
      { pid: ENGINE, ppid: 1, pgid: ENGINE },
      { pid: 100, ppid: ENGINE, pgid: ENGINE },
      { pid: 101, ppid: 100, pgid: ENGINE },
      { pid: 300, ppid: ENGINE, pgid: ENGINE },
    ]
    const found = commandProcesses([shell], procs, [{ pid: 100, name: `${TASKS}/b5aeeed2n.output` }]).get(shell.id)
    expect(found?.pids).toEqual(new Set([100, 101]))
  })

  it('finds nothing for a command whose output no process writes, and never takes a longer id for its own', () => {
    const procs = [{ pid: 100, ppid: ENGINE, pgid: 100 }]
    const found = commandProcesses([shell], procs, [{ pid: 100, name: `${TASKS}/xb5aeeed2n.output` }]).get(shell.id)
    expect(found).toEqual({ pids: new Set(), output: null })
  })
})

// A fake host for the look: what each program prints, the start and the end
// of each output file, and every command run
function host(
  answers: { ps?: string; writing?: string; listening?: string; heads?: Record<string, string>; tails?: Record<string, string>; fail?: string } = {},
) {
  const ran: (readonly string[])[] = []
  const done = (stdout: string, exitCode = 0): RunResult => ({ exitCode, stdout, stderr: '' })
  return {
    ran,
    io: {
      async run(argv: readonly string[]): Promise<RunResult> {
        ran.push(argv)
        const [program] = argv
        if (program === answers.fail) {
          throw new Error('timed out')
        }
        switch (program) {
          case '/bin/ps':
            return done(answers.ps ?? '')
          case '/usr/sbin/lsof':
            return argv.includes('-iTCP') ? done(answers.listening ?? '', answers.listening ? 0 : 1) : done(answers.writing ?? '')
          case '/usr/bin/head':
            return done(answers.heads?.[argv.at(-1) ?? ''] ?? '')
          case '/usr/bin/tail':
            return done(answers.tails?.[argv.at(-1) ?? ''] ?? '')
          default:
            return done('', 127)
        }
      },
    },
  }
}

describe('lookAtShells', () => {
  const server: Shell = { id: 'b1devsrv0', command: 'npm run dev' }
  const watcher: Shell = { id: 'b2watch00', command: 'npm run build:watch' }
  const timer: Shell = { id: 'b3timer00', command: 'sleep 1800' }
  const tsc: Shell = { id: 'b4tscwch0', command: 'npx tsc --watch' }
  const ps = [`${ENGINE} 1 ${ENGINE}`, `100 ${ENGINE} 100`, '101 100 100', `200 ${ENGINE} 200`, '201 200 200', `300 ${ENGINE} 300`, '301 300 300'].join('\n')
  const writing = [
    'p100', 'f1', `n${TASKS}/b1devsrv0.output`,
    'p101', 'f1', `n${TASKS}/b1devsrv0.output`,
    'p200', 'f1', `n${TASKS}/b2watch00.output`,
    'p300', 'f1', `n${TASKS}/b3timer00.output`,
    'p610', 'f1', 'n/dev/null',
  ].join('\n')

  it('tells a server, a watcher and a command at work apart', async () => {
    const { io, ran } = host({
      ps,
      writing,
      listening: 'p101\n',
      tails: { [`${TASKS}/b2watch00.output`]: 'Found 0 errors. Watching for file changes.\n', [`${TASKS}/b3timer00.output`]: '' },
    })
    const states = await lookAtShells(io, [server, watcher, timer])
    expect(states).toEqual(
      new Map([
        [server.id, 'serving'],
        [watcher.id, 'watching'],
        [timer.id, 'working'],
      ]),
    )
    expect(ran).toContainEqual(['/usr/sbin/lsof', '-nP', '-w', '-a', '-p', '100,101,200,201,300,301', '-iTCP', '-sTCP:LISTEN', '-F', 'p'])
    expect(ran).toContainEqual(['/usr/bin/tail', '-c', '4096', `${TASKS}/b2watch00.output`])
  })

  it('reads the start of the output too', async () => {
    const { io } = host({ ps, writing, heads: { [`${TASKS}/b2watch00.output`]: '[nodemon] watching path(s): *.*\n' } })
    expect((await lookAtShells(io, [watcher])).get(watcher.id)).toBe('watching')
  })

  it('takes a command that never ends by itself at its word, and runs nothing for it', async () => {
    const { io, ran } = host({ ps, writing })
    expect(await lookAtShells(io, [tsc])).toEqual(new Map([[tsc.id, 'following']]))
    expect(ran).toEqual([])
  })

  it('counts a command whose processes it cannot find as working: a Monitor writes to the engine', async () => {
    const { io } = host({ ps, writing })
    const monitor: Shell = { id: 'blv20kp2f', command: 'until gh run view 9 --json status | grep -q completed; do sleep 30; done' }
    expect(await lookAtShells(io, [monitor])).toEqual(new Map([[monitor.id, 'working']]))
  })

  it('counts every command as working when the look cannot be made', async () => {
    for (const answers of [{ ps: '', writing }, { ps, writing: '' }, { ps, writing, fail: '/usr/sbin/lsof' }, { ps, writing, fail: '/bin/ps' }]) {
      const { io } = host(answers)
      expect(await lookAtShells(io, [server, timer, tsc])).toEqual(
        new Map([
          [server.id, 'working'],
          [timer.id, 'working'],
          [tsc.id, 'following'],
        ]),
      )
    }
  })

  it('keeps what it found before a step failed', async () => {
    const { io } = host({ ps, writing, listening: 'p100\n', fail: '/usr/bin/head' })
    expect(await lookAtShells(io, [server, watcher])).toEqual(
      new Map([
        [server.id, 'serving'],
        [watcher.id, 'working'],
      ]),
    )
  })
})

describe('stillWorking', () => {
  it('keeps the commands a look left working, and those it said nothing about', () => {
    const a: Shell = { id: 'a', command: 'x' }
    const b: Shell = { id: 'b', command: 'y' }
    const c: Shell = { id: 'c', command: 'z' }
    expect(stillWorking([a, b, c], new Map([[a.id, 'serving'], [b.id, 'working']]))).toEqual([b, c])
  })
})

describe('lookDue', () => {
  it('looks at every beat for a while after the turn ended, then about once a minute', () => {
    const stoppedAt = 1_000_000
    expect(lookDue(stoppedAt, stoppedAt, stoppedAt + 10_000)).toBe(true)
    expect(lookDue(stoppedAt, stoppedAt + 110_000, stoppedAt + LOOK_FAST_FOR_MS - 1)).toBe(true)
    expect(lookDue(stoppedAt, stoppedAt + 110_000, stoppedAt + LOOK_FAST_FOR_MS + 10_000)).toBe(false)
    expect(lookDue(stoppedAt, stoppedAt + 110_000, stoppedAt + 110_000 + LOOK_SLOW_MS)).toBe(true)
  })
})
