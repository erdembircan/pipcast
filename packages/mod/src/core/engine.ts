// Finding the Claude Code program a session runs on, with no shell: the mod
// runs ps with a tag of its own in its arguments, finds that ps in the list it
// prints, and takes its parent, which is the program that started it

// A tag no other process carries: pipcast- and random letters and digits
export function processTag(random: () => number = Math.random): string {
  return `pipcast-${random().toString(36).slice(2)}${random().toString(36).slice(2)}`
}

// The parent of the ps whose command carries the tag, from the list that ps printed
export function parentOf(listing: string, tag: string): number | null {
  for (const line of listing.split('\n')) {
    const [pid, ppid] = line.trim().split(/\s+/)
    if (pid !== undefined && ppid !== undefined && /^\d+$/.test(pid) && /^\d+$/.test(ppid) && line.includes(`command=${tag}`)) {
      return Number(ppid)
    }
  }
  return null
}
