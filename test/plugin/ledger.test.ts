import { describe, expect, it } from 'vitest'

import {
  GIT_TIMEOUT_MS,
  MAX_TREES,
  agentMetaPath,
  look,
  parseAgentMeta,
  readTree,
  remember,
  topOf,
} from '../../plugin/src/core/ledger.ts'
import type { Reading } from '../../plugin/src/core/ledger.ts'
import type { Io } from '../../plugin/src/core/services.ts'

interface FakeTree {
  head: string | null
  numstat: string
  untracked: string[]
  fails?: boolean
}

interface FakeFile {
  text: string
  mtimeMs: number
}

interface World {
  io: Io
  // Git's answers, per tree by its top folder
  trees: Map<string, FakeTree>
  files: Map<string, FakeFile>
  runs: { argv: readonly string[]; cwd: string | undefined; timeoutMs: number | undefined }[]
  reads: string[]
  // Makes every run reject, as when git cannot be started
  cannotRun: boolean
  // Makes one git command (its first argument) exit 128
  failing: string | null
}

function world(): World {
  const state: World = {
    io: undefined as unknown as Io,
    trees: new Map(),
    files: new Map(),
    runs: [],
    reads: [],
    cannotRun: false,
    failing: null,
  }
  const treeAt = (folder: string): { top: string; tree: FakeTree } | null => {
    let best: string | null = null
    for (const top of state.trees.keys()) {
      if ((folder === top || folder.startsWith(`${top}/`)) && (best === null || top.length > best.length)) {
        best = top
      }
    }
    const tree = best === null ? undefined : state.trees.get(best)
    return best !== null && tree !== undefined ? { top: best, tree } : null
  }
  const done = (exitCode: number, stdout = '') => ({ exitCode, stdout, stderr: '' })
  state.io = {
    now: async () => 0,
    storeHome: async () => '/store',
    claudeConfigDir: async () => '/cfg',
    read: async (path) => {
      state.reads.push(path)
      return state.files.get(path)?.text ?? null
    },
    stat: async (path) => {
      const found = state.files.get(path)
      return found === undefined ? null : { size: found.text.length, mtimeMs: found.mtimeMs }
    },
    write: async () => undefined,
    remove: async () => undefined,
    list: async () => [],
    run: async (argv, cwd, timeoutMs) => {
      state.runs.push({ argv, cwd, timeoutMs })
      if (state.cannotRun) {
        throw new Error('cannot run')
      }
      const at = treeAt(cwd ?? '/')
      if (at === null || at.tree.fails === true || argv[1] === state.failing) {
        return done(128)
      }
      switch (argv[1]) {
        case 'rev-parse':
          if (argv[2] === '--show-toplevel') {
            return done(0, `${at.top}\n`)
          }
          return at.tree.head === null ? done(1) : done(0, `${at.tree.head}\n`)
        case 'diff-index':
          return done(0, at.tree.numstat)
        case 'ls-files':
          return done(0, at.tree.untracked.join('\0'))
        default:
          return done(0)
      }
    },
    stationBinary: async () => '/station',
    stationAssets: () => '/assets',
    targetBundleId: async () => null,
  }
  return state
}

const tree = (fields: Partial<FakeTree> = {}): FakeTree => ({ head: 'h1', numstat: '', untracked: [], ...fields })

async function reading(w: World, top: string, before: Reading | null = null): Promise<Reading> {
  const found = await readTree(w.io, top, before)
  if (found === null) {
    throw new Error('the tree could not be read')
  }
  return found
}

describe('topOf', () => {
  it('is the top of the tree that holds the folder', async () => {
    const w = world()
    w.trees.set('/repo', tree())
    expect(await topOf(w.io, '/repo')).toBe('/repo')
    expect(await topOf(w.io, '/repo/src/deep')).toBe('/repo')
    expect(w.runs[0]).toEqual({ argv: ['/usr/bin/git', 'rev-parse', '--show-toplevel'], cwd: '/repo', timeoutMs: GIT_TIMEOUT_MS })
  })

  it('is null outside git, or when git cannot run', async () => {
    const w = world()
    w.trees.set('/repo', tree())
    expect(await topOf(w.io, '/elsewhere')).toBeNull()
    w.trees.set('/broken', tree({ fails: true }))
    expect(await topOf(w.io, '/broken')).toBeNull()
    w.cannotRun = true
    expect(await topOf(w.io, '/repo')).toBeNull()
  })
})

describe('readTree', () => {
  it('reads the commit, the counts against that commit, and each untracked file as all its lines added', async () => {
    const w = world()
    w.trees.set('/repo', tree({ head: 'h1', numstat: '3\t1\tsrc/a.ts\n', untracked: ['new.txt'] }))
    w.files.set('/repo/new.txt', { text: 'a\nb\n', mtimeMs: 7 })
    const found = await readTree(w.io, '/repo', null)
    expect(found).toEqual({
      top: '/repo',
      head: 'h1',
      counts: new Map([
        ['src/a.ts', [3, 1]],
        ['new.txt', [2, 0]],
      ]),
      untracked: new Map([['new.txt', { size: 4, mtimeMs: 7, lines: 2 }]]),
    })
    expect(w.runs.map((run) => run.argv)).toEqual([
      ['/usr/bin/git', 'rev-parse', '--verify', '-q', 'HEAD'],
      ['/usr/bin/git', 'diff-index', '-M', '--numstat', 'h1'],
      ['/usr/bin/git', 'ls-files', '--others', '--exclude-standard', '-z'],
    ])
    expect(w.runs.every((run) => run.cwd === '/repo')).toBe(true)
  })

  it('is null with no commit yet, or when a git command fails or cannot run', async () => {
    const w = world()
    w.trees.set('/repo', tree({ head: null }))
    expect(await readTree(w.io, '/repo', null)).toBeNull()
    w.trees.set('/repo', tree())
    expect(await readTree(w.io, '/repo', null)).not.toBeNull()
    for (const command of ['rev-parse', 'diff-index', 'ls-files']) {
      w.failing = command
      expect(await readTree(w.io, '/repo', null)).toBeNull()
    }
    w.failing = null
    w.trees.set('/repo', tree({ fails: true }))
    expect(await readTree(w.io, '/repo', null)).toBeNull()
    w.trees.set('/repo', tree())
    expect(await readTree(w.io, '/gone', null)).toBeNull()
    w.cannotRun = true
    expect(await readTree(w.io, '/repo', null)).toBeNull()
  })

  it('gives every git command its time limit', async () => {
    const w = world()
    w.trees.set('/repo', tree({ untracked: ['n.txt'] }))
    w.files.set('/repo/n.txt', { text: 'x\n', mtimeMs: 1 })
    await topOf(w.io, '/repo')
    await readTree(w.io, '/repo', null)
    expect(w.runs).toHaveLength(4)
    expect(w.runs.map((run) => run.timeoutMs)).toEqual([GIT_TIMEOUT_MS, GIT_TIMEOUT_MS, GIT_TIMEOUT_MS, GIT_TIMEOUT_MS])
    expect(GIT_TIMEOUT_MS).toBe(10_000)
  })

  it('counts no lines for a binary file or one over 1 MB, and never reads the big one', async () => {
    const w = world()
    w.trees.set('/repo', tree({ untracked: ['shot.png', 'big.txt', 'late.txt', 'notes.md'] }))
    w.files.set('/repo/shot.png', { text: '\u0089PNG\r\n\u001a\n\u0000\u0000\u0000\rIHDR\nwide\nhigh\n', mtimeMs: 1 })
    w.files.set('/repo/big.txt', { text: 'y'.repeat(1_000_001), mtimeMs: 1 })
    // a NUL after the first 8,000 characters does not make a file binary
    w.files.set('/repo/late.txt', { text: `${'a'.repeat(8_000)}\u0000\nb\n`, mtimeMs: 1 })
    w.files.set('/repo/notes.md', { text: 'one\ntwo\n', mtimeMs: 1 })
    const found = await reading(w, '/repo')
    expect(found.counts.get('shot.png')).toEqual([0, 0])
    expect(found.counts.get('big.txt')).toEqual([0, 0])
    expect(found.counts.get('late.txt')).toEqual([2, 0])
    expect(found.counts.get('notes.md')).toEqual([2, 0])
    expect(w.reads).toContain('/repo/shot.png')
    expect(w.reads).not.toContain('/repo/big.txt')
  })

  it('counts an untracked file again only when its size or its time changed', async () => {
    const w = world()
    w.trees.set('/repo', tree({ untracked: ['n.txt'] }))
    w.files.set('/repo/n.txt', { text: 'a\nb\n', mtimeMs: 10 })
    const first = await reading(w, '/repo')
    expect(first.counts.get('n.txt')).toEqual([2, 0])
    expect(w.reads).toEqual(['/repo/n.txt'])

    w.reads.length = 0
    const same = await reading(w, '/repo', first)
    expect(same.counts.get('n.txt')).toEqual([2, 0])
    expect(w.reads).toEqual([])

    w.files.set('/repo/n.txt', { text: 'a\nb\n', mtimeMs: 11 })
    const touched = await reading(w, '/repo', same)
    expect(w.reads).toEqual(['/repo/n.txt'])

    w.reads.length = 0
    w.files.set('/repo/n.txt', { text: 'a\nb\nc\n', mtimeMs: 11 })
    const longer = await reading(w, '/repo', touched)
    expect(longer.counts.get('n.txt')).toEqual([3, 0])
    expect(w.reads).toEqual(['/repo/n.txt'])
  })

  it('reads at most 200 untracked files and leaves out one that has gone', async () => {
    const w = world()
    const names = Array.from({ length: 205 }, (_, i) => `f${i}.txt`)
    w.trees.set('/repo', tree({ untracked: names }))
    for (const name of names) {
      w.files.set(`/repo/${name}`, { text: 'x\n', mtimeMs: 1 })
    }
    w.files.delete('/repo/f3.txt')
    const found = await reading(w, '/repo')
    expect(found.untracked.size).toBe(199)
    expect(found.counts.size).toBe(199)
    expect(found.counts.has('f3.txt')).toBe(false)
    expect(found.counts.has('f199.txt')).toBe(true)
    expect(found.counts.has('f200.txt')).toBe(false)
    expect(w.reads).toHaveLength(199)
  })
})

describe('look', () => {
  it('books what moved since the last reading, each file named by its tree', async () => {
    const w = world()
    const repo = tree({ numstat: '3\t1\tsrc/a.ts\n' })
    w.trees.set('/repo', repo)
    const before = await reading(w, '/repo')
    repo.numstat = '10\t4\tsrc/a.ts\n2\t0\tsrc/b.ts\n'
    const { reading: after, booking } = await look(w.io, before)
    expect(booking).toEqual({ added: 9, removed: 3, files: ['/repo/src/a.ts', '/repo/src/b.ts'] })
    expect(after?.counts.get('src/b.ts')).toEqual([2, 0])
    const again = await look(w.io, after as Reading)
    expect(again.booking).toEqual({ added: 0, removed: 0, files: [] })
  })

  it('books nothing when the commit moved, and reads on from the new one', async () => {
    const w = world()
    const repo = tree({ numstat: '5\t1\tsrc/a.ts\n' })
    w.trees.set('/repo', repo)
    const before = await reading(w, '/repo')
    repo.head = 'h2'
    repo.numstat = ''
    const committed = await look(w.io, before)
    expect(committed.booking).toEqual({ added: 0, removed: 0, files: [] })
    expect(committed.reading?.head).toBe('h2')
    repo.numstat = '2\t0\tsrc/c.ts\n'
    const next = await look(w.io, committed.reading as Reading)
    expect(next.booking).toEqual({ added: 2, removed: 0, files: ['/repo/src/c.ts'] })
  })

  it("books a new file's lines once, through git add and the commit", async () => {
    const w = world()
    const repo = tree()
    w.trees.set('/repo', repo)
    const first = await reading(w, '/repo')
    expect(first.counts.has('new.txt')).toBe(false)

    // written, not yet added
    repo.untracked = ['new.txt']
    w.files.set('/repo/new.txt', { text: 'a\nb\n', mtimeMs: 1 })
    const written = await look(w.io, first)
    expect(written.booking).toEqual({ added: 2, removed: 0, files: ['/repo/new.txt'] })

    // git add
    repo.untracked = []
    repo.numstat = '2\t0\tnew.txt\n'
    const added = await look(w.io, written.reading as Reading)
    expect(added.booking).toEqual({ added: 0, removed: 0, files: [] })

    // the commit
    repo.head = 'h2'
    repo.numstat = ''
    const committed = await look(w.io, added.reading as Reading)
    expect(committed.booking).toEqual({ added: 0, removed: 0, files: [] })
    expect(committed.reading?.head).toBe('h2')
  })

  it('is null when the tree cannot be read any more', async () => {
    const w = world()
    const repo = tree({ numstat: '1\t0\ta.ts\n' })
    w.trees.set('/repo', repo)
    const before = await reading(w, '/repo')
    repo.fails = true
    expect(await look(w.io, before)).toEqual({ reading: null, booking: { added: 0, removed: 0, files: [] } })
    repo.fails = false
    w.cannotRun = true
    expect((await look(w.io, before)).reading).toBeNull()
  })
})

describe('remember', () => {
  it('keeps the newest eight readings, the least recently read going first', () => {
    const at = (top: string): Reading => ({ top, head: 'h', counts: new Map(), untracked: new Map() })
    const trees = new Map<string, Reading>()
    for (let i = 0; i < 10; i += 1) {
      remember(trees, at(`/t${i}`))
    }
    expect(MAX_TREES).toBe(8)
    expect([...trees.keys()]).toEqual(['/t2', '/t3', '/t4', '/t5', '/t6', '/t7', '/t8', '/t9'])
    remember(trees, at('/t2'))
    remember(trees, at('/t10'))
    expect([...trees.keys()]).toEqual(['/t4', '/t5', '/t6', '/t7', '/t8', '/t9', '/t2', '/t10'])
  })
})

describe("the engine's note on a subagent", () => {
  it("is beside the transcript, named by the subagent's id", () => {
    expect(agentMetaPath('/Users/me/.claude/projects/-work-proj', 'sid', 'a1')).toBe(
      '/Users/me/.claude/projects/-work-proj/sid/subagents/agent-a1.meta.json',
    )
  })

  it('names the worktree a subagent runs in', () => {
    const note = JSON.stringify({ agentType: 'implementer', worktreePath: '/repo/.claude/worktrees/agent-a1', spawnedWithWorktree: true })
    expect(parseAgentMeta(note)).toBe('/repo/.claude/worktrees/agent-a1')
  })

  it("is null for a subagent in the session's folder, and undefined with no note or a broken one", () => {
    expect(parseAgentMeta(JSON.stringify({ agentType: 'explore' }))).toBeNull()
    expect(parseAgentMeta(JSON.stringify({ worktreePath: '' }))).toBeNull()
    expect(parseAgentMeta(JSON.stringify({ worktreePath: 5 }))).toBeNull()
    expect(parseAgentMeta(null)).toBeUndefined()
    expect(parseAgentMeta('{broken')).toBeUndefined()
    expect(parseAgentMeta('null')).toBeUndefined()
    expect(parseAgentMeta('"text"')).toBeUndefined()
  })
})
