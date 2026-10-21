import { describe, expect, it } from 'vitest'

import { wakes, willWake } from '../../plugin/src/core/wake.ts'

// Tasks as a Stop lists them (BackgroundTaskSummary), labelled as the engine labels them
const shell = { id: 'b8d2k1q9z', type: 'shell', status: 'running', description: 'Thirty-minute check-in timer', command: 'sleep 1800' }
const subagent = { id: 'a3f9c2m7x', type: 'subagent', status: 'running', description: 'Implement the fix', agent_type: 'implementer' }
const workflow = { id: 'w5h1n8r2c', type: 'workflow', status: 'running', description: 'Review the change', name: 'review-changes' }
const mcpTask = { id: 'k7t4e6p1b', type: 'MCP task', status: 'pending', description: 'Render the deck', server: 'slides', tool: 'render' }
const mcpMonitor = { id: 'm2v9s4d6f', type: 'monitor', status: 'running', description: 'Watch the deploy', server: 'ci', tool: 'watch' }
const artifactWatch = { id: 's4j8w2n6q', type: 'monitor', status: 'running', description: 'PiP Newsroom · Station' }
const dream = { id: 'd9x3b7k1m', type: 'dream', status: 'running', description: 'Consolidating memory' }
const scan = { id: 'e6c2v8h4t', type: 'auto-mode scan', status: 'running', description: 'Auto-mode scan' }
const memoryImport = { id: 'n1p5z9r3y', type: 'memory import', status: 'pending', description: 'Importing memory' }
const teammate = { id: 't8f2l6q0w', type: 'teammate', status: 'running', description: 'scout@team' }
const cloud = { id: 'r3m7c1k5j', type: 'cloud session', status: 'running', description: 'Long-running session' }
const cron = { id: 'cron-1', schedule: '*/5 * * * *', recurring: true, prompt: 'Check the build' }

describe('wakes', () => {
  it('counts work the session started, which ends and wakes it', () => {
    for (const task of [shell, subagent, workflow, mcpTask, mcpMonitor]) {
      expect(wakes(task)).toBe(true)
    }
  })

  it('leaves out the artifact watches, the housekeeping and helpers that may sit idle', () => {
    for (const task of [artifactWatch, dream, scan, memoryImport, teammate, cloud]) {
      expect(wakes(task)).toBe(false)
    }
  })

  it('leaves out a monitor whose server is empty, a kind it does not know, and anything malformed', () => {
    for (const task of [{ ...artifactWatch, server: '' }, { ...shell, type: 'something-new' }, { ...shell, type: 3 }, {}, null, 'shell', 7]) {
      expect(wakes(task)).toBe(false)
    }
  })
})

describe('willWake', () => {
  it('is false when nothing is in flight', () => {
    expect(willWake({})).toBe(false)
    expect(willWake({ background_tasks: [], session_crons: [] })).toBe(false)
  })

  it('is false for a session that only watches artifacts and keeps house', () => {
    expect(willWake({ background_tasks: [artifactWatch, artifactWatch, dream, scan], session_crons: [] })).toBe(false)
  })

  it('is true once one task wakes it, among any others', () => {
    expect(willWake({ background_tasks: [artifactWatch, dream, shell] })).toBe(true)
    expect(willWake({ background_tasks: [subagent] })).toBe(true)
  })

  it('is true for a scheduled wake-up, whatever else is listed', () => {
    expect(willWake({ background_tasks: [artifactWatch], session_crons: [cron] })).toBe(true)
    expect(willWake({ session_crons: [cron] })).toBe(true)
  })
})
