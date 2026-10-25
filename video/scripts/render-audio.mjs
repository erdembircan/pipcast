// Renders the video's soundtrack and its sound effects to public/audio/*.wav
// (music.wav and sfx-<name>.wav, 16-bit, 48 kHz, stereo).
//
// The same way scripts/render-jingles.mjs renders the product's jingles: a small
// local server hands headless Chrome a page that loads scripts/music/score.js,
// renders each sound offline with Web Audio, encodes it as a WAV and posts it
// back. (--dump-dom does not wait for an offline audio render, so the page
// reports back instead.) The soundtrack follows src/timeline.ts, which is
// passed to the page as JSON.
//
//   node scripts/render-audio.mjs        renders everything
//   import { renderAudio } from './render-audio.mjs'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import * as timeline from '../src/timeline.ts'

const video = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chrome = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const sfxNames = ['click', 'whoosh', 'pop', 'key', 'thunk', 'swoosh-up']
const sampleRate = 48000
const timeoutMs = 600_000

// A WAV is scaled down only when its peak is above 0.891 (-1 dBFS), never up:
// the score and the sound effects set their own levels.
const page = (plan) => `<!doctype html>
<html><head><meta charset="utf-8"><title>audio</title>
<script src="/score.js"></script></head>
<body>
<script>
function wav(buf) {
  var ch = 2, n = buf.length, sr = buf.sampleRate, peak = 0, i, c;
  var data = [];
  for (c = 0; c < ch; c++) { data.push(buf.getChannelData(c)); }
  for (c = 0; c < ch; c++) { for (i = 0; i < n; i++) { var a = Math.abs(data[c][i]); if (a > peak) { peak = a; } } }
  var gain = peak > 0.891 ? 0.891 / peak : 1;
  var bytes = 44 + n * ch * 2, ab = new ArrayBuffer(bytes), v = new DataView(ab), o = 0;
  function s(str) { for (var k = 0; k < str.length; k++) { v.setUint8(o++, str.charCodeAt(k)); } }
  s('RIFF'); v.setUint32(o, bytes - 8, true); o += 4; s('WAVE'); s('fmt '); v.setUint32(o, 16, true); o += 4;
  v.setUint16(o, 1, true); o += 2; v.setUint16(o, ch, true); o += 2; v.setUint32(o, sr, true); o += 4;
  v.setUint32(o, sr * ch * 2, true); o += 4; v.setUint16(o, ch * 2, true); o += 2; v.setUint16(o, 16, true); o += 2;
  s('data'); v.setUint32(o, n * ch * 2, true); o += 4;
  for (i = 0; i < n; i++) {
    for (c = 0; c < ch; c++) {
      var x = Math.max(-1, Math.min(1, data[c][i] * gain));
      v.setInt16(o, Math.round(x < 0 ? x * 32768 : x * 32767), true); o += 2;
    }
  }
  return ab;
}
function post(name, buf) {
  return fetch('/save?name=' + encodeURIComponent(name), { method: 'POST', body: wav(buf) });
}
function fail(e) {
  return fetch('/fail', { method: 'POST', body: String((e && e.stack) || e) });
}
window.addEventListener('error', function (ev) { fail(ev.message); });
var plan = ${JSON.stringify(plan)};
var names = ${JSON.stringify(sfxNames)};
var started = Date.now();
renderSoundtrack(plan, ${sampleRate}).then(function (buf) {
  var r = window.mixReport || {};
  return fetch('/log', { method: 'POST', body: 'music.wav rendered in ' + ((Date.now() - started) / 1000).toFixed(1) + ' s (mix ' + r.measuredLufs + ' LUFS, set ' + r.gainDb + ' dB, limiter at most ' + r.limiterDb + ' dB, result ' + r.resultLufs + ' LUFS)' })
    .then(function () { return post('music.wav', buf); });
}).then(function () {
  var chain = Promise.resolve();
  names.forEach(function (name) {
    chain = chain.then(function () {
      return renderSfx(name, ${sampleRate}).then(function (buf) { return post('sfx-' + name + '.wav', buf); });
    });
  });
  return chain;
}).catch(fail);
</script></body></html>
`

export async function renderAudio() {
  const plan = JSON.parse(JSON.stringify({ ...timeline }))
  const files = ['music', ...sfxNames.map((name) => `sfx-${name}`)]
  const work = mkdtempSync(join(tmpdir(), 'pipcast-audio-'))
  const received = new Map()
  let browser = null
  let server = null
  let timer = null

  function stop() {
    clearTimeout(timer)
    if (browser && browser.exitCode === null && browser.signalCode === null) {
      // Chrome leads its own process group (detached): the signal reaches its helpers too
      for (const signal of ['SIGTERM']) {
        try {
          process.kill(-browser.pid, signal)
        } catch {
          browser.kill(signal)
        }
      }
      setTimeout(() => {
        try {
          process.kill(-browser.pid, 'SIGKILL')
        } catch {
          /* gone already */
        }
      }, 3000).unref()
    }
    server?.close()
    server?.closeAllConnections()
  }
  function clean() {
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
  }
  const onSignal = () => {
    stop()
    clean()
    process.exit(1)
  }
  process.on('SIGINT', onSignal)
  process.on('SIGTERM', onSignal)

  try {
    await new Promise((resolveDone, rejectDone) => {
      timer = setTimeout(() => {
        rejectDone(new Error('timed out waiting for the audio'))
      }, timeoutMs)
      server = createServer((req, res) => {
        const url = new URL(req.url ?? '/', 'http://127.0.0.1')
        if (req.method === 'POST') {
          const chunks = []
          req.on('data', (chunk) => chunks.push(chunk))
          req.on('end', () => {
            const body = Buffer.concat(chunks)
            res.end('ok')
            if (url.pathname === '/fail') {
              rejectDone(new Error(`the page failed: ${body.toString()}`))
              return
            }
            if (url.pathname === '/log') {
              console.log(body.toString())
              return
            }
            const saved = url.searchParams.get('name')
            if (saved !== null) {
              received.set(saved.replace(/\.wav$/, ''), body)
            }
            if (files.every((name) => received.has(name))) {
              resolveDone(undefined)
            }
          })
          return
        }
        if (url.pathname === '/score.js') {
          res.setHeader('content-type', 'text/javascript')
          res.end(readFileSync(join(video, 'scripts/music/score.js')))
        } else {
          res.setHeader('content-type', 'text/html')
          res.end(page(plan))
        }
      })
      server.listen(0, '127.0.0.1', () => {
        const address = server.address()
        browser = spawn(
          chrome,
          [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--autoplay-policy=no-user-gesture-required',
            `--user-data-dir=${join(work, 'profile')}`,
            `http://127.0.0.1:${address.port}/`,
          ],
          { stdio: 'ignore', detached: true },
        )
        browser.on('error', rejectDone)
        browser.on('exit', (code, signal) => {
          if (!files.every((name) => received.has(name))) {
            rejectDone(new Error(`Chrome stopped early (${signal ?? code})`))
          }
        })
      })
    })

    const out = join(video, 'public/audio')
    mkdirSync(out, { recursive: true })
    for (const name of files) {
      writeFileSync(join(out, `${name}.wav`), received.get(name))
      console.log(`public/audio/${name}.wav`)
    }
  } finally {
    process.off('SIGINT', onSignal)
    process.off('SIGTERM', onSignal)
    const alive = browser && browser.exitCode === null && browser.signalCode === null
    stop()
    if (alive) {
      await new Promise((done) => browser.once('exit', done))
    }
    clean()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await renderAudio()
}
