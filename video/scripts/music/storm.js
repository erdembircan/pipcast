/* The sound of KLWD WEATHER's promo: the storm and the score over it, as one
   stem. A browser-side script, no imports, loaded after score.js, whose synth
   and mix it plays through (window.scoreKit):

     renderStorm(plan, sampleRate) -> Promise<AudioBuffer>, stereo,
                                      plan.DURATION seconds

   `plan` is src/promo/timeline.ts. The score is written by hand against it,
   in D minor, the key of WEATHER ALERT and BREAKING NEWS, and ends in D major
   as the storm clears, on the jingles' own warm chord and the station's
   four-note logo on the bells, A D A D.

   It never plays over KLWD's own sound: under WEATHER ALERT, the beat and the
   outro it holds a low D (no third, no rhythm), as the demo's soundtrack does
   under a jingle; under the forecast's beat a dark pad in D minor.

   Two new instruments, in the jingles' manner (noise through filters):
     rain     a bed of rain from a list of levels: the hiss of the drops, the
              body of the downpour, and a patter of single drops
     thunder  the rumble rolling away in lumps, each swelling in (no crack,
              no hit: nothing in it lands as a punch)
*/
(function () {
  'use strict';

  const root = window;
  const K = root.scoreKit;
  const seeded = K.seeded, clamp = K.clamp;

  /* the two new buses: no lowpass of the score's, no ducking */
  K.BUS.rain = { level: 0.42, hp: 60 };
  K.BUS.thunder = { level: 1.0, hp: 24, hall: 0.22 };
  K.STEM.rain = 'rain';
  K.STEM.thunder = 'thunder';
  /* the promo is set a little louder than the demo's music, and the jingles sit on it as they come */
  K.TARGET.lufs = -17.5;

  function loopNoise(m, seed, seconds) {
    const ctx = m.ctx;
    const rnd = seeded(seed);
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = rnd() * 2 - 1; }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    return s;
  }
  /* single drops: a sparse train of clicks of every size */
  function dropsNoise(m, seed, seconds, perSecond) {
    const ctx = m.ctx;
    const rnd = seeded(seed);
    const n = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    const count = Math.floor(seconds * perSecond);
    for (let k = 0; k < count; k++) {
      const at = Math.floor(rnd() * (n - 400));
      const a = Math.pow(rnd(), 2.2) * (rnd() < 0.5 ? -1 : 1);
      const len = 30 + Math.floor(rnd() * 160);
      for (let i = 0; i < len; i++) { d[at + i] += a * Math.exp(-i / (len * 0.25)) * (rnd() * 2 - 1); }
    }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    return s;
  }
  function filt(ctx, type, f, q) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q === undefined ? 0.7 : q;
    return b;
  }

  /* rain: { t, d, pts: [[seconds, level], ...] } */
  function rain(m, e) {
    const ctx = m.ctx;
    const out = K.voice(m, 'rain', 0.08);
    const level = ctx.createGain();
    level.gain.setValueAtTime(0, 0);
    e.pts.forEach(function (p, i) {
      if (i === 0) { level.gain.setValueAtTime(p[1], p[0]); } else { level.gain.linearRampToValueAtTime(p[1], p[0]); }
    });
    level.connect(out);
    [-1, 1].forEach(function (side, i) {
      const pan = ctx.createStereoPanner();
      pan.pan.value = 0.7 * side;
      pan.connect(level);
      /* the hiss */
      const hiss = loopNoise(m, 901 + i, 3.1 + i * 0.7);
      const hb = filt(ctx, 'bandpass', 4200, 0.45);
      const hh = filt(ctx, 'highpass', 1200, 0.5);
      const hg = ctx.createGain();
      hg.gain.value = 0.32;
      hiss.connect(hb); hb.connect(hh); hh.connect(hg); hg.connect(pan);
      /* the downpour's body */
      const body = loopNoise(m, 911 + i, 2.3 + i * 0.9);
      const bl = filt(ctx, 'lowpass', 900, 0.5);
      const bh = filt(ctx, 'highpass', 160, 0.5);
      const bg = ctx.createGain();
      bg.gain.value = 0.42;
      body.connect(bl); bl.connect(bh); bh.connect(bg); bg.connect(pan);
      /* the patter */
      const drops = dropsNoise(m, 921 + i, 2.7 + i * 0.6, 520);
      const db = filt(ctx, 'bandpass', 3000, 0.7);
      const dg = ctx.createGain();
      dg.gain.value = 0.9;
      drops.connect(db); db.connect(dg); dg.connect(pan);
      [hiss, body, drops].forEach(function (s) { s.start(e.t); s.stop(e.t + e.d); });
    });
  }

  /* thunder: { t, v, far: 0 close .. 1 far away, d: how long it rolls, seed } */
  function thunder(m, e) {
    const ctx = m.ctx;
    const rnd = seeded(e.seed || 1);
    const out = K.voice(m, 'thunder', 0);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (rnd() - 0.5) * 0.8;
    pan.connect(out);
    const t = e.t, v = e.v, far = e.far, d = e.d;
    /* the rumble, rolling away in lumps */
    const n = loopNoise(m, 941 + (e.seed || 0), 4.3);
    const lp = filt(ctx, 'lowpass', 520 - 330 * far, 0.6);
    lp.frequency.setValueAtTime(900 - 600 * far, t);
    lp.frequency.exponentialRampToValueAtTime(160 - 60 * far, t + d);
    const lp2 = filt(ctx, 'lowpass', 1400 - 900 * far, 0.5);
    const g = ctx.createGain();
    const N = 512;
    const curve = new Float32Array(N);
    const lumps = [];
    let at = 0;
    for (let k = 0; k < 7; k++) {
      lumps.push({ at: at, a: (k === 0 ? 1 : 0.35 + 0.65 * rnd()) * Math.exp(-k * 0.28), rise: 0.35 + 0.35 * rnd() + 0.2 * far, fall: 0.5 + 0.9 * rnd() });
      at += 0.25 + 0.7 * rnd();
    }
    for (let i = 0; i < N; i++) {
      const x = (i / (N - 1)) * d;
      let a = 0;
      lumps.forEach(function (L) {
        const dx = x - L.at;
        if (dx < 0) { return; }
        a += L.a * (dx < L.rise ? dx / L.rise : Math.exp(-(dx - L.rise) / L.fall));
      });
      curve[i] = Math.max(0.0001, a * v * (1 - Math.pow(i / (N - 1), 3)));
    }
    curve[0] = 0.0001;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.setValueCurveAtTime(curve, t, d);
    n.connect(lp); lp.connect(lp2); lp2.connect(g); g.connect(pan);
    n.start(t); n.stop(t + d + 0.05);
  }

  K.PLAYERS.rain = rain;
  K.PLAYERS.thunder = thunder;

  /* ------------------------------------------------------------------
     The score
     ------------------------------------------------------------------ */
  /* MIDI: D2 38, A2 45, D3 50, F3 53, G3 55, A3 57, Bb3 58, C#4 61, D4 62, E4 64, F4 65, A4 69, D5 74, A5 81, D6 86 */
  const Dm = [50, 53, 57, 62];
  const Bb = [46, 53, 58, 62];
  const Gm = [43, 55, 58, 62];
  const A7 = [45, 52, 57, 61, 67];
  const DM = [50, 54, 57, 62, 66];
  const LOGO = [69, 74, 81, 86];

  function buildStorm(plan) {
    const events = [];
    function put(i, t, o) { o = o || {}; o.i = i; o.t = t; events.push(o); return o; }
    const S = plan.SCENES, CARDS = plan.CARDS, W = plan.WARNING, C = plan.CLEAR, DUR = plan.DURATION;

    /* the alert's hit: a brass chord, a timpani, the logo's note on the bells */
    function hit(t, chord, drum, bell, big) {
      chord.forEach(function (m) { put('brass', t, { m: m, d: big ? 1.1 : 0.14, v: big ? 0.15 : 0.08, rel: big ? 1.4 : 0.35 }); });
      put('timp', t, { m: drum, v: big ? 1 : 0.5, ring: big ? 1.6 : 0.8 });
      if (bell) { put('bell', t, { m: bell, d: big ? 2.2 : 0.7, v: big ? 0.32 : 0.2 }); }
      if (big) { put('boom', t, { v: 0.8 }); put('crash', t, { v: 0.32 }); }
    }
    /* a timpani roll up to a hit */
    function roll(t0, t1, drum, v0, v1) {
      const n = Math.max(4, Math.round((t1 - t0) / 0.07));
      for (let k = 0; k < n; k++) {
        const x = k / (n - 1);
        put('timp', t0 + (t1 - t0) * Math.pow(x, 0.8), { m: drum, v: v0 + (v1 - v0) * x * x, ring: 0.4 });
      }
    }

    /* ---- the storm: a low D under everything, the pad darkening in, strings shivering ---- */
    put('bass', 0.2, { m: 38, d: S.show - 0.4, a: 4, r: 1.5, v: 0.45 });
    put('pad', 2.0, { ms: [50, 53, 57], d: plan.STRIKE - 2.1, a: 3.5, r: 0.6, v: 0.38 });
    put('trem', 3.2, { m: 69, d: plan.STRIKE - 3.2 + 0.05, v: 0.03 });
    put('trem', 4.6, { m: 70, d: plan.STRIKE - 4.6 + 0.05, v: 0.025 });
    put('riser', plan.STRIKE - 1.6, { d: 1.6, v: 0.16, lo: 200, hi: 6000 });
    /* the strike: its own thunder, the storm on one held chord, and the logo sending the signal out (no drum on it) */
    Dm.concat([65]).forEach(function (m) { put('brass', plan.STRIKE, { m: m, d: 1.1, v: 0.12, rel: 1.4 }); });
    plan.SIGNAL_HITS.forEach(function (t, j) {
      put('bell', t, { m: LOGO[j], d: j === 3 ? 2.6 : 1.1, v: j === 3 ? 0.42 : 0.32, pan: j % 2 ? 0.15 : -0.15 });
    });
    put('pad', plan.STRIKE, { ms: [50, 57, 62, 65, 69], d: S.cards - plan.STRIKE + 0.3, a: 0.02, r: 1.6, v: 0.5 });

    /* ---- the cards: the question, then the show's name on the four hits of WEATHER ALERT ---- */
    const walk = [[Dm, 38, 69], [Bb, 46, 74], [Gm, 43, 81], [A7, 45, 86]];
    CARDS.forEach(function (c) {
      if (c.title) {
        roll(c.at - 0.6, c.at - 0.02, 38, 0.06, 0.35);
        put('riser', c.at - 0.6, { d: 0.6, v: 0.14, lo: 300, hi: 7000 });
        [0, 0.2, 0.4, 0.65].forEach(function (off, k) { hit(c.at + off, walk[k][0], walk[k][1], walk[k][2], k === 3); });
        put('trem', c.at + 0.65, { m: 73, d: 2.6, v: 0.045 });
        put('trem', c.at + 0.65, { m: 76, d: 2.6, v: 0.035 });
        put('pad', c.at + 0.65, { ms: A7, d: c.until - c.at - 0.4, a: 0.05, r: 1.0, v: 0.45 });
      } else {
        /* brass and the bell only: no drum on the words */
        Dm.forEach(function (m) { put('brass', c.at, { m: m, d: 0.5, v: 0.07, rel: 0.8 }); });
        put('bell', c.at, { m: 69, d: 0.9, v: 0.2 });
        put('pad', c.at, { ms: Dm, d: c.until - c.at - 0.2, a: 0.03, r: 0.8, v: 0.36 });
      }
    });

    /* ---- the window out of the beacon: a rush up into a hit as it lands ---- */
    const WIN = plan.WINDOW;
    put('riser', WIN.out - 0.5, { d: WIN.landed - WIN.out + 0.4, v: 0.18, lo: 250, hi: 8000 });
    hit(WIN.landed - 0.1, Dm, 38, 74, false);

    /* ---- the forecast on the window: KLWD's beat in D minor carries it, a dark pad under it, a hit on each flip ---- */
    put('pad', WIN.landed, { ms: [50, 57, 62, 65], d: W.alert - WIN.landed - 0.1, a: 1.2, r: 0.4, v: 0.42 });
    put('bass', WIN.landed, { m: 38, d: W.alert - WIN.landed - 0.1, a: 1.2, r: 0.4, v: 0.3 });
    const bells = [81, 77, 74];
    plan.FEATURES.forEach(function (f, k) {
      if (k === 0 || f.flip === false) { return; }
      put('riser', f.at - 0.45, { d: 0.45, v: 0.08, lo: 600, hi: 9000 });
      put('timp', f.at, { m: 38, v: 0.45, ring: 1 });
      put('bell', f.at, { m: bells[(k - 1) % bells.length], d: 1.2, v: 0.2 });
    });

    /* ---- STORM WARNING: KLWD's own sound; a low D holds under it so the music never stops ---- */
    put('pad', W.alert + 0.3, { ms: [50, 57, 62], d: W.board - W.alert - 0.3, a: 1.5, r: 0.8, v: 0.36 });
    put('bass', W.alert + 0.3, { m: 38, d: W.board - W.alert - 0.3, a: 1.5, r: 0.8, v: 0.22 });
    /* the camera leaning into STORMTRACKER, and back out */
    put('riser', WIN.leanIn - 0.2, { d: WIN.inside - WIN.leanIn + 0.2, v: 0.07, lo: 300, hi: 5000 });

    /* ---- the board, and the storm clearing: the outro's D major, warm, then the logo ---- */
    put('pad', W.board - 0.1, { ms: DM, d: C.name - W.board, a: 1.4, r: 1.2, v: 0.32 });
    put('bass', W.board - 0.1, { m: 38, d: C.name - W.board, a: 1.4, r: 1.2, v: 0.3 });
    /* the clouds parting: plucks climbing the logo's shape */
    const arp = [57, 62, 69, 74, 66, 69, 74, 78];
    for (let k = 0; k < 16; k++) {
      const t = S.clear + 0.6 + k * 0.25;
      put('pluck', t, { m: arp[k % arp.length] + (k >= 8 ? 12 : 0), d: 0.4, v: 0.25 + 0.2 * (k / 15), pan: k % 2 ? 0.25 : -0.25 });
    }
    put('riser', C.name - 1.4, { d: 1.4, v: 0.1, lo: 400, hi: 8000 });
    /* the window flying home into the beacon */
    put('riser', WIN.home, { d: WIN.gone - WIN.home, v: 0.1, lo: 4000, hi: 400 });
    put('bell', WIN.gone, { m: 74, d: 1.6, v: 0.26 });
    /* the name: the logo on the bells over the jingles' warm chord */
    const NAME = plan.NAME_HITS;
    [50, 54, 57, 62].forEach(function (m) { put('brass', NAME[0], { m: m, d: 0.3, v: 0.07, rel: 0.5 }); });
    [50, 54, 57, 62, 66].forEach(function (m) { put('brass', NAME[3], { m: m, d: 0.9, v: 0.11, rel: 2.2 }); });
    put('timp', NAME[3], { m: 38, v: 0.7, ring: 1.6 });
    put('crash', NAME[3], { v: 0.12 });
    NAME.forEach(function (t, j) { put('bell', t, { m: LOGO[j], d: j === 3 ? 3.2 : 1.0, v: j === 3 ? 0.5 : 0.38, pan: j % 2 ? 0.12 : -0.12 }); });
    put('pad', NAME[3], { ms: DM.concat([69, 74]), d: DUR - NAME[3] - 1.5, a: 0.05, r: 2.0, v: 0.4 });
    put('bass', NAME[3], { m: 38, d: DUR - NAME[3] - 1.5, a: 0.05, r: 2.0, v: 0.35 });
    /* a last whisper of the logo */
    [1.4, 1.9, 2.4, 3.4].forEach(function (o, j) { put('bell', NAME[3] + o, { m: LOGO[j] + 12, d: 1.4, v: 0.12, pan: j % 2 ? 0.3 : -0.3 }); });

    /* ---- the rain: the whole storm long, softer behind the window, stopping as it clears ---- */
    put('rain', 0, { d: C.rainOut + 0.5, pts: [[0, 0], [1.6, 1], [WIN.out, 1], [WIN.landed, 0.55], [WIN.home, 0.55], [S.clear, 0.85], [S.clear + 0.6, 0.85], [C.rainOut, 0]] });

    /* ---- the thunder: each flash's, close ones at once, far ones after their light ---- */
    plan.FLASHES.forEach(function (f, k) {
      if (f.at >= S.alert && f.at < S.clear) { return; }
      const close = !!f.bolt && f.power >= 0.9;
      const far = close ? 0.1 : clamp(1 - f.power, 0.35, 0.9);
      const delay = close ? 0.02 : 0.35 + 1.2 * far;
      // KLWD's own thunder is in WEATHER ALERT's jingle
      if (f.at + delay > S.alert - 0.2 && f.at + delay < S.clear) { return; }
      put('thunder', f.at + delay, { v: close ? 0.9 * Math.min(1.2, f.power) : 0.55 * f.power + 0.12, far: far, d: close ? 4.2 : 3.2, seed: 11 + k * 7 });
    });

    events.sort(function (a, b) { return a.t - b.t; });
    return {
      duration: DUR, step: 0.125, events: events, duck: [], cutoff: [[0, 20000]],
      fade: { t0: plan.CLEAR.end, t1: DUR - 0.05 }
    };
  }

  root.buildStorm = buildStorm;
  root.renderStorm = function (plan, sampleRate) { return K.renderScore(buildStorm(plan), sampleRate); };
})();
