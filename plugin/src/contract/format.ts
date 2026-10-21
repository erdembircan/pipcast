// How numbers and times read on air: "+1,546 −368", "14:32", "9 min".
// Times are the Mac's local time, 24-hour.

const MINUS = '−'

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export function thousands(n: number): string {
  const digits = String(Math.round(Math.abs(n)))
  let out = ''
  for (let i = 0; i < digits.length; i += 1) {
    const left = digits.length - i
    out += digits.charAt(i)
    if (left > 1 && left % 3 === 1) {
      out += ','
    }
  }
  return out
}

// Lines changed, the way the wall monitor shows them: "+182 −40"
export function figure(added: number, removed: number): string {
  return `+${thousands(added)} ${MINUS}${thousands(removed)}`
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n)
}

// "14:32"
export function clock(ms: number): string {
  const d = new Date(ms)
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

// The start of the hour that holds `ms`, in ms
export function hourStart(ms: number): number {
  const d = new Date(ms)
  d.setMinutes(0, 0, 0)
  return d.getTime()
}

// "15:00"
export function hourLabel(ms: number): string {
  return `${pad2(new Date(ms).getHours())}:00`
}

// "2026-10-21T14": the key of the hour that holds `ms`
export function hourKey(ms: number): string {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}`
}

export function wholeMinutes(ms: number): number {
  return Math.max(0, Math.floor(ms / 60_000))
}

// How long a turn ran: "42 s", "9 min", "2 h", "1 h 48 min"
export function duration(ms: number): string {
  const seconds = Math.max(1, Math.round(ms / 1000))
  if (seconds < 60) {
    return `${seconds} s`
  }
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) {
    return `${minutes} min`
  }
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

// How long a story has waited, as the wall monitor counts it: "0:12", "27:05", "1 h 3 min"
export function waited(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}:${pad2(seconds % 60)}`
  }
  const minutes = Math.floor(seconds / 60)
  const rest = minutes % 60
  const hours = Math.floor(minutes / 60)
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
