import { describe, expect, it } from 'vitest'

import { defaultHome, storePaths } from '@pipcast/contract'
import type { SessionRecord } from '@pipcast/contract'
import * as m from '../src/core/model.ts'
import { ORPHAN_MS, READY_IDLE_MS, checkIn, ensureStation, readSharedOptions, recordOf, shareOptions, sweepOrphans, tuneIn, tuneOut } from '../src/core/services.ts'
import type { Io, RunResult } from '../src/core/services.ts'

const HOME = '/store'
const paths = storePaths(HOME)
const T = 1_792_600_000_000
const BIN = '/plug/station/pipcast-station'

interface Fake {
  io: Io
  files: Map<string, string>
  runs: (readonly string[])[]
  now: number
  target: string | null
  launch: RunResult
  onWrite: (path: string) => void
  temps: string[]
  mtimes: Map<string, number>
}

function fake(): Fake {
  const state: Fake = {
    io: undefined as unknown as Io,
    files: new Map(),
    runs: [],
    now: T,
    target: null,
    launch: { exitCode: 0, stdout: 'started 4242\n', stderr: '' },
    onWrite: () => undefined,
    temps: [],
    mtimes: new Map(),
  }
  state.io = {
    now: async () => state.now,
    storeHome: async () => HOME,
    claudeConfigDir: async () => '/cfg',
    read: async (path) => state.files.get(path) ?? null,
    stat: async (path) => {
      const text = state.files.get(path)
      return text === undefined ? null : { size: text.length, mtimeMs: state.mtimes.get(path) ?? state.now }
    },
    write: async (path, text, temp) => {
      state.files.set(path, text)
      state.mtimes.set(path, state.now)
      state.temps.push(temp ?? `${path}.tmp`)
      state.onWrite(path)
    },
    remove: async (path) => {
      state.files.delete(path)
      state.mtimes.delete(path)
    },
    list: async (dir) => {
      const prefix = `${dir}/`
      return [...state.files.keys()].filter((path) => path.startsWith(prefix)).map((path) => path.slice(prefix.length))
    },
    run: async (argv) => {
      state.runs.push(argv)
      if (argv[0] === BIN) {
        return state.launch
      }
      return { exitCode: 0, stdout: '', stderr: '' }
    },
    stationBinary: async () => BIN,
    stationAssets: () => '/plug/station',
    targetBundleId: async () => state.target,
  }
  return state
}

function other(state: Fake, id: string, tunedInAt: number, checkedInAt = state.now): void {
  const record: SessionRecord = {
    v: 1,
    id,
    title: id,
    project: 'p',
    state: 'working',
    stateAt: tunedInAt,
    tunedInAt,
    checkedInAt,
    stories: [],
    activity: [],
    hours: [],
  }
  state.files.set(paths.session(id), JSON.stringify(record))
}

const mine = () => m.newModel('me', 'proj', 'My title', T)
const stored = (state: Fake): SessionRecord | undefined => {
  const text = state.files.get(paths.session('me'))
  return text === undefined ? undefined : (JSON.parse(text) as SessionRecord)
}

describe('ensureStation', () => {
  it('makes the binary executable, then launches it with the store and the assets', async () => {
    const state = fake()
    expect(await ensureStation(state.io, HOME)).toBe(true)
    expect(state.runs).toEqual([
      ['/bin/chmod', '+x', BIN],
      [BIN, 'launch', '--home', HOME, '--assets', '/plug/station'],
    ])
  })

  it('adds the target bundle id when there is one', async () => {
    const state = fake()
    state.target = 'com.example.never'
    await ensureStation(state.io, HOME)
    expect(state.runs[1]).toEqual([BIN, 'launch', '--home', HOME, '--assets', '/plug/station', '--target-bundle-id', 'com.example.never'])
  })

  it('succeeds on "running" too', async () => {
    const state = fake()
    state.launch = { exitCode: 0, stdout: 'running 99\n', stderr: '' }
    expect(await ensureStation(state.io, HOME)).toBe(true)
  })

  it('fails on a bad exit code, on other output, or when it cannot run at all', async () => {
    const state = fake()
    state.launch = { exitCode: 1, stdout: 'started 1', stderr: '' }
    expect(await ensureStation(state.io, HOME)).toBe(false)
    state.launch = { exitCode: 0, stdout: 'error: no window server', stderr: '' }
    expect(await ensureStation(state.io, HOME)).toBe(false)
    state.io.run = async () => {
      throw new Error('spawn ENOENT')
    }
    expect(await ensureStation(state.io, HOME)).toBe(false)
  })
})

describe('tuneIn', () => {
  it('writes the record with both times, starts the station and says when it tuned in', async () => {
    const state = fake()
    other(state, 'a', T - 5000)
    const result = await tuneIn(state.io, mine())
    expect(result).toEqual({ status: 'on', tunedInAt: T })
    expect(stored(state)).toMatchObject({ v: 1, id: 'me', title: 'My title', tunedInAt: T, checkedInAt: T })
    expect(state.runs.some((argv) => argv[1] === 'launch')).toBe(true)
  })

  it('tunes in however many others are on air', async () => {
    const state = fake()
    for (const [i, id] of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].entries()) {
      other(state, id, T - 5000 + i)
    }
    expect(await tuneIn(state.io, mine())).toEqual({ status: 'on', tunedInAt: T })
    expect(stored(state)).toMatchObject({ id: 'me', tunedInAt: T, checkedInAt: T })
    expect(state.runs.some((argv) => argv[1] === 'launch')).toBe(true)
  })

  it('removes the record when the station cannot start', async () => {
    const state = fake()
    state.launch = { exitCode: 1, stdout: '', stderr: 'nope' }
    expect(await tuneIn(state.io, mine())).toEqual({ status: 'cannot-start' })
    expect(stored(state)).toBeUndefined()
  })
})

describe('tuneOut', () => {
  it('removes the record, and is fine when there is none', async () => {
    const state = fake()
    await tuneIn(state.io, mine())
    expect(stored(state)).toBeDefined()
    await tuneOut(state.io, HOME, 'me')
    expect(stored(state)).toBeUndefined()
    await tuneOut(state.io, HOME, 'me')
  })
})

describe('checkIn', () => {
  const alive = (state: Fake, heartbeatAt = state.now) =>
    state.files.set(paths.station, JSON.stringify({ v: 1, pid: 1, startedAt: T - 1000, heartbeatAt, version: '1' }))

  it('writes the record with a new checkedInAt', async () => {
    const state = fake()
    other(state, 'a', T - 5000)
    alive(state)
    await tuneIn(state.io, mine())
    state.runs.length = 0
    state.now = T + 10_000
    alive(state)
    const result = await checkIn(state.io, mine(), T)
    expect(result).toEqual({ off: null })
    expect(stored(state)).toMatchObject({ tunedInAt: T, checkedInAt: T + 10_000 })
    expect(state.runs).toEqual([])
  })

  it('removes the record when the window was closed after it tuned in', async () => {
    const state = fake()
    await tuneIn(state.io, mine())
    state.files.set(paths.control, JSON.stringify({ v: 1, closedAt: T }))
    state.now = T + 10_000
    expect(await checkIn(state.io, mine(), T)).toEqual({ off: 'closed' })
    expect(stored(state)).toBeUndefined()
  })

  it('ignores a close from before it tuned in, and a control file it cannot read', async () => {
    const state = fake()
    alive(state)
    await tuneIn(state.io, mine())
    state.files.set(paths.control, JSON.stringify({ v: 1, closedAt: T - 1 }))
    expect((await checkIn(state.io, mine(), T)).off).toBeNull()
    state.files.set(paths.control, '{broken')
    expect((await checkIn(state.io, mine(), T)).off).toBeNull()
    state.files.set(paths.control, JSON.stringify({ closedAt: T + 5 }))
    expect((await checkIn(state.io, mine(), T)).off).toBeNull()
  })

  it('starts the station again when its file has gone quiet or is missing', async () => {
    const state = fake()
    await tuneIn(state.io, mine())
    state.runs.length = 0
    // missing
    await checkIn(state.io, mine(), T)
    expect(state.runs.filter((argv) => argv[1] === 'launch')).toHaveLength(1)
    // quiet for 21 s
    state.runs.length = 0
    alive(state, T - 21_000)
    await checkIn(state.io, mine(), T)
    expect(state.runs.filter((argv) => argv[1] === 'launch')).toHaveLength(1)
    // quiet for 20 s is still alive
    state.runs.length = 0
    alive(state, T - 20_000)
    await checkIn(state.io, mine(), T)
    expect(state.runs).toEqual([])
  })

  it('is not troubled by a station that will not relaunch', async () => {
    const state = fake()
    await tuneIn(state.io, mine())
    state.launch = { exitCode: 1, stdout: '', stderr: '' }
    expect((await checkIn(state.io, mine(), T)).off).toBeNull()
  })

  it('takes a session ready for an hour off the air, and writes nothing', async () => {
    const state = fake()
    alive(state)
    await tuneIn(state.io, mine())
    state.runs.length = 0
    state.now = T + READY_IDLE_MS
    alive(state)
    expect(await checkIn(state.io, mine(), T)).toEqual({ off: 'idle' })
    expect(stored(state)).toBeUndefined()
    expect(state.runs).toEqual([])
  })

  it('keeps a session ready for less than an hour on the air', async () => {
    const state = fake()
    alive(state)
    await tuneIn(state.io, mine())
    state.now = T + READY_IDLE_MS - 1
    alive(state)
    expect(await checkIn(state.io, mine(), T)).toEqual({ off: null })
    expect(stored(state)).toMatchObject({ checkedInAt: T + READY_IDLE_MS - 1 })
  })

  it('counts the hour from tuning in, when that came after the session went ready', async () => {
    const state = fake()
    alive(state)
    const tuned = T + READY_IDLE_MS
    state.now = tuned
    await tuneIn(state.io, mine())
    state.now = tuned + READY_IDLE_MS - 1
    alive(state)
    expect((await checkIn(state.io, mine(), tuned)).off).toBeNull()
    state.now = tuned + READY_IDLE_MS
    alive(state)
    expect((await checkIn(state.io, mine(), tuned)).off).toBe('idle')
  })

  it('counts the hour from the newest activity line, as after a reload in the middle of a turn', async () => {
    const state = fake()
    alive(state)
    const busy = m.activity(mine(), T + 30 * 60_000, 'running the test suite')
    await tuneIn(state.io, busy)
    state.now = T + READY_IDLE_MS
    alive(state)
    expect((await checkIn(state.io, busy, T)).off).toBeNull()
    state.now = T + 30 * 60_000 + READY_IDLE_MS
    alive(state)
    expect((await checkIn(state.io, busy, T)).off).toBe('idle')
  })

  it('never takes a session working, waiting on you or stopped on an error off the air', async () => {
    for (const model of [m.turnStarted(mine(), T, 't1'), m.askedQuestion(mine(), T, 'Which one?'), m.failed(mine(), T, 'overloaded')]) {
      const state = fake()
      alive(state)
      await tuneIn(state.io, model)
      state.now = T + 10 * READY_IDLE_MS
      alive(state)
      expect((await checkIn(state.io, model, T)).off).toBeNull()
    }
  })

  it('says the window was closed when the hour is up as well', async () => {
    const state = fake()
    await tuneIn(state.io, mine())
    state.files.set(paths.control, JSON.stringify({ v: 1, closedAt: T }))
    state.now = T + READY_IDLE_MS
    expect(await checkIn(state.io, mine(), T)).toEqual({ off: 'closed' })
    expect(stored(state)).toBeUndefined()
  })
})

describe('recordOf', () => {
  it('sets the two times and trims the lists', () => {
    let model = mine()
    for (let i = 0; i < 12; i += 1) {
      model = m.askedQuestion(model, T + i, `q${i}`)
    }
    const record = recordOf({ ...model, record: { ...model.record, stories: [...model.record.stories, ...model.record.stories] } }, 5, 6)
    expect(record.tunedInAt).toBe(5)
    expect(record.checkedInAt).toBe(6)
    expect(record.stories.length).toBe(10)
  })
})

describe('the store home', () => {
  it('is where the contract puts it', () => {
    expect(defaultHome('/Users/me')).toBe('/Users/me/Library/Application Support/Pipcast')
  })
})

describe('the options the station follows', () => {
  it('writes options.json through a temporary file named after the writer', async () => {
    const state = fake()
    await shareOptions(state.io, HOME, { v: 1, transparent: true }, 'session-a')
    expect(JSON.parse(state.files.get(paths.options) ?? '')).toEqual({ v: 1, transparent: true })
    expect(state.temps).toEqual([`${paths.options}.session-a.tmp`])
  })

  it('reads options.json back, or null when it is missing or not one', async () => {
    const state = fake()
    expect(await readSharedOptions(state.io, HOME)).toBeNull()
    state.files.set(paths.options, 'not json')
    expect(await readSharedOptions(state.io, HOME)).toBeNull()
    state.files.set(paths.options, JSON.stringify({ v: 1, transparent: false }))
    expect(await readSharedOptions(state.io, HOME)).toEqual({ v: 1, transparent: false })
  })
})

describe('sweepOrphans', () => {
  const aged = (state: Fake, path: string, age = ORPHAN_MS + 1): void => {
    state.files.set(path, '{}')
    state.mtimes.set(path, T - age)
  }

  it('tuning in deletes a record no session has written for over an hour', async () => {
    const state = fake()
    aged(state, paths.session('gone'))
    await tuneIn(state.io, mine())
    expect(state.files.has(paths.session('gone'))).toBe(false)
    expect(stored(state)).toBeDefined()
  })

  it('keeps a record written within the hour', async () => {
    const state = fake()
    aged(state, paths.session('recent'), ORPHAN_MS)
    await tuneIn(state.io, mine())
    expect(state.files.has(paths.session('recent'))).toBe(true)
  })

  it('deletes a temporary file left over an hour ago', async () => {
    const state = fake()
    aged(state, `${paths.session('gone')}.tmp`)
    await tuneIn(state.io, mine())
    expect(state.files.has(`${paths.session('gone')}.tmp`)).toBe(false)
  })

  it("never touches the session's own record, or a file that is not a record", async () => {
    const state = fake()
    aged(state, paths.session('me'))
    aged(state, `${paths.session('me')}.tmp`)
    aged(state, `${paths.sessions}/notes.txt`)
    aged(state, paths.session('gone'))
    await sweepOrphans(state.io, HOME, 'me')
    expect(state.files.has(paths.session('me'))).toBe(true)
    expect(state.files.has(`${paths.session('me')}.tmp`)).toBe(true)
    expect(state.files.has(`${paths.sessions}/notes.txt`)).toBe(true)
    expect(state.files.has(paths.session('gone'))).toBe(false)
  })

  it('leaves a file alone when it cannot tell its age', async () => {
    const state = fake()
    aged(state, paths.session('unknown'))
    const stat = state.io.stat
    state.io.stat = async (path) => (path === paths.session('unknown') ? null : stat(path))
    await tuneIn(state.io, mine())
    expect(state.files.has(paths.session('unknown'))).toBe(true)
  })

  it('a sweep that fails still lets the session tune in', async () => {
    const state = fake()
    state.io.list = async () => {
      throw new Error('EACCES')
    }
    expect(await tuneIn(state.io, mine())).toEqual({ status: 'on', tunedInAt: T })
  })
})
