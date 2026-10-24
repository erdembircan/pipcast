import { describe, expect, it } from 'vitest'

import { optionsHome, readOption, writeOption } from '../../plugin/src/core/settings.ts'
import type { Io, RunResult } from '../../plugin/src/core/services.ts'

const ENGINE = '/apps/claude'
const ROOT = '/dev/pipcast-live/plugin'

interface Call {
  argv: readonly string[]
  stdin: string | undefined
}

// An Io whose commands all answer with one function, recording each call
function fakeIo(answer: (argv: readonly string[]) => RunResult): { io: Io; calls: Call[] } {
  const calls: Call[] = []
  const io: Io = {
    now: async () => 0,
    storeHome: async () => '/store',
    claudeConfigDir: async () => '/cfg',
    read: async () => null,
    stat: async () => null,
    write: async () => undefined,
    remove: async () => undefined,
    list: async () => [],
    run: async (argv, _cwd, _timeoutMs, stdin) => {
      calls.push({ argv, stdin })
      return answer(argv)
    },
    stationBinary: async () => '/station',
    stationAssets: () => '/assets',
    targetBundleId: async () => null,
  }
  return { io, calls }
}

const ok = (stdout: string): RunResult => ({ exitCode: 0, stdout, stderr: '' })
const refused: RunResult = { exitCode: 1, stdout: '', stderr: 'refused' }

describe('optionsHome', () => {
  it('finds the id Claude Code installed this copy under, by the folder it is read from', async () => {
    const { io } = fakeIo(() => ok(JSON.stringify([{ id: 'other@market', readFromFolder: '/x' }, { id: 'pipcast@pipcast', readFromFolder: ROOT }])))
    expect(await optionsHome(io, ENGINE, ROOT, 'pipcast')).toEqual({ id: 'pipcast@pipcast', argv: [ENGINE] })
  })

  it('reaches a copy Claude Code did not install as <name>@inline, with --plugin-dir', async () => {
    const { io, calls } = fakeIo(() => ok('[]'))
    expect(await optionsHome(io, ENGINE, ROOT, 'pipcast')).toEqual({ id: 'pipcast@inline', argv: [ENGINE, '--plugin-dir', ROOT] })
    expect(calls[0]?.argv).toEqual([ENGINE, 'plugin', 'list', '--json'])
  })

  it('gives up when Claude Code cannot list its plugins', async () => {
    const { io } = fakeIo(() => refused)
    expect(await optionsHome(io, ENGINE, ROOT, 'pipcast')).toBeNull()
  })
})

describe('readOption and writeOption', () => {
  const home = { id: 'pipcast@pipcast', argv: [ENGINE] }

  it('read what configure --json says the field holds', async () => {
    const { io, calls } = fakeIo(() => ok(JSON.stringify({ inputs: { autoTuneIn: 'true' } })))
    expect(await readOption(io, home, 'autoTuneIn')).toBe(true)
    expect(calls[0]?.argv).toEqual([ENGINE, 'plugin', 'configure', '--json', '--', 'pipcast@pipcast'])
  })

  it('save the value as a string on standard input, and say whether it was saved', async () => {
    const { io, calls } = fakeIo(() => ok(JSON.stringify({ saved: ['autoTuneIn'] })))
    expect(await writeOption(io, home, 'autoTuneIn', false)).toBe(true)
    expect(calls[0]?.argv).toEqual([ENGINE, 'plugin', 'configure', '--json', '--values-stdin', '--', 'pipcast@pipcast'])
    expect(calls[0]?.stdin).toBe(JSON.stringify({ autoTuneIn: 'false' }))
  })

  it('report a refused save or read', async () => {
    const { io } = fakeIo(() => refused)
    expect(await writeOption(io, home, 'autoTuneIn', true)).toBe(false)
    expect(await readOption(io, home, 'autoTuneIn')).toBeNull()
  })
})
