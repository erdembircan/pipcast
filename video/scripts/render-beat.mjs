// Lays KLWD's beat where the station plays it, into public/audio/beat.wav
// (32-bit float, 48 kHz, stereo, as long as the video). For each entry in
// src/timeline.ts's BEDS: the shipped loop from plugin/station/sounds, mixed in
// as its desk starts on the last notes of its line, so that its first downbeat
// lands at full, looped frame for frame, and phased out as its outro starts,
// falling as the square of what is left, or hushed evenly when its story is
// cut. The lengths are the contract's own (BED_IN_MS, BED_OUT_MS, HUSH_MS), so
// the video mixes as the station does. macOS's afconvert decodes the loops.
//
//   node scripts/render-beat.mjs        lays the beat
//   import { renderBeat } from './render-beat.mjs'
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { BED_IN_MS, BED_OUT_MS, HUSH_MS } from '../../packages/contract/src/constants.ts'
import { BEDS, DURATION } from '../src/timeline.ts'

const video = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const root = resolve(video, '..')
const rate = 48000

/** A loop's frames, one array per channel, decoded to 32-bit float */
function decode(file, work) {
  const wav = join(work, 'loop.wav')
  execFileSync('afconvert', ['-f', 'WAVE', '-d', `LEF32@${rate}`, file, wav])
  const b = readFileSync(wav)
  let o = 12
  let fmt = -1
  let data = null
  while (o + 8 <= b.length) {
    const id = b.toString('ascii', o, o + 4)
    const size = b.readUInt32LE(o + 4)
    if (id === 'fmt ') fmt = o + 8
    if (id === 'data') {
      data = { at: o + 8, size }
      break
    }
    o += 8 + size + (size % 2)
  }
  if (fmt < 0 || data === null || b.readUInt16LE(fmt + 14) !== 32 || b.readUInt32LE(fmt + 4) !== rate) {
    throw new Error(`${file} did not decode to 32-bit float at ${rate} Hz`)
  }
  const channels = b.readUInt16LE(fmt + 2)
  const frames = data.size / 4 / channels
  return [0, 1].map((c) => {
    const out = new Float32Array(frames)
    for (let i = 0; i < frames; i++) out[i] = b.readFloatLE(data.at + (i * channels + Math.min(c, channels - 1)) * 4)
    return out
  })
}

/** A stereo WAV of 32-bit float frames */
function write(path, [left, right]) {
  const n = left.length
  const b = Buffer.alloc(44 + n * 8)
  b.write('RIFF', 0)
  b.writeUInt32LE(36 + n * 8, 4)
  b.write('WAVE', 8)
  b.write('fmt ', 12)
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(3, 20)
  b.writeUInt16LE(2, 22)
  b.writeUInt32LE(rate, 24)
  b.writeUInt32LE(rate * 8, 28)
  b.writeUInt16LE(8, 32)
  b.writeUInt16LE(32, 34)
  b.write('data', 36)
  b.writeUInt32LE(n * 8, 40)
  for (let i = 0; i < n; i++) {
    b.writeFloatLE(left[i], 44 + i * 8)
    b.writeFloatLE(right[i], 48 + i * 8)
  }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, b)
}

export function renderBeat() {
  const work = mkdtempSync(join(tmpdir(), 'pipcast-beat-'))
  try {
    const loops = {}
    for (const { bed } of BEDS) loops[bed] ??= decode(join(root, `plugin/station/sounds/${bed}.caf`), work)
    const n = Math.round(DURATION * rate)
    const track = [new Float32Array(n), new Float32Array(n)]
    const rise = Math.round((BED_IN_MS / 1000) * rate)
    for (const entry of BEDS) {
      const loop = loops[entry.bed]
      const turn = loop[0].length
      const cut = 'cut' in entry && entry.cut
      const start = Math.round(entry.from * rate)
      const going = Math.round(entry.until * rate)
      const fall = Math.round(((cut ? HUSH_MS : BED_OUT_MS) / 1000) * rate)
      for (let i = start; i < Math.min(n, going + fall); i++) {
        const k = i - start
        let gain = k < rise ? k / rise : 1
        if (i >= going) {
          const done = (i - going) / fall
          gain *= cut ? 1 - done : (1 - done) * (1 - done)
        }
        // It mixes in on the turn's last notes, so the downbeat comes round as it reaches full
        const at = (turn - rise + k) % turn
        track[0][i] += gain * loop[0][at]
        track[1][i] += gain * loop[1][at]
      }
    }
    write(join(video, 'public/audio/beat.wav'), track)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) renderBeat()
