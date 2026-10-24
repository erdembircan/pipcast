import { describe, expect, it } from 'vitest'

import type { Io, RunResult } from '../src/core/services.ts'
import { findTranscriptDir, parseTitleFile, readTitleFile, titleFilePath, transcriptDirOf } from '../src/core/title.ts'

const DIR = '/cfg/projects/-work-proj'
const ID = '8253106f-ce3e-4af6-824a-21845bad3955'
const FILE = `${DIR}/${ID}/custom-title.json`

// Only what the title needs: read, run and the config folder
function fake(files: Record<string, string>, found: RunResult | Error) {
  const reads: string[] = []
  const runs: (readonly string[])[] = []
  const io = {
    read: async (path: string) => {
      reads.push(path)
      return files[path] ?? null
    },
    run: async (argv: readonly string[]) => {
      runs.push(argv)
      if (found instanceof Error) {
        throw found
      }
      return found
    },
    claudeConfigDir: async () => '/cfg',
  } as unknown as Io
  return { io, reads, runs }
}

describe('titleFilePath', () => {
  it('is custom-title.json in the folder named for the session, beside its transcript', () => {
    expect(titleFilePath(DIR, ID)).toBe(FILE)
  })
})

describe('transcriptDirOf', () => {
  it('is the folder of the session transcript', () => {
    expect(transcriptDirOf(`${DIR}/${ID}.jsonl`, ID)).toBe(DIR)
  })

  it('is null for a subagent transcript, another session or no id', () => {
    expect(transcriptDirOf(`${DIR}/${ID}/subagents/agent-a1.jsonl`, ID)).toBeNull()
    expect(transcriptDirOf(`${DIR}/0b6c1e2a.jsonl`, ID)).toBeNull()
    expect(transcriptDirOf(`${DIR}/${ID}.jsonl`, '')).toBeNull()
  })
})

describe('parseTitleFile', () => {
  it('reads the title, trimmed', () => {
    expect(parseTitleFile('{"customTitle":"  Fix the ticker  "}')).toBe('Fix the ticker')
  })

  it('is null with no file or no title in it', () => {
    expect(parseTitleFile(null)).toBeNull()
    for (const text of ['{}', '{"customTitle":""}', '{"customTitle":"   "}', '{"customTitle":5}', '[]', 'null', '"Fix"']) {
      expect(parseTitleFile(text)).toBeNull()
    }
  })

  it('is undefined for a file that does not parse, caught half-written', () => {
    expect(parseTitleFile('{"customTitle":"Fix the')).toBeUndefined()
    expect(parseTitleFile('')).toBeUndefined()
  })
})

describe('readTitleFile', () => {
  it('reads the one file and starts no process', async () => {
    const { io, reads, runs } = fake({ [FILE]: '{"customTitle":"Renamed"}' }, new Error('no process'))
    expect(await readTitleFile(io, DIR, ID)).toBe('Renamed')
    expect(reads).toEqual([FILE])
    expect(runs).toEqual([])
  })

  it('is null when the file is missing', async () => {
    const { io } = fake({}, new Error('no process'))
    expect(await readTitleFile(io, DIR, ID)).toBeNull()
  })
})

describe('findTranscriptDir', () => {
  it('looks two levels down the config folder projects and stops at the first', async () => {
    const { io, runs } = fake({}, { exitCode: 0, stdout: `${DIR}/${ID}.jsonl\n`, stderr: '' })
    expect(await findTranscriptDir(io, ID)).toBe(DIR)
    expect(runs).toEqual([['/usr/bin/find', '/cfg/projects', '-maxdepth', '2', '-name', `${ID}.jsonl`, '-print', '-quit']])
  })

  it('takes what find printed even when it also met a folder it could not read', async () => {
    const { io } = fake({}, { exitCode: 1, stdout: `${DIR}/${ID}.jsonl\n`, stderr: 'find: /cfg/projects/x: Permission denied' })
    expect(await findTranscriptDir(io, ID)).toBe(DIR)
  })

  it('is null when nothing is found or find cannot run', async () => {
    expect(await findTranscriptDir(fake({}, { exitCode: 0, stdout: '', stderr: '' }).io, ID)).toBeNull()
    expect(await findTranscriptDir(fake({}, { exitCode: 1, stdout: '', stderr: 'No such file or directory' }).io, ID)).toBeNull()
    expect(await findTranscriptDir(fake({}, new Error('spawn failed')).io, ID)).toBeNull()
  })
})
