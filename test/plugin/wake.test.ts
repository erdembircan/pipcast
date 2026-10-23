import { describe, expect, it } from 'vitest'

import { shellOf, waitsOn, wakes } from '../../plugin/src/core/wake.ts'

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

describe('shellOf', () => {
  it('takes a background command\'s task id and the line it runs', () => {
    expect(shellOf(shell)).toEqual({ id: 'b8d2k1q9z', command: 'sleep 1800' })
    expect(shellOf({ ...shell, command: undefined })).toEqual({ id: 'b8d2k1q9z', command: '' })
  })

  it('is null for every other task, and for a command without a task id a look can use', () => {
    for (const task of [subagent, workflow, mcpTask, mcpMonitor, artifactWatch, dream, cron, { ...shell, id: '' }, { ...shell, id: '../x' }, { ...shell, id: 7 }, null, 'shell']) {
      expect(shellOf(task)).toBeNull()
    }
  })
})

describe('waitsOn', () => {
  it('waits on nothing when nothing is in flight', () => {
    expect(waitsOn({})).toEqual({ shells: [], others: false })
    expect(waitsOn({ background_tasks: [], session_crons: [] })).toEqual({ shells: [], others: false })
  })

  it('waits on nothing for a session that only watches artifacts and keeps house', () => {
    expect(waitsOn({ background_tasks: [artifactWatch, artifactWatch, dream, scan, teammate, cloud], session_crons: [] })).toEqual({ shells: [], others: false })
  })

  it('lists the commands left running in the background, for a look at them', () => {
    const server = { ...shell, id: 'b1devsrv0', description: 'Start the dev server', command: 'npm run dev' }
    expect(waitsOn({ background_tasks: [artifactWatch, shell, dream, server] })).toEqual({
      shells: [
        { id: 'b8d2k1q9z', command: 'sleep 1800' },
        { id: 'b1devsrv0', command: 'npm run dev' },
      ],
      others: false,
    })
  })

  it('waits on other work that will wake the session, beside any commands', () => {
    for (const task of [subagent, workflow, mcpTask, mcpMonitor]) {
      expect(waitsOn({ background_tasks: [shell, task] })).toEqual({ shells: [{ id: 'b8d2k1q9z', command: 'sleep 1800' }], others: true })
    }
  })

  it('waits on a scheduled wake-up, whatever else is listed', () => {
    expect(waitsOn({ background_tasks: [artifactWatch], session_crons: [cron] })).toEqual({ shells: [], others: true })
    expect(waitsOn({ session_crons: [cron] })).toEqual({ shells: [], others: true })
  })

  it('counts a command without a task id a look can use as work no look can clear', () => {
    expect(waitsOn({ background_tasks: [{ ...shell, id: '' }] })).toEqual({ shells: [], others: true })
  })
})
