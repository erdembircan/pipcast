// The session's title as the engine keeps it. The engine writes the title to a
// small file beside the session's transcript the moment it changes, and reads
// it back itself; the mod reads the same file.

import type { Io } from './services.ts'

// How often a tuned-in session reads the title file. Only the mod uses it, so
// it lives here and not in the contract, which the broadcast bundles.
export const TITLE_CHECK_MS = 60_000

// `<the transcript's folder>/<session id>/custom-title.json`
export function titleFilePath(transcriptDir: string, id: string): string {
  return `${transcriptDir}/${id}/custom-title.json`
}

// The folder of the session's transcript, from the transcript's path; null for
// any other file, a subagent's transcript among them
export function transcriptDirOf(path: string, id: string): string | null {
  const name = `/${id}.jsonl`
  return id !== '' && path.endsWith(name) ? path.slice(0, path.length - name.length) : null
}

// What the title file says: its title, trimmed; null when there is no file or
// no title in it; undefined when the file does not parse, caught half-written,
// so the title stays as it was
export function parseTitleFile(text: string | null): string | null | undefined {
  if (text === null) {
    return null
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return undefined
  }
  const title = typeof parsed === 'object' && parsed !== null ? (parsed as { customTitle?: unknown }).customTitle : undefined
  return typeof title === 'string' && title.trim() !== '' ? title.trim() : null
}

export async function readTitleFile(io: Io, transcriptDir: string, id: string): Promise<string | null | undefined> {
  return parseTitleFile(await io.read(titleFilePath(transcriptDir, id)))
}

// The folder of the session's transcript, found under the engine's projects
// folder; null when it is not there, or find cannot say. What find printed
// counts even when it also met a folder it could not read.
export async function findTranscriptDir(io: Io, id: string): Promise<string | null> {
  try {
    const projects = `${await io.claudeConfigDir()}/projects`
    const found = await io.run(['/usr/bin/find', projects, '-maxdepth', '2', '-name', `${id}.jsonl`, '-print', '-quit'])
    const path = found.stdout.split('\n')[0]?.trim() ?? ''
    return path === '' ? null : transcriptDirOf(path, id)
  } catch {
    return null
  }
}
