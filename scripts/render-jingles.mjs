// Renders the design system's four jingles to plugin/station/sounds/*.m4a.
// A small local server hands headless Chrome a page that renders each score
// offline with PipNews.renderJingle, encodes it as a WAV and posts it back;
// afconvert turns each WAV into AAC. (--dump-dom does not wait for an offline
// audio render, so the page reports back instead.)
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const chrome = process.env.CHROME_BIN ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const names = ['breaking', 'breaking-out', 'hour', 'hour-out']
const sampleRate = 48000
const timeoutMs = 120_000

// A WAV is scaled down only when its peak is above 0.891 (-1 dBFS), never up,
// so the levels stay as the design composed them.
const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>jingles</title>
<script src="/react.js"></script>
<script src="/bundle.js"></script></head>
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
      v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true); o += 2;
    }
  }
  return ab;
}
var names = ${JSON.stringify(names)};
var chain = Promise.resolve();
names.forEach(function (name) {
  chain = chain.then(function () {
    return PipNews.renderJingle(name, ${sampleRate}).then(function (buf) {
      return fetch('/save?name=' + name + '.wav', { method: 'POST', body: wav(buf) });
    });
  });
});
chain.catch(function (e) {
  return fetch('/fail', { method: 'POST', body: String(e) });
});
</script></body></html>
`

const work = mkdtempSync(join(tmpdir(), 'pipcast-jingles-'))
const received = new Map()
let browser = null
let server = null
let timer = null

function stop() {
  clearTimeout(timer)
  browser?.kill()
  server?.close()
  server?.closeAllConnections()
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop()
    rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    process.exit(1)
  })
}

try {
  await new Promise((resolveDone, rejectDone) => {
    timer = setTimeout(() => {
      rejectDone(new Error('timed out waiting for the jingles'))
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
          const saved = url.searchParams.get('name')
          if (saved !== null) {
            received.set(saved.replace(/\.wav$/, ''), body)
          }
          if (names.every((name) => received.has(name))) {
            resolveDone(undefined)
          }
        })
        return
      }
      if (url.pathname === '/react.js') {
        res.setHeader('content-type', 'text/javascript')
        res.end(readFileSync(join(root, 'node_modules/react/umd/react.production.min.js')))
      } else if (url.pathname === '/bundle.js') {
        res.setHeader('content-type', 'text/javascript')
        res.end(readFileSync(join(root, 'design/components/bundle.js')))
      } else {
        res.setHeader('content-type', 'text/html')
        res.end(page)
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
          `--user-data-dir=${join(work, 'profile')}`,
          `http://127.0.0.1:${address.port}/`,
        ],
        { stdio: 'ignore' },
      )
      browser.on('error', rejectDone)
    })
  })

  const out = join(root, 'plugin/station/sounds')
  mkdirSync(out, { recursive: true })
  for (const name of names) {
    const wavPath = join(work, `${name}.wav`)
    writeFileSync(wavPath, received.get(name))
    execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '160000', wavPath, join(out, `${name}.m4a`)])
    console.log(`${name}.m4a`)
  }
} finally {
  stop()
  await new Promise((done) => (browser?.pid !== undefined && browser.exitCode === null && browser.signalCode === null ? browser.once('exit', done) : done()))
  rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
