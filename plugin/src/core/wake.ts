// Will the work a session started wake it again? A Stop lists every task the
// engine has in flight as `background_tasks`, not only work the session waits
// on: the engine's own housekeeping, teammates and cloud sessions that may sit
// idle, and a live connection to every artifact the session watches. Only a
// task whose running means work that will end and wake the session counts.

// The engine's labels (`type`) for that work. A `monitor` counts only when it
// names its MCP server: the artifact connections are monitors with none.
const WAKING: ReadonlySet<string> = new Set(['shell', 'subagent', 'workflow', 'MCP task'])

// What a Stop says is still to come
export interface StopWork {
  background_tasks?: readonly unknown[]
  session_crons?: readonly unknown[]
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

// The session will wake again: work it started is running, or a wake-up is scheduled
export function willWake(stop: StopWork): boolean {
  return (stop.session_crons?.length ?? 0) > 0 || (stop.background_tasks ?? []).some(wakes)
}
