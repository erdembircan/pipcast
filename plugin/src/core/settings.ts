// Pipcast's own options, saved and read through Claude Code's
// `claude plugin configure`, the command the desktop app's plugin settings run

import { installedId, readBoolean, wasSaved } from './options.ts'
import type { Io } from './services.ts'

const ENGINE_MS = 60_000

// Where Claude Code keeps the plugin's options: the id they are kept under,
// and the command line that starts the engine for it
export interface OptionsHome {
  id: string
  argv: readonly string[]
}

// Null when Claude Code cannot list its plugins
export async function optionsHome(io: Io, engine: string, root: string, name: string): Promise<OptionsHome | null> {
  const listed = await io.run([engine, 'plugin', 'list', '--json'], undefined, ENGINE_MS)
  if (listed.exitCode !== 0) {
    return null
  }
  const id = installedId(listed.stdout, root)
  return id === null ? { id: `${name}@inline`, argv: [engine, '--plugin-dir', root] } : { id, argv: [engine] }
}

// What Claude Code has saved for a boolean option; null when it cannot be read
export async function readOption(io: Io, home: OptionsHome, key: string): Promise<boolean | null> {
  const answer = await io.run([...home.argv, 'plugin', 'configure', '--json', '--', home.id], undefined, ENGINE_MS)
  return answer.exitCode === 0 ? readBoolean(answer.stdout, key) : null
}

// Saves a boolean option; true once Claude Code says it is saved
export async function writeOption(io: Io, home: OptionsHome, key: string, on: boolean): Promise<boolean> {
  const values = JSON.stringify({ [key]: on ? 'true' : 'false' })
  const answer = await io.run([...home.argv, 'plugin', 'configure', '--json', '--values-stdin', '--', home.id], undefined, ENGINE_MS, values)
  return answer.exitCode === 0 && wasSaved(answer.stdout, key)
}
