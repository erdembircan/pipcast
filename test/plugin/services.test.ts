import { describe, expect, it } from 'vitest'

import { STALE_MS, defaultHome, storePaths } from '@pipcast/contract'
import type { SessionRecord } from '@pipcast/contract'
import * as m from '../../plugin/src/core/model.ts'
import { checkIn, countOnAir, ensureStation, readRecords, recordOf, tuneIn, tuneOut } from '../../plugin/src/core/services.ts'
import type { Io, RunResult } from '../../plugin/src/core/services.ts'

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
  }
  state.io = {
    now: async () => state.now,
    storeHome: async () => HOME,
    claudeConfigDir: async () => '/cfg',
    read: async (path) => state.files.get(path) ?? null,
    stat: async (path) => {
      const text = state.files.get(path)
      return text === undefined ? null : { size: text.length, mtimeMs: 0 }
    },
    write: async (path, text) => {
      state.files.set(path, text)
      state.onWrite(path)
    },
    remove: async (path) => {
      state.files.delete(path)
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

describe('readRecords and countOnAir', () => {
  it('reads every parseable record and never a .tmp or a broken file', async () => {
    const state = fake()
    other(state, 'a', T - 1)
    other(state, 'b', T - 2)
    state.files.set(`${paths.sessions}/c.json.tmp`, '{"half":')
    state.files.set(`${paths.sessions}/d.json`, '{not json')
    state.files.set(`${paths.sessions}/e.json`, JSON.stringify({ v: 2 }))
    const records = await readRecords(state.io, HOME)
    expect(records.map((record) => record.id).sort()).toEqual(['a', 'b'])
  })

  it('counts the live ones on air, four at most', async () => {
    const state = fake()
    for (const [i, id] of ['a', 'b', 'c', 'd', 'e', 'f'].entries()) {
      other(state, id, T - 100 + i)
    }
    other(state, 'stale', T - 200, T - STALE_MS - 1)
    expect(await countOnAir(state.io, HOME, T)).toBe(4)
  })

  it('is zero for an empty store', async () => {
    expect(await countOnAir(fake().io, HOME, T)).toBe(0)
  })
})

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

  it('is full when four others are on air, and writes nothing', async () => {
    const state = fake()
    for (const [i, id] of ['a', 'b', 'c', 'd'].entries()) {
      other(state, id, T - 5000 + i)
    }
    expect(await tuneIn(state.io, mine())).toEqual({ status: 'full' })
    expect(stored(state)).toBeUndefined()
    expect(state.runs).toEqual([])
  })

  it('does not count a stale record or its own', async () => {
    const state = fake()
    for (const [i, id] of ['a', 'b', 'c'].entries()) {
      other(state, id, T - 5000 + i)
    }
    other(state, 'gone', T - 9000, T - STALE_MS - 1)
    const model = mine()
    state.files.set(paths.session('me'), JSON.stringify(recordOf(model, T - 8000, T - 1000)))
    expect((await tuneIn(state.io, model)).status).toBe('on')
  })

  it('loses a race: the record is removed and it is full', async () => {
    const state = fake()
    other(state, 'a', T - 5000)
    other(state, 'b', T - 4000)
    other(state, 'c', T - 3000)
    // as it writes, two sessions that tuned in earlier write theirs
    state.onWrite = (path) => {
      if (path === paths.session('me')) {
        other(state, 'x', T - 2000)
        other(state, 'y', T - 1000)
      }
    }
    expect(await tuneIn(state.io, mine())).toEqual({ status: 'full' })
    expect(stored(state)).toBeUndefined()
    expect(state.runs).toEqual([])
  })

  it('wins a race when it is among the first four', async () => {
    const state = fake()
    other(state, 'a', T - 5000)
    state.onWrite = (path) => {
      if (path === paths.session('me')) {
        other(state, 'x', T + 1)
        other(state, 'y', T + 2)
        other(state, 'z', T + 3)
        other(state, 'w', T + 4)
      }
    }
    expect((await tuneIn(state.io, mine())).status).toBe('on')
    expect(stored(state)).toBeDefined()
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

  it('writes the record with a new checkedInAt and counts who is on air', async () => {
    const state = fake()
    other(state, 'a', T - 5000)
    alive(state)
    await tuneIn(state.io, mine())
    state.runs.length = 0
    state.now = T + 10_000
    alive(state)
    const result = await checkIn(state.io, mine(), T)
    expect(result).toEqual({ closed: false, onAir: 2 })
    expect(stored(state)).toMatchObject({ tunedInAt: T, checkedInAt: T + 10_000 })
    expect(state.runs).toEqual([])
  })

  it('removes the record when the window was closed after it tuned in', async () => {
    const state = fake()
    await tuneIn(state.io, mine())
    state.files.set(paths.control, JSON.stringify({ v: 1, closedAt: T }))
    state.now = T + 10_000
    expect(await checkIn(state.io, mine(), T)).toEqual({ closed: true, onAir: 0 })
    expect(stored(state)).toBeUndefined()
  })

  it('ignores a close from before it tuned in, and a control file it cannot read', async () => {
    const state = fake()
    alive(state)
    await tuneIn(state.io, mine())
    state.files.set(paths.control, JSON.stringify({ v: 1, closedAt: T - 1 }))
    expect((await checkIn(state.io, mine(), T)).closed).toBe(false)
    state.files.set(paths.control, '{broken')
    expect((await checkIn(state.io, mine(), T)).closed).toBe(false)
    state.files.set(paths.control, JSON.stringify({ closedAt: T + 5 }))
    expect((await checkIn(state.io, mine(), T)).closed).toBe(false)
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
    expect((await checkIn(state.io, mine(), T)).closed).toBe(false)
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
