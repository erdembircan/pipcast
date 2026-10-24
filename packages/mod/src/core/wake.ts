// Will the work a session started wake it again? A Stop lists every task the
// engine has in flight as `background_tasks`, not only work the session waits
// on: the engine's own housekeeping, teammates and cloud sessions that may sit
// idle, and a live connection to every artifact the session watches. Only a
// task whose running means work that will end and wake the session counts,
// and a command left running in the background counts only while it works
// (shells.ts).

import { isTaskId } from './shells.ts'
import type { Shell } from './shells.ts'

// The engine's labels (`type`) for that work. A `monitor` counts only when it
// names its MCP server: the artifact connections are monitors with none.
const WAKING: ReadonlySet<string> = new Set(['shell', 'subagent', 'workflow', 'MCP task'])

// What a Stop says is still to come
export interface StopWork {
  background_tasks?: readonly unknown[]
  session_crons?: readonly unknown[]
}

// What a turn that ends may still be woken by: the commands it left running
// in the background, and whether other work will wake it
export interface Waiting {
  shells: readonly Shell[]
  // A subagent, a workflow, an MCP task or an MCP server's monitor, a
  // scheduled wake-up, or a background command no look can find
  others: boolean
}

// One of a Stop's background tasks: work that will end and wake the session
export function wakes(task: unknown): boolean {
  if (typeof task !== 'object' || task === null) {
    return false
  }
  const { type, server } = task as { type?: unknown; server?: unknown }
  if (typeof type !== 'string') {
    return false
  }
  return WAKING.has(type) || (type === 'monitor' && typeof server === 'string' && server !== '')
}

// One of a Stop's background tasks as a command a look can find; null for any
// other task, and for a command without a task id the look can use
export function shellOf(task: unknown): Shell | null {
  if (typeof task !== 'object' || task === null) {
    return null
  }
  const { type, id, command } = task as { type?: unknown; id?: unknown; command?: unknown }
  if (type !== 'shell' || typeof id !== 'string' || !isTaskId(id)) {
    return null
  }
  return { id, command: typeof command === 'string' ? command : '' }
}

// What a Stop leaves the session waiting on
export function waitsOn(stop: StopWork): Waiting {
  const shells: Shell[] = []
  let others = (stop.session_crons?.length ?? 0) > 0
  for (const task of stop.background_tasks ?? []) {
    const shell = shellOf(task)
    if (shell !== null) {
      shells.push(shell)
    } else if (wakes(task)) {
      others = true
    }
  }
  return { shells, others }
}
