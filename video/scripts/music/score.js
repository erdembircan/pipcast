/* The soundtrack and the sound effects of the Pipcast demo video.

   A browser-side script, no imports. scripts/render-audio.mjs loads it in
   headless Chrome and renders everything offline:

     renderSoundtrack(plan, sampleRate)  -> Promise<AudioBuffer>, stereo,
                                            plan.DURATION seconds
     renderSfx(name, sampleRate)         -> Promise<AudioBuffer>
     buildScore(plan)                    -> the score as plain data (notes and
                                            automation), no audio needed

   The music is written, not recorded: buildScore turns src/timeline.ts's MUSIC
   (sections with a start, a name and an energy), LOGO_HITS and NAME_HITS into
   a list of events, and the synth below plays them. Move a cut in the timeline
   and the arrangement follows it: the chords, the layers, the last hit before
   a breakdown and the fade-out are all worked out from the sections.

   Once the music has started it never stops. Under a jingle it breaks down
   instead: the groove ends on a downbeat and rings out by itself (there is no
   gate, nothing is cut), and a soft pedal or pad carries on under the jingle.

   The music is in D major at 120 BPM and built on the station's four-note logo,
   one note per call letter, K-L-W-D: A, D, A, D (up a fourth, a fifth and a
   fourth). The arpeggios on every chord are the logo's shape (the fifth below
   the root, the root, the fifth above, the octave) so the whole track hums it;
   on the D chord they are the logo itself. The bells play it plainly at the
   name card, on the fanfare at the end, and now and then in the groove.

   The instruments of the product's jingles (design/components/bundle.js) are
   copied here for the logo and the fanfare: noise, hall, brass, timpani, boom,
   crash, riser, bell and tremolo. The kick, clap, hats, shaker, bass, electric
   piano, pad and pluck are new.

   The sections, in short (energy decides what plays: see layersGroove):
     silence  nothing: the cold open belongs to the station's own jingles
     intro    starts under the jingle's D major chord: a pad swells in, then a
              filtered pluck figure: no drums
     logo     A D A D on bells over a brass chord (NAME_HITS); at the end of the
              video the hour jingle's fanfare on LOGO_HITS, over the beat
     lift     thinned out and building into the groove: chops, hats, a swell
              and a roll
     groove   drums, bass, piano, plucks, and from 0.85 up the bells; before a
              breakdown it ends on one hit on the last beat and lets it ring
     pedal    a breakdown under a jingle in D minor: a soft D, its octaves and
              its fifth, no third, no rhythm
     pad      a breakdown under the report on the hour, in D major: a warm pad,
              no drums, no D in the middle of it
     drive    the beat back as soon as a jingle is done: kick, hats, shaker and
              the bass line over the D and its fifth, no third, no melody, so
              the music never stops for the news
     build    rises out of a groove, a pedal, a pad or a drive into the next
              downbeat (a short one is a fill)
     finale   the groove at its peak, bells climbing to the tonic
     outro    the jingles' warm D major chord, a whispered logo, a fade

   Where to tweak:
     BUS      the level, tone and sends of every part of the mix (the faders are
              linear gains: 0.5 is 6 dB down); the stems can be heard alone with
              renderSoundtrack(plan, 48000, { solo: ['bass'] })
     PEDAL, PAD  how loud the two breakdowns are played; DRIVE the pad under
              the drive
     TARGET   the loudness the soundtrack is set to and its ceiling
     lv()     how hard everything is played at a given energy
     layers   what plays at which energy (layersGroove and the genXxx functions)
   After the render the chain's own delay is taken out, the loudness is set to
   TARGET and a limiter keeps the peaks under its ceiling; window.mixReport says
   what that took.
*/
(function () {
  'use strict';

  const root = typeof window !== 'undefined' ? window : globalThis;

  /* ------------------------------------------------------------------
     Small tools
     ------------------------------------------------------------------ */
  function clamp(x, a, b) { return x < a ? a : (x > b ? b : x); }
  function lerp(a, b, x) { return a + (b - a) * x; }
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  /* the bundle's seeded noise: every render is the same */
  function seeded(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* a repeatable number in [0, 1) for any pair of integers: the same event
     gets the same chance whatever else is in the score */
  function hash01(a, b) {
    let h = Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x632BE5AB, 0x85EBCA6B);
    h ^= h >>> 15; h = Math.imul(h, 0x2C1B3C6D);
    h ^= h >>> 12; h = Math.imul(h, 0x297A2D39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------------
     Harmony. Every chord is written out: the bass note, an upper voicing for
     the pad, a close one for the piano, the five notes the pluck climbs (the
     first, second, fourth and fifth are the logo's shape: the fifth below the
     root, the root, the fifth above, the octave), the two notes the bells
     sing over it, and the pitch classes that are allowed to sound with it
     (`tones`) and to pass over it (`ext`). MIDI numbers: D3 = 50, D4 = 62,
     A4 = 69, D6 = 86. The bass sits around 100 to 150 Hz, with a soft octave
     under it, and leaves the sub to the kick.
     ------------------------------------------------------------------ */
  const CHORDS = {
    'D':     { bass: 50, pad: [62, 66, 69, 74], keys: [57, 62, 66, 69], arp: [69, 74, 78, 81, 86], top: [81, 86], tones: [2, 6, 9], ext: [4, 1] },
    'D5':    { bass: 50, pad: [57, 62, 69, 74], keys: [57, 62, 69, 74], arp: [69, 74, 76, 81, 86], top: [81, 86], tones: [2, 9], ext: [4] },
    'D/F#':  { bass: 42, pad: [62, 66, 69, 74], keys: [57, 62, 66, 69], arp: [69, 74, 78, 81, 86], top: [81, 86], tones: [2, 6, 9], ext: [4, 1] },
    'Bm7':   { bass: 47, pad: [62, 66, 71, 74], keys: [59, 62, 66, 69], arp: [66, 71, 74, 78, 83], top: [83, 81], tones: [11, 2, 6, 9], ext: [4] },
    'Gmaj7': { bass: 43, pad: [62, 67, 71, 78], keys: [59, 62, 66, 71], arp: [62, 67, 71, 74, 79], top: [86, 83], tones: [7, 11, 2, 6], ext: [9] },
    'A':     { bass: 45, pad: [61, 64, 69, 73], keys: [57, 61, 64, 69], arp: [64, 69, 73, 76, 81], top: [85, 88], tones: [9, 1, 4], ext: [2, 6] },
    'A6':    { bass: 45, pad: [61, 66, 69, 73], keys: [57, 61, 64, 66], arp: [64, 69, 73, 76, 81], top: [85, 81], tones: [9, 1, 4, 6], ext: [2] },
    'Asus4': { bass: 45, pad: [57, 62, 69, 76], keys: [57, 62, 64, 69], arp: [64, 69, 74, 76, 81], top: [86, 88], tones: [9, 2, 4], ext: [] },
    'F#m7':  { bass: 42, pad: [61, 66, 69, 76], keys: [57, 61, 64, 66], arp: [61, 66, 69, 73, 78], top: [81, 85], tones: [6, 9, 1, 4], ext: [11] }
  };
  /* two four-bar loops: I vi IV V (home), which a groove starts on, on the
     tonic, so that it takes over from the jingles' D major chords; and
     IV V iii vi (royal), which a step up in energy turns to */
  const LOOPS = {
    royal: ['Gmaj7', 'A6', 'F#m7', 'Bm7'],
    home: ['D', 'Bm7', 'Gmaj7', 'A']
  };
  const LOGO = [69, 74, 81, 86]; // A4 D5 A5 D6

  /* the sections this score plays (a silence is a section with no music) */
  const SECTIONS = ['silence', 'intro', 'logo', 'lift', 'groove', 'pedal', 'pad', 'drive', 'build', 'finale', 'outro'];

  /* how loud the two breakdowns are played: the velocity of the pad and of the
     bass note under it (the pad is what a small speaker plays, the low D what a
     big one lets you feel) */
  const PEDAL = { pad: 0.5, bass: 0.13 };
  const PAD = { pad: 0.6, bass: 0.14 };
  /* and the pad under the drive, the beat that comes back once a jingle is done */
  const DRIVE = { pad: 0.4 };

  /* patterns on a grid of sixteenths: [step, ...] */
  const BASS_GROOVE = [[0, 0, 3, 1.0], [3, 0, 2, 0.72], [6, 12, 2, 0.82], [8, 0, 3, 0.95], [11, 0, 2, 0.72], [14, 7, 2, 0.8]];
  const KEYS_COMP = [[0, 3, 1.0], [6, 2, 0.8], [10, 2, 0.86], [14, 2, 0.72]];
  const KEYS_SIMPLE = [[0, 6, 0.95], [10, 4, 0.75]];
  const CELL = [0, 1, 2, 3, 4, 3, 2, 1];
  const SHAKE = [0.55, 0.3, 0.8, 0.38];

  /* the pitch classes that may sound over a chord */
  function allowedPcs(name) {
    const c = CHORDS[name];
    return c.tones.concat(c.ext);
  }

  /* ------------------------------------------------------------------
     The score: plain data. Each event is { i: instrument, t: seconds, ... }.
     ------------------------------------------------------------------ */
  function buildScore(plan) {
    const BPM = plan.BPM || 120;
    const BEAT = 60 / BPM;
    const STEP = BEAT / 4;
    const BAR = plan.BAR || BEAT * 4;
    const PER_BAR = Math.round(BAR / STEP);
    const DUR = plan.DURATION || plan.duration || 92;
    const HITS = plan.LOGO_HITS || [];
    const NAME = plan.NAME_HITS || [];
    let events = [];
    let duck = [];

    /* the sections, each from its start to the next one's */
    function sections() {
      const list = plan.MUSIC || [];
      const out = [];
      for (let i = 0; i < list.length; i++) {
        if (list[i].at >= DUR - 1e-6) { continue; }
        const nextAt = i + 1 < list.length ? Math.min(list[i + 1].at, DUR) : DUR;
        /* a section with no energy, or the end, is silence; a section this
           score does not know plays as a groove at its energy */
        const energy = list[i].energy;
        const name = !(energy > 0.001) || list[i].section === 'end' ? 'silence' : (SECTIONS.indexOf(list[i].section) >= 0 ? list[i].section : 'groove');
        out.push({ name: name, start: list[i].at, end: nextAt, energy: energy });
      }
      out.forEach(function (s, n) {
        s.prev = out[n - 1] || null;
        s.next = out[n + 1] || null;
        s.runStart = s.prev && s.prev.name === s.name ? s.prev.runStart : s.start;
        /* the loop of chords a groove plays, and where it counts its bars from:
           a run goes on with its loop, and a step up in energy within it turns
           to the other loop */
        if (s.name === 'groove') {
          const cont = !!s.prev && s.prev.name === 'groove';
          if (cont && s.energy > s.prev.energy + 0.05) {
            s.loop = s.prev.loop === 'home' ? 'royal' : 'home';
            s.loopStart = s.start;
          } else if (cont) {
            s.loop = s.prev.loop;
            s.loopStart = s.prev.loopStart;
          } else {
            s.loop = 'home';
            s.loopStart = s.start;
          }
        }
        /* before a breakdown the music ends on one deliberate hit, on the last
           beat, and lets it ring */
        const n2 = s.next;
        if (n2 && (n2.name === 'pedal' || n2.name === 'pad' || n2.name === 'silence') && (s.name === 'groove' || s.name === 'lift' || s.name === 'finale')) {
          s.stabT = Math.max(s.start, Math.floor((n2.start - 1e-6) / BEAT) * BEAT);
        }
      });
      return out;
    }
    const segs = sections();

    /* a build under the hour jingle's last chord, right after the hour's pad or
       after the drive that follows it: it starts low and stays on D, as it
       does out of a breakdown (a build after the drive that follows the news
       pedal has the jingle behind it, and goes on at the drive's level) */
    function underHourChord(seg) {
      const p = seg.prev;
      return !!p && (p.name === 'pad' || (p.name === 'drive' && !!p.prev && p.prev.name === 'pad'));
    }

    function hitsIn(seg, list) {
      return list.filter(function (h) { return h >= seg.start - 1e-6 && h < seg.end - 1e-6; });
    }
    function barOf(t) { return Math.floor((t + 1e-6) / BAR); }
    function barsLeft(seg, t) { return Math.max(1, Math.ceil((seg.end - barOf(t) * BAR) / BAR - 1e-6)); }
    function endAligned(list, k) { return list[((list.length - k) % list.length + list.length) % list.length]; }
    function loopChord(seg, t) {
      const idx = barOf(t) - barOf(seg.loopStart);
      return LOOPS[seg.loop][((idx % 4) + 4) % 4];
    }
    /* the last second of a section on the dominant, the one before it on the
       subdominant, the rest on the tonic: I IV V, and home */
    function tailChord(seg, t) {
      const left = seg.end - t;
      return left <= 1 + 1e-6 ? 'A' : (left <= 2 + 1e-6 ? 'Gmaj7' : 'D');
    }
    /* the chord at a time inside a section */
    function chordName(seg, t) {
      switch (seg.name) {
        case 'intro':
          /* it starts on D, under the jingle's chord, and goes I IV V into the logo */
          return tailChord(seg, t);
        case 'logo': {
          const hs = hitsIn(seg, HITS);
          if (!hs.length) { return 'D'; }
          let idx = -1;
          for (let i = 0; i < hs.length; i++) { if (hs[i] <= t + 1e-6) { idx = i; } }
          return ['D', 'D/F#', 'A', 'D'][clamp(idx, 0, 3)];
        }
        case 'groove':
          return loopChord(seg, t);
        case 'lift':
          /* IV, then V into the groove's tonic */
          return seg.end - t <= 1 + 1e-6 ? 'A' : 'Gmaj7';
        case 'pedal':
          /* D and its fifth, no third: it sits under a D minor jingle */
          return 'D5';
        case 'pad':
          return 'D';
        case 'drive':
          /* the beat over the D and its fifth, no third: it follows a D minor
             jingle and runs under a D major one */
          return 'D5';
        case 'build':
          /* out of a pad, or a drive after one, it stays on D, under the hour
             jingle's ringing chord; out of the pedal or a drive after it, the
             news jingle is done, and it goes IV, V over the D; into the logo it
             goes ... vi IV V */
          if (underHourChord(seg)) { return 'D'; }
          if (seg.prev && (seg.prev.name === 'pedal' || seg.prev.name === 'drive')) { return tailChord(seg, t); }
          return endAligned(['D', 'F#m7', 'Bm7', 'Gmaj7', 'A'], barsLeft(seg, t));
        case 'finale':
          return tailChord(seg, t);
        case 'outro':
          return 'D';
      }
      return null;
    }
    function chordAtTime(t) {
      for (let i = 0; i < segs.length; i++) {
        if (t >= segs[i].start - 1e-6 && t < segs[i].end - 1e-6) { return chordName(segs[i], t); }
      }
      return null;
    }
    /* the chord an eighth later, or the next section's first: for the
       anticipations */
    function chordAfter(seg, t) {
      const n = t + 2 * STEP;
      if (n < seg.end - 1e-6) { return chordName(seg, n); }
      if (seg.next && seg.next.name !== 'silence') { return chordName(seg.next, seg.next.start); }
      return chordName(seg, t);
    }

    /* how much a section carries at a time: some of them move */
    function energyAt(seg, t) {
      const r = clamp((t - seg.start) / Math.max(0.001, seg.end - seg.start), 0, 1);
      switch (seg.name) {
        case 'intro': return seg.energy * (0.35 + 0.75 * r);
        case 'lift': return seg.energy * (0.9 + 0.3 * r);
        case 'build': {
          /* out of a breakdown a build starts low; out of a groove it only pulls back a little */
          const low = (seg.prev && seg.prev.name === 'pedal') || underHourChord(seg);
          return clamp(lerp(low ? seg.energy - 0.3 : seg.energy - 0.15, Math.min(1, seg.energy + 0.3), r), 0, 1);
        }
        case 'outro': return seg.energy * (1 - 0.55 * r);
      }
      return seg.energy;
    }
    /* how hard everything is played at an energy */
    function lv(e) { return 0.3 + 0.7 * Math.pow(clamp(e, 0, 1), 1.3); }

    /* ---- helpers that write events ---- */
    function put(i, t, o) {
      o = o || {};
      o.i = i;
      o.t = t;
      events.push(o);
      return o;
    }
    function kickAt(t, v) {
      put('kick', t, { v: v });
      duck.push({ t: t, v: v });
    }
    function jit(S, salt, amount) { return (hash01(S.s, salt) - 0.5) * 2 * amount; }

    function eachStep(seg, fn) {
      const len = Math.max(0.001, seg.end - seg.start);
      const s0 = Math.ceil((seg.start - 1e-6) / STEP);
      const loopAt = seg.loopStart === undefined ? seg.start : seg.loopStart;
      for (let s = s0; ; s++) {
        const t = s * STEP;
        if (t >= seg.end - 1e-6) { break; }
        const name = chordName(seg, t);
        const e = energyAt(seg, t);
        fn({
          seg: seg, s: s, t: t, k: s % PER_BAR, bar: Math.floor(s / PER_BAR),
          loopBar: (((Math.floor(s / PER_BAR) - barOf(loopAt)) % 4) + 4) % 4,
          e: e, lv: lv(e), chord: name, C: CHORDS[name], r: (t - seg.start) / len
        });
      }
    }
    /* the chord changes of a section, a pad for each (never longer than a bar) */
    function regions(seg) {
      const out = [];
      let cur = null;
      const s0 = Math.ceil((seg.start - 1e-6) / STEP);
      for (let s = s0; ; s++) {
        const t = s * STEP;
        if (t >= seg.end - 1e-6) { break; }
        const name = chordName(seg, t);
        if (!cur || cur.name !== name || s % PER_BAR === 0) {
          cur = { name: name, t0: t, t1: t + STEP };
          out.push(cur);
        } else {
          cur.t1 = t + STEP;
        }
      }
      return out;
    }
    function padPart(seg, o) {
      regions(seg).forEach(function (rg) {
        if (seg.stabT !== undefined && rg.t0 >= seg.stabT - 1e-6) { return; }
        /* a sliver of a chord at the edge of a section is left to what rings over it */
        if (rg.t1 - rg.t0 < 0.3) { return; }
        const e = energyAt(seg, rg.t0);
        const d = rg.t1 - rg.t0 + 0.04;
        put('pad', rg.t0, {
          ms: CHORDS[rg.name].pad, d: d, v: o.v * (0.55 + 0.45 * lv(e)), a: Math.min(o.a, Math.max(0.02, d * 0.8)), r: o.r, ch: rg.name
        });
      });
    }
    function riserAt(t, d, v, lo, hi) { put('riser', t, { d: d, v: v, lo: lo || 300, hi: hi || 7000 }); }
    /* a roll of short claps, sixteenths, ending just before T */
    function rollBefore(T, n, v0, v1) {
      for (let j = 0; j < n; j++) {
        put('clap', T - (n - j) * STEP, { v: lerp(v0, v1, n > 1 ? j / (n - 1) : 1), short: true });
      }
    }

    /* ---- what plays at an energy ---- */
    function layersGroove(e) {
      return {
        kick: e >= 0.7 ? 2 : (e >= 0.45 ? 1 : 0),
        clap: e >= 0.6,
        hat: e >= 0.78 ? 2 : (e >= 0.5 ? 1 : 0),
        open: e >= 0.75,
        shaker: e >= 0.65,
        bass: e >= 0.6 ? 2 : (e >= 0.3 ? 1 : 0),
        keys: e >= 0.62 ? 2 : (e >= 0.45 ? 1 : 0),
        pluck: e >= 0.7 ? 3 : (e >= 0.5 ? 2 : (e >= 0.3 ? 1 : 0)),
        bell: e >= 0.95 ? 2 : (e >= 0.85 ? 1 : 0)
      };
    }

    /* the logo as the groove hums it: A D A D over the last bar of a loop, the
       last note on the next downbeat (even when that is the next groove's) */
    function logoLiteral(S) {
      const offs = [0, 6 * STEP, 12 * STEP, 16 * STEP];
      const vel = [0.26, 0.26, 0.28, 0.38];
      const limit = S.seg.next && S.seg.next.name === S.seg.name ? S.seg.next.end : S.seg.end;
      for (let j = 0; j < 4; j++) {
        const t = S.t + offs[j];
        if (t >= limit - 0.01) { break; }
        put('bell', t, { m: LOGO[j], d: j === 3 ? 2.0 : 0.9, v: vel[j] * S.lv, pan: (j % 2 ? 0.12 : -0.12), ch: chordAtTime(t) });
      }
    }

    /* one sixteenth of a groove: drums, bass, piano, pluck and bells */
    function grooveStep(S, L) {
      const t = S.t, k = S.k, v = S.lv, C = S.C, seg = S.seg;
      if (seg.stabT !== undefined && t >= seg.stabT - 1e-6) { return; }
      /* drums */
      if (L.kick === 2 && k % 4 === 0) { kickAt(t, (k === 0 ? 1 : 0.9) * v); }
      else if (L.kick === 1 && (k === 0 || k === 8)) { kickAt(t, 0.95 * v); }
      if (L.clap && (k === 4 || k === 12)) { put('clap', t, { v: 0.78 * v }); }
      if (L.clap && L.hat >= 2 && S.loopBar === 3 && k === 15) { put('clap', t, { v: 0.36 * v, short: true }); }
      if (L.hat) {
        if (k % 4 === 2) {
          const open = L.open && k === 14 && S.loopBar % 2 === 1;
          put('hat', Math.max(seg.start, t + jit(S, 1, 0.003)), { v: (open ? 0.52 : 0.46 + 0.14 * hash01(S.s, 3)) * v, open: open });
        } else if (L.hat >= 2 && k % 4 === 0) {
          put('hat', t, { v: 0.24 * v });
        }
      }
      if (L.shaker) {
        put('shaker', Math.max(seg.start, t + jit(S, 4, 0.004)), { v: SHAKE[k % 4] * v * (0.9 + 0.2 * hash01(S.s, 6)), pan: (S.s % 2 ? 0.3 : -0.3) });
      }
      /* bass */
      if (L.bass === 2) {
        BASS_GROOVE.forEach(function (p) {
          if (p[0] === k) { put('bass', t, { m: C.bass + p[1], d: p[2] * STEP * 0.9, v: p[3] * v, ch: S.chord }); }
        });
      } else if (L.bass === 1 && k % 2 === 0) {
        put('bass', t, { m: C.bass, d: 0.2, v: 0.5 * [1, 0.5, 0.75, 0.5][(k / 2) % 4] * v, a: 0.012, ch: S.chord });
      }
      /* piano */
      if (L.keys) {
        (L.keys === 2 ? KEYS_COMP : KEYS_SIMPLE).forEach(function (p) {
          if (p[0] !== k) { return; }
          /* the stab on the last eighth pushes into the next bar's chord */
          const name = (k === 14 && L.keys === 2) ? chordAfter(seg, t) : S.chord;
          put('keys', t, { ms: CHORDS[name].keys, d: p[1] * STEP * 0.95, v: p[2] * v, ch: name });
        });
      }
      /* pluck: the logo's shape up and back down the chord */
      if (L.pluck) {
        let j = -1;
        if (L.pluck >= 3 && k % 2 === 0) { j = k / 2; }
        else if (L.pluck === 2 && k % 4 === 0) { j = k / 2; }
        else if (L.pluck === 1 && k % 8 === 0) { j = k / 2; }
        if (j >= 0) {
          put('pluck', Math.max(seg.start, t + jit(S, 2, 0.004)), {
            m: C.arp[CELL[j]], d: 0.2, v: (0.55 + 0.25 * hash01(S.s, 5) + (k % 8 === 0 ? 0.2 : 0)) * v,
            pan: (S.s % 4 < 2 ? -0.3 : 0.3), ch: S.chord
          });
        }
      }
      /* bells: a long note on the downbeat, a second one on the and of three,
         and the logo itself on the last bar of every loop */
      if (L.bell) {
        if (S.loopBar === 3) {
          if (k === 0) { logoLiteral(S); }
        } else {
          if (k === 0) { put('bell', t, { m: C.top[0], d: 1.5, v: 0.3 * v, pan: -0.1, ch: S.chord }); }
          if (L.bell >= 2 && k === 10) { put('bell', t, { m: C.top[1], d: 1.0, v: 0.24 * v, pan: 0.1, ch: S.chord }); }
        }
      }
    }

    /* The last hit before a breakdown: kick, bass, piano, pad and a bell, all
       at once on the last beat, and then left to ring out by themselves (the
       pad for a second, the bell and the pluck's echoes for two): the groove
       ends on a downbeat and the pedal or the pad comes in under its tail. It
       is the tonic: the D and its fifth under a D minor jingle (no third), the
       D major chord for the report on the hour. The tail is long (the pad rings
       for three seconds, the bell for two and a half) so that the level goes
       down in a slide to the breakdown's own, and never dips below it. */
    function stab(seg) {
      const name = seg.next && seg.next.name === 'pedal' ? 'D5' : 'D';
      const C = CHORDS[name];
      const t = seg.stabT;
      kickAt(t, 1);
      put('bass', t, { m: C.bass, d: 0.4, v: 1, a: 0.006, r: 0.7, ch: name });
      put('keys', t, { ms: C.keys, d: 1.2, v: 1, ch: name });
      put('pad', t, { ms: C.pad, d: 1.0, v: 0.9, a: 0.01, r: 2.5, ch: name });
      put('bell', t, { m: C.top[0], d: 2.6, v: 0.4, ch: name });
      put('pluck', t, { m: C.arp[4], d: 0.3, v: 0.55, pan: 0.2, ch: name });
      put('clap', t, { v: 0.6 });
    }
    /* a bell on a downbeat that arrives: on a bar line the groove's own bell
       sings the first note of the chord's pair, this one the second */
    function accentBell(seg) {
      const name = chordName(seg, seg.start);
      const onBar = Math.abs(seg.start / BAR - Math.round(seg.start / BAR)) < 1e-6;
      const L0 = layersGroove(energyAt(seg, seg.start));
      put('bell', seg.start, { m: CHORDS[name].top[onBar && L0.bell ? 1 : 0], d: 1.6, v: 0.34, ch: name });
    }

    /* ---- the sections ---- */
    /* it starts under the jingle's chord (the same D major): a pad swells in
       over a second, a soft bass root joins with each chord, and a filtered
       pluck figure comes in after a second: no drums */
    function genIntro(seg) {
      padPart(seg, { v: 1.4, a: 1.6, r: 1.4 });
      regions(seg).forEach(function (rg) {
        const e = energyAt(seg, rg.t0);
        if (e > 0.18 && rg.t1 - rg.t0 >= 0.3) {
          put('bass', rg.t0, { m: CHORDS[rg.name].bass, d: Math.max(0.3, rg.t1 - rg.t0 - 0.05), v: 0.4 * lv(e), a: 0.3, r: 0.5, ch: rg.name });
        }
      });
      eachStep(seg, function (S) {
        const e = S.e;
        grooveStep(Object.assign({}, S, { lv: S.lv * 1.5 }), { pluck: S.t < seg.start + 0.99 ? 0 : (e < 0.17 ? 1 : (e < 0.3 ? 2 : 3)) });
      });
      /* a soft breath of air into the name card */
      riserAt(Math.max(seg.start, seg.end - 1.5), Math.min(1.5, seg.end - seg.start), 0.12, 500, 6000);
    }

    /* the logo at the name card: A D A D on bells over a brass chord, the last
       and biggest on the third beat (the times of NAME_HITS). The one at the
       end of the video follows LOGO_HITS: the hour jingle's fanfare in D major
       over the beat, each hit's chord changing as the logo's notes do, the last
       the biggest, left to ring into the finale. */
    function genLogo(seg) {
      const hs = hitsIn(seg, HITS);
      const nh = hitsIn(seg, NAME);
      padPart(seg, { v: hs.length ? 0.9 : 0.8, a: hs.length ? 0.15 : 0.4, r: 1.0 });
      if (hs.length) { return genFanfare(seg, hs); }
      const k = Math.min(1, (seg.end - seg.start) / 2);
      genNameCard(seg, nh.length >= 4 ? nh : [0, 0.25, 0.5, 1.0].map(function (x) { return seg.start + x * k; }));
    }
    function genFanfare(seg, hs) {
      const fan = [
        { ms: [50, 54, 57, 62], ch: 'D', bassM: 50 },
        { ms: [54, 57, 62], ch: 'D/F#', bassM: 42 },
        { ms: [57, 61, 64], ch: 'A', bassM: 45 },
        { ms: [50, 54, 57, 62, 66], ch: 'D', bassM: 50 }
      ];
      const FAN = 2.1;
      hs.forEach(function (t, i) {
        const last = i === hs.length - 1;
        const f = fan[Math.min(i, 3)];
        const until = last ? seg.end : hs[i + 1];
        f.ms.forEach(function (m) {
          put('brass', t, { m: m, d: last ? 1.6 : 0.32, v: FAN * (last ? 0.12 : 0.065), rel: 0.28, ch: f.ch });
        });
        put('timp', t, { m: i % 2 === 1 ? 45 : 38, v: last ? 0.9 : 0.4, ring: last ? 1.4 : 0.7 });
        put('bell', t, { m: LOGO[Math.min(i, 3)], d: last ? 2.4 : 0.8, v: last ? 0.7 : 0.42, ch: f.ch });
        put('bass', t, { m: f.bassM, d: Math.max(0.2, until - t - 0.05), v: last ? 1 : 0.8, a: 0.01, ch: f.ch });
        if (last) {
          put('boom', t, { v: 0.7 });
          put('crash', t, { v: 0.2 });
          put('trem', t, { m: 74, d: 2.6, v: 0.05 * FAN });
          put('trem', t, { m: 81, d: 2.6, v: 0.035 * FAN });
        }
      });
      /* the beat under the fanfare */
      eachStep(seg, function (S) {
        grooveStep(S, { kick: 2, hat: 1 });
      });
    }
    function genNameCard(seg, times) {
      const t0 = times[0];
      const tl = times[3];
      const FAN = 1.5;
      [50, 54, 57, 62].forEach(function (m) { put('brass', t0, { m: m, d: 0.3, v: FAN * 0.06, rel: 0.5, ch: 'D' }); });
      [50, 54, 57, 62, 66].forEach(function (m) { put('brass', tl, { m: m, d: 0.7, v: FAN * 0.1, rel: 1.0, ch: 'D' }); });
      put('timp', t0, { m: 38, v: 0.3, ring: 0.6 });
      put('timp', tl, { m: 38, v: 0.7, ring: 1.2 });
      LOGO.forEach(function (m, j) {
        put('bell', times[j], { m: m, d: j === 3 ? 1.9 : 0.8, v: [0.3, 0.3, 0.33, 0.5][j], pan: j % 2 ? 0.12 : -0.12, ch: 'D' });
      });
      put('trem', tl, { m: 74, d: 1.6, v: 0.04 * FAN });
      put('trem', tl, { m: 81, d: 1.6, v: 0.03 * FAN });
      put('bass', tl, { m: 50, d: Math.max(0.3, seg.end - tl - 0.1), v: 0.3, a: 0.02, r: 0.2, ch: 'D' });
      /* straight into a groove: a swell and a roll; a lift does that itself */
      const n = seg.next;
      if (n && n.name === 'groove') {
        riserAt(tl, seg.end - tl, 0.3, 300, 7000);
        rollBefore(seg.end, 4, 0.22, 0.6);
      }
    }

    function genGroove(seg) {
      padPart(seg, { v: 1, a: 0.28, r: 0.55 });
      eachStep(seg, function (S) { grooveStep(S, layersGroove(S.e)); });
      /* a bell on a downbeat that arrives after a lift, a build or a breakdown (no
         cymbal, no boom: those belong to the stories' intros) */
      if (seg.prev && seg.prev.name !== 'groove') { accentBell(seg); }
      /* a step up in energy: a swell into it and a bell on it */
      if (seg.prev && seg.prev.name === 'groove' && seg.energy > seg.prev.energy + 0.05) {
        riserAt(Math.max(seg.prev.start, seg.start - 1.0), Math.min(1.0, seg.start - seg.prev.start), 0.3, 400, 9000);
        accentBell(seg);
      }
      const n = seg.next;
      if (n && n.name === 'groove' && n.energy > seg.energy + 0.05) { rollBefore(seg.end, 4, 0.3, 0.75); }
      if (seg.stabT !== undefined) { stab(seg); }
    }

    /* thinned out, building: the piano chops the chord in eighths, the hats
       run in sixteenths, a swell and a roll of claps, and everything climbs to
       the downbeat it leads into (or to the last hit before a breakdown) */
    function genLift(seg) {
      padPart(seg, { v: 0.9, a: 0.25, r: 0.4 });
      const end = seg.stabT !== undefined ? seg.stabT : seg.end;
      const span = Math.max(0.25, end - seg.start);
      eachStep(seg, function (S) {
        if (S.t >= end - 1e-6) { return; }
        const p = clamp((S.t - seg.start) / span, 0, 1);
        const v = S.lv;
        if (S.k % 2 === 0) {
          put('keys', S.t, { ms: S.C.keys, d: 0.2, v: (0.3 + 0.6 * p) * v, ch: S.chord });
          if (p > 0.25) { put('bass', S.t, { m: S.C.bass, d: 0.17, v: (0.45 + 0.4 * p) * v, a: 0.01, ch: S.chord }); }
          put('pluck', S.t, { m: S.C.arp[CELL[(S.k / 2) % 8]], d: 0.2, v: (0.45 + 0.35 * p) * v, pan: (S.s % 4 < 2 ? -0.3 : 0.3), ch: S.chord });
        }
        put('hat', S.t, { v: (0.14 + 0.42 * p) * v });
      });
      riserAt(seg.start, Math.max(0.3, end - seg.start), 0.3, 300, 7000);
      /* a roll of claps into the hit, when the lift carries enough or leads into a groove */
      if (seg.energy >= 0.58 || (seg.next && seg.next.name === 'groove')) { rollBefore(end, Math.min(6, Math.floor(span / STEP)), 0.2, 0.8); }
      if (seg.stabT !== undefined) { stab(seg); }
    }

    /* The breakdown under BREAKING NEWS, which is in D minor: a soft D pedal,
       the octaves and the fifth and no third, no rhythm. It swells in under the
       ring of the groove's last hit and is felt more than heard. */
    function genPedal(seg) {
      /* it starts under the last hit of the groove, which rings over it */
      const t0 = seg.prev && seg.prev.stabT !== undefined ? seg.prev.stabT : seg.start;
      put('pad', t0, { ms: [50, 57, 62], d: seg.end - t0, v: PEDAL.pad, a: 1.8, r: 0.8, ch: 'D5' });
      /* the low D goes on through the build that follows, into the groove */
      const until = seg.next && seg.next.name === 'build' ? seg.next.end : seg.end;
      put('bass', t0, { m: 38, d: until - t0, v: PEDAL.bass, a: 1.6, r: 0.6, ch: 'D5' });
    }
    /* The breakdown under the report on the hour, which is in D major: a warm D
       pad with no drums. Its notes are the fifth and the third and a D far below,
       never a D in the middle: the fanfare's third chord is A major (a C sharp),
       and a D beside it would rub. Two voicings take turns, a few seconds each,
       and cross over slowly. */
    function genPad(seg) {
      /* it starts under the last hit of the groove, which rings over it */
      const t0 = seg.prev && seg.prev.stabT !== undefined ? seg.prev.stabT : seg.start;
      const voicings = [[57, 66, 69], [54, 57, 69]];
      let n = 0;
      for (let t = t0; t < seg.end - 0.5; t += 2 * BAR, n++) {
        const d = Math.min(2 * BAR, seg.end - t) + 0.4;
        put('pad', t, { ms: voicings[n % 2], d: d, v: PAD.pad, a: 2.0, r: 2.2, ch: 'D' });
      }
      put('bass', t0, { m: 38, d: seg.end - t0, v: PAD.bass, a: 1.6, r: 1.6, ch: 'D' });
    }

    /* Under a story once its jingle is done: the groove's beat comes back over
       the D and its fifth, kick, hats, shaker and the bass line, with no piano,
       pluck or bells, so the music never stops for the news and has no third
       to rub against the jingles around it. */
    function genDrive(seg) {
      put('pad', seg.start, { ms: CHORDS.D5.pad, d: seg.end - seg.start + 0.2, v: DRIVE.pad, a: 0.5, r: 0.8, ch: 'D5' });
      eachStep(seg, function (S) {
        grooveStep(S, { kick: 1, hat: 1, shaker: true, bass: 2 });
      });
    }

    /* rising: out of a groove it pulls back a little and builds, with the kick
       and the claps, the hats and plucks in sixteenths, a swell and a roll into
       the logo; out of a breakdown it grows from the pedal or the pad; a short
       one is a fill */
    function genBuild(seg) {
      const len = seg.end - seg.start;
      const low = (seg.prev && seg.prev.name === 'pedal') || underHourChord(seg);
      padPart(seg, { v: low ? 0.7 : 1, a: Math.min(0.5, len * 0.4), r: 0.8 });
      if (len < 1.5) {
        riserAt(seg.start, len, 0.4, 400, 9000);
        rollBefore(seg.end, Math.max(2, Math.floor(len / STEP)), 0.25, 0.9);
        eachStep(seg, function (S) { put('hat', S.t, { v: (0.2 + 0.4 * S.r) * S.lv }); });
        return;
      }
      const rollFrom = seg.end - 8 * STEP;
      eachStep(seg, function (S) {
        const r = S.r;
        const L = {
          kick: r > (low ? 0.45 : 0.25) ? 2 : (low ? 0 : 1),
          clap: r > 0.66 && S.t < rollFrom,
          hat: r < 0.2 ? (low ? 0 : 1) : (r < 0.5 ? 1 : 2),
          open: false,
          shaker: r > 0.5,
          bass: low ? (r > 0.3 ? 1 : 0) : (r < 0.34 ? 1 : 2),
          keys: r > 0.4 ? 1 : 0,
          pluck: r < 0.2 ? (low ? 0 : 2) : (r < 0.55 ? 2 : 3),
          bell: 0
        };
        grooveStep(S, L);
      });
      riserAt(seg.start, len, 0.5, 250, 9000);
      rollBefore(seg.end, 8, 0.25, 0.95);
    }

    /* the full theme: the groove at its peak, bells climbing B D C# E and
       landing on the D that opens the outro */
    function genFinale(seg) {
      padPart(seg, { v: 1.05, a: 0.15, r: 0.6 });
      eachStep(seg, function (S) {
        grooveStep(S, {
          kick: 2, clap: true, hat: 2, open: true, shaker: true, bass: 2, keys: 2, pluck: 3, bell: 0
        });
      });
      const len = seg.end - seg.start;
      const line = [83, 86, 85, 88];
      line.forEach(function (m, j) {
        const t = seg.end - 2 + j * BEAT;
        if (t < seg.start - 1e-6 || t >= seg.end - 1e-6) { return; }
        put('bell', t, { m: m, d: 0.9, v: 0.38, pan: j % 2 ? 0.1 : -0.1, ch: chordName(seg, t) });
        put('pluck', t, { m: m - 12, d: 0.3, v: 0.7, pan: 0, ch: chordName(seg, t) });
      });
      if (len > 0.5 && seg.next && seg.next.name !== 'silence') { rollBefore(seg.end, 2, 0.3, 0.5); }
      if (seg.stabT !== undefined) { stab(seg); }
    }

    /* the warm D major chord of the jingles, ringing out under a few soft
       pluck notes, the logo whispered once, and a fade to nothing */
    function genOutro(seg) {
      const t0 = seg.start;
      const len = seg.end - seg.start;
      padPart(seg, { v: 1.2, a: 0.3, r: 2.0 });
      [50, 54, 57, 62].forEach(function (m) { put('brass', t0, { m: m, d: 0.3, v: 0.1 * 1.4, rel: 1.8, ch: 'D' }); });
      put('brass', t0, { m: 38, d: 0.3, v: 0.06 * 1.4, rel: 1.8, ch: 'D' });
      put('timp', t0, { m: 38, v: 0.42, ring: 1.3 });
      put('bell', t0, { m: 86, d: 3.2, v: 0.4, pan: 0.1, ch: 'D' });
      put('bell', t0, { m: 74, d: 2.6, v: 0.24, pan: -0.1, ch: 'D' });
      put('trem', t0, { m: 57, d: 2.4, v: 0.04 });
      put('trem', t0, { m: 62, d: 2.4, v: 0.03 });
      put('keys', t0, { ms: CHORDS.D.keys, d: Math.min(3.6, len * 0.6), v: 1, ch: 'D' });
      put('bass', t0, { m: 50, d: Math.min(4.0, len * 0.66), v: 0.32, a: 0.02, r: 1.0, ch: 'D' });
      kickAt(t0, 0.75);
      eachStep(seg, function (S) {
        const tau = S.t - t0;
        let j = -1;
        let d = 0;
        if (tau < BAR && S.k % 2 === 0) { j = S.k / 2; d = 1 - 0.3 * (tau / BAR); }
        else if (tau < 2 * BAR && S.k % 4 === 0) { j = S.k / 2; d = 0.55; }
        else if (tau < 3 * BAR && S.k % 8 === 0) { j = S.k / 2; d = 0.4; }
        if (j >= 0) {
          put('pluck', S.t, { m: S.C.arp[CELL[j]], d: 0.25, v: 0.5 * d, pan: (S.s % 4 < 2 ? -0.3 : 0.3), ch: S.chord });
        }
      });
      /* the logo, whispered */
      const offs = [1.5, 2.0, 2.5, 3.5];
      offs.forEach(function (o, j) {
        const t = t0 + o;
        if (t >= seg.end - 0.5) { return; }
        put('bell', t, { m: LOGO[j], d: j === 3 ? 2.4 : 1.2, v: [0.13, 0.13, 0.14, 0.2][j], pan: j % 2 ? 0.15 : -0.15, ch: 'D' });
      });
    }

    segs.forEach(function (seg) {
      switch (seg.name) {
        case 'intro': genIntro(seg); break;
        case 'logo': genLogo(seg); break;
        case 'groove': genGroove(seg); break;
        case 'lift': genLift(seg); break;
        case 'pedal': genPedal(seg); break;
        case 'pad': genPad(seg); break;
        case 'drive': genDrive(seg); break;
        case 'build': genBuild(seg); break;
        case 'finale': genFinale(seg); break;
        case 'outro': genOutro(seg); break;
      }
    });

    /* nothing sounds in a silence (a safety), or past the end */
    const quiet = segs.filter(function (s) { return s.name === 'silence'; });
    function inSilence(t) {
      for (let i = 0; i < quiet.length; i++) {
        if (t >= quiet[i].start - 1e-6 && t < quiet[i].end - 1e-6) { return true; }
      }
      return false;
    }
    events = events.filter(function (e) { return e.t < DUR - 0.01 && !inSilence(e.t); });
    duck = duck.filter(function (d) { return d.t < DUR && !inSilence(d.t); });
    events.sort(function (a, b) { return a.t - b.t; });
    duck.sort(function (a, b) { return a.t - b.t; });

    /* ---- automation ---- */
    /* the tone of the whole mix follows the energy: a lowpass that opens as
       the music fills, shared by every filtered bus (as a curve of
       [seconds, hertz]). Into a breakdown it closes over a second, so that
       what rings from the last hit goes dark with it, not at once. */
    function cutoffHz(e) { return Math.exp(lerp(Math.log(700), Math.log(20000), Math.pow(clamp(e, 0, 1), 0.9))); }
    const cutoff = [];
    let lastHz = null;
    function add(t, hz) {
      if (cutoff.length && t <= cutoff[cutoff.length - 1][0]) { t = cutoff[cutoff.length - 1][0] + 0.001; }
      cutoff.push([t, hz]);
      lastHz = hz;
    }
    segs.forEach(function (seg) {
      if (seg.name === 'silence') { return; }
      const hz0 = cutoffHz(energyAt(seg, seg.start));
      const glide = lastHz !== null && hz0 < lastHz * 0.6 ? 0.9 : 0;
      if (lastHz !== null) { add(seg.start - 0.002, lastHz); }
      add(seg.start + glide, hz0);
      const step = (seg.name === 'build' || seg.name === 'intro' || seg.name === 'outro' || seg.name === 'lift') ? 0.25 : 1;
      for (let t = seg.start + step; t < seg.end - 1e-6; t += step) {
        if (t <= seg.start + glide + 1e-6) { continue; }
        add(t, cutoffHz(energyAt(seg, t)));
      }
    });
    if (cutoff.length === 0) { cutoff.push([0, 12000]); }
    if (cutoff[0][0] > 0) { cutoff.unshift([0, cutoff[0][1]]); }

    const outros = segs.filter(function (s) { return s.name === 'outro'; });
    let fade;
    if (outros.length) {
      const o = outros[outros.length - 1];
      const fl = o.end - o.start;
      fade = { t0: Math.max(o.start + 1.5, o.end - Math.min(4.0, fl * 0.65)), t1: o.end - 0.08 };
    } else {
      fade = { t0: DUR - 0.6, t1: DUR - 0.03 };
    }

    return {
      duration: DUR, bpm: BPM, step: STEP, bar: BAR,
      segs: segs, events: events, duck: duck, cutoff: cutoff, fade: fade,
      chordAt: chordAtTime
    };
  }

  /* ------------------------------------------------------------------
     The synth. The bundle's instruments are copied (routed to buses); the
     rest are new.
     ------------------------------------------------------------------ */
  /* white noise, as the bundle makes it */
  function noise(ctx, seconds) {
    const rnd = seeded(7151);
    const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = rnd() * 2 - 1; }
    return buf;
  }
  /* A hall: stereo noise with an exponential decay, as the bundle's, with the
     tail growing darker as it goes (`damp` is the one-pole coefficient it
     ends on: lower is darker) */
  function hall(ctx, seconds, power, seed, damp) {
    const sr = ctx.sampleRate;
    const n = Math.floor(sr * seconds);
    const buf = ctx.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const rnd = seeded(seed + ch * 31);
      const d = buf.getChannelData(ch);
      const pre = Math.floor(sr * 0.012);
      let lp = 0;
      for (let i = pre; i < n; i++) {
        const x = i - pre;
        const a = lerp(0.85, damp, Math.min(1, x / (sr * 1.2)));
        lp += a * ((rnd() * 2 - 1) - lp);
        d[i] = lp * Math.pow(1 - x / (n - pre), power);
      }
    }
    return buf;
  }

  /* The levels of the mix. level: the bus fader. hp: a highpass in hertz. lp:
     a lowpass that follows the energy, times this much of the shared curve.
     hall, plate: sends to the two reverbs. delay, delayR: sends to the
     ping-pong delay that starts on the left, and on the right. duck: how far
     the kick pushes it down. */
  const BUS = {
    kick:   { level: 0.34, hp: 30 },
    clap:   { level: 1.26, hp: 280, plate: 0.45 },
    hat:    { level: 1.25, hp: 6000, lp: 2.6, lpFixed: 11000 },
    shaker: { level: 0.39, hp: 3200, lp: 2.6, lpFixed: 11000 },
    bass:   { level: 0.11, hp: 36, lp: 0.85, sat: 1.9, duck: 0.6 },
    keys:   { level: 0.23, hp: 170, lp: 1.6, plate: 0.30, hall: 0.35, delay: 0.04, duck: 0.28, chorus: true, trem: true },
    pad:    { level: 0.16, hp: 190, lp: 1.1, hall: 0.8, duck: 0.45 },
    pluck:  { level: 0.8, hp: 260, lp: 1.5, plate: 0.2, hall: 0.35, delay: 0.55, duck: 0.22 },
    bell:   { level: 0.70, hp: 330, hall: 0.9, delayR: 0.18, duck: 0.08 },
    brass:  { level: 0.21, hp: 70 },
    perc:   { level: 0.35, hp: 40 },
    fx:     { level: 0.42, hp: 140, hall: 0.6 }
  };
  const TARGET = { lufs: -15.5, ceiling: 0.871 }; // -15.5 LUFS integrated, true peak under -1.2 dBFS

  /* the end of the chain: a highpass, the fade-out,
     the bundle's gentle compressor and its limiter */
  function masterChain(ctx, noComp) {
    const input = ctx.createGain();
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 30;
    hp.Q.value = 0.5;
    const fade = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 10;
    comp.ratio.value = 2;
    comp.attack.value = 0.012;
    comp.release.value = 0.2;
    const limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -2;
    limit.knee.value = 0;
    limit.ratio.value = 20;
    limit.attack.value = 0.002;
    limit.release.value = 0.09;
    input.connect(hp);
    hp.connect(fade);
    if (noComp) {
      fade.connect(ctx.destination);
    } else {
      fade.connect(comp);
      comp.connect(limit);
      limit.connect(ctx.destination);
    }
    return { input: input, fade: fade };
  }

  function satCurve(drive) {
    const n = 2048;
    const c = new Float32Array(n);
    const norm = Math.tanh(drive);
    for (let i = 0; i < n; i++) { c[i] = Math.tanh(drive * (i / (n - 1) * 2 - 1)) / norm; }
    return c;
  }

  function makeMixer(ctx, sc, opts) {
    const m = { ctx: ctx, bus: {}, cut: [] };
    const end = sc.duration + 1;
    m.white = noise(ctx, 2);
    m.master = masterChain(ctx, opts.noComp);
    const sum = ctx.createGain();
    sum.gain.value = 0.6;
    sum.connect(m.master.input);
    m.sum = sum;

    /* two reverbs: a hall for the pad, bells and brass, a short plate for the
       claps and the piano; both come back highpassed and a little dark */
    function reverb(buf, ret) {
      const send = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 220;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 8500;
      const out = ctx.createGain();
      out.gain.value = ret;
      send.connect(conv);
      conv.connect(hp);
      hp.connect(lp);
      lp.connect(out);
      out.connect(sum);
      return send;
    }
    m.hall = reverb(hall(ctx, 2.6, 3.2, 911, 0.2), 0.3);
    m.plate = reverb(hall(ctx, 1.0, 3.6, 4207, 0.35), 0.3);

    /* the ping-pong delays: a dotted eighth, each echo softer and darker than
       the one before, jumping from one side to the other. The pluck's goes left
       first and the bells' right first, so the two balance. The echoes are taps
       in a row, not a feedback loop: Web Audio renders a loop of delays in a
       different order from one render to the next, and the echoes would move
       by a few milliseconds each time. */
    const dOut = ctx.createGain();
    dOut.gain.value = 0.8;
    dOut.connect(sum);
    function pingPong(firstSide) {
      const dIn = ctx.createGain();
      const dHp = ctx.createBiquadFilter();
      dHp.type = 'highpass';
      dHp.frequency.value = 300;
      dIn.connect(dHp);
      [[1, 7000], [0.46, 3600], [0.21, 3000], [0.1, 2500], [0.045, 2100]].forEach(function (tap, n) {
        const d = ctx.createDelay(2.5);
        d.delayTime.value = sc.step * 3 * (n + 1);
        const tone = ctx.createBiquadFilter();
        tone.type = 'lowpass';
        tone.frequency.value = tap[1];
        const g = ctx.createGain();
        g.gain.value = tap[0];
        const p = ctx.createStereoPanner();
        p.pan.value = (n % 2 ? -firstSide : firstSide) * 0.85;
        dHp.connect(d);
        d.connect(tone);
        tone.connect(g);
        g.connect(p);
        p.connect(dOut);
      });
      return dIn;
    }
    m.delay = pingPong(-1);
    m.delayR = pingPong(1);
    const dSend = ctx.createGain();
    dSend.gain.value = 0.3;
    dOut.connect(dSend);
    dSend.connect(m.hall);

    Object.keys(BUS).forEach(function (name) {
      const o = Object.assign({}, BUS[name], (opts.bus && opts.bus[name]) || {});
      const input = ctx.createGain();
      let node = input;
      let f;
      if (o.hp) {
        f = ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = o.hp;
        f.Q.value = 0.5;
        node.connect(f);
        node = f;
      }
      if (o.lp) {
        f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 12000;
        f.Q.value = 0.5;
        f.frequency.automationRate = 'k-rate';
        m.cut.push([f.frequency, o.lp]);
        node.connect(f);
        node = f;
      }
      if (o.lpFixed) {
        f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = o.lpFixed;
        f.Q.value = 0.5;
        node.connect(f);
        node = f;
      }
      if (o.sat) {
        const w = ctx.createWaveShaper();
        w.curve = satCurve(o.sat);
        w.oversample = '2x';
        node.connect(w);
        node = w;
      }
      if (o.trem) {
        /* a touch of tremolo */
        const tg = ctx.createGain();
        tg.gain.value = 0.9;
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 4.6;
        const depth = ctx.createGain();
        depth.gain.value = 0.1;
        lfo.connect(depth);
        depth.connect(tg.gain);
        lfo.start(0);
        lfo.stop(end);
        node.connect(tg);
        node = tg;
      }
      if (o.chorus) {
        /* two slow delays, left and right: a wider, softer piano */
        const cOut = ctx.createGain();
        const dry = ctx.createGain();
        dry.gain.value = 0.72;
        node.connect(dry);
        dry.connect(cOut);
        [0, 1].forEach(function (i) {
          const d = ctx.createDelay(0.05);
          d.delayTime.value = i ? 0.0165 : 0.0105;
          const l = ctx.createOscillator();
          l.frequency.value = i ? 0.43 : 0.57;
          const lg = ctx.createGain();
          lg.gain.value = 0.0028;
          l.connect(lg);
          lg.connect(d.delayTime);
          l.start(0);
          l.stop(end);
          const p = ctx.createStereoPanner();
          p.pan.value = i ? 0.85 : -0.85;
          const wg = ctx.createGain();
          wg.gain.value = 0.45;
          node.connect(d);
          d.connect(wg);
          wg.connect(p);
          p.connect(cOut);
        });
        node = cOut;
      }
      const dk = ctx.createGain();
      node.connect(dk);
      const fader = ctx.createGain();
      fader.gain.value = o.level;
      dk.connect(fader);
      fader.connect(sum);
      [['hall', m.hall], ['plate', m.plate], ['delay', m.delay], ['delayR', m.delayR]].forEach(function (s) {
        if (o[s[0]]) {
          const g = ctx.createGain();
          g.gain.value = o[s[0]];
          fader.connect(g);
          g.connect(s[1]);
        }
      });
      m.bus[name] = { input: input, duck: dk.gain, depth: o.duck || 0 };
    });
    return m;
  }

  /* a gain that goes to a bus, with a send of its own to the hall (the bundle's voice) */
  function voice(m, busName, send) {
    const g = m.ctx.createGain();
    g.connect(m.bus[busName].input);
    if (send) {
      const s = m.ctx.createGain();
      s.gain.value = send;
      g.connect(s);
      s.connect(m.hall);
    }
    return g;
  }
  function noiseAt(m, t, dur, salt) {
    const n = m.ctx.createBufferSource();
    n.buffer = m.white;
    n.start(t, hash01(Math.round(t * 1000), salt || 0) * 1.5, dur);
    return n;
  }
  function biquad(ctx, type, f, q) {
    const b = ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    if (q !== undefined) { b.Q.value = q; }
    return b;
  }

  /* ---- the bundle's instruments (routed to buses) ---- */
  function brass(m, e) {
    const ctx = m.ctx;
    const t = e.t, f = mtof(e.m), dur = e.d, vel = e.v;
    const r = e.rel || 0.28;
    const out = voice(m, 'brass', 0.8);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vel, t + 0.018);
    amp.gain.exponentialRampToValueAtTime(vel * 0.6, t + 0.16);
    amp.gain.setValueAtTime(vel * 0.6, t + dur);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * 10, 8000), t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * 4, 5000), t + 0.3);
    [-8, 0, 7].forEach(function (cents) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 0.985, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + r + 0.04);
    });
    lp.connect(amp);
    amp.connect(out);
  }
  function timpani(m, e) {
    const ctx = m.ctx;
    const t = e.t, f = mtof(e.m), vel = e.v;
    const out = voice(m, 'perc', 0.5);
    const len = e.ring || 1.1;
    [[1, len], [1.5, len * 0.36], [1.99, len * 0.23]].forEach(function (p, i) {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * p[0] * 1.45, t);
      o.frequency.exponentialRampToValueAtTime(f * p[0], t + 0.045);
      const g = ctx.createGain();
      const v = vel * (i === 0 ? 1 : 0.35);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p[1]);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + p[1] + 0.05);
    });
    const n = noiseAt(m, t, 0.1, 11);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(lp);
    lp.connect(ng);
    ng.connect(out);
  }
  function boom(m, e) {
    const ctx = m.ctx;
    const t = e.t;
    const out = voice(m, 'perc', 0.2);
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(e.v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 1.25);
  }
  function crash(m, e) {
    const ctx = m.ctx;
    const t = e.t;
    const out = voice(m, 'fx', 0.9);
    const n = noiseAt(m, t, 1.95, 12);
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(e.v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    n.connect(hp);
    hp.connect(g);
    g.connect(out);
  }
  function riser(m, e) {
    const ctx = m.ctx;
    const t = e.t, dur = e.d;
    const out = voice(m, 'fx', 0.6);
    const n = m.ctx.createBufferSource();
    n.buffer = m.white;
    n.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(e.lo, t);
    bp.frequency.exponentialRampToValueAtTime(e.hi, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(e.v, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    n.connect(bp);
    bp.connect(g);
    g.connect(out);
    n.start(t, 0);
    n.stop(t + dur + 0.05);
  }
  /* The logo's own voice: a bright FM bell */
  function bell(m, e) {
    const ctx = m.ctx;
    const t = e.t, f = mtof(e.m), dur = e.d, vel = e.v;
    let out = voice(m, 'bell', 0);
    if (e.pan) {
      const pn = ctx.createStereoPanner();
      pn.pan.value = e.pan;
      pn.connect(out);
      out = pn;
    }
    const car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.value = f;
    const mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = f * 3.5;
    const idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 2.2, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.25, t + dur * 0.6);
    mod.connect(idx);
    idx.connect(car.frequency);
    const oct = ctx.createOscillator();
    oct.type = 'triangle';
    oct.frequency.value = f * 2;
    const og = ctx.createGain();
    og.gain.value = 0.18;
    oct.connect(og);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    og.connect(g);
    g.connect(out);
    [car, mod, oct].forEach(function (o) { o.start(t); o.stop(t + dur + 0.05); });
  }
  function tremolo(m, e) {
    const ctx = m.ctx;
    const t = e.t, f = mtof(e.m), dur = e.d, vel = e.v;
    const out = voice(m, 'brass', 1);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.08);
    g.gain.setValueAtTime(vel, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const trem = ctx.createGain();
    trem.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(trem.gain);
    [-6, 6].forEach(function (cents) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
    lp.connect(trem);
    trem.connect(g);
    g.connect(out);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  /* ---- the new instruments ---- */
  /* a soft, punchy kick: a sine that falls from 170 to 46 Hz, and a click */
  function kick(m, e) {
    const ctx = m.ctx;
    const t = e.t, v = e.v;
    const out = m.bus.kick.input;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(190, t);
    o.frequency.exponentialRampToValueAtTime(66, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.32);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.002);
    g.gain.exponentialRampToValueAtTime(v * 0.55, t + 0.09);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.4);
    const n = noiseAt(m, t, 0.02, 21);
    const bp = biquad(ctx, 'bandpass', 2600, 0.9);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.linearRampToValueAtTime(v * 0.16, t + 0.001);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    n.connect(bp);
    bp.connect(ng);
    ng.connect(out);
  }
  /* a clap: three quick bursts of band-passed noise and a tail (`short`: one
     burst and a short tail, for rolls) */
  function clap(m, e) {
    const ctx = m.ctx;
    const t = e.t, v = e.v;
    const out = m.bus.clap.input;
    const tail = e.short ? 0.07 : 0.2;
    const offs = e.short ? [0] : [0, 0.011, 0.023];
    const n = noiseAt(m, t, offs[offs.length - 1] + tail + 0.03, 31);
    const bp = biquad(ctx, 'bandpass', 1450, 0.8);
    const g = ctx.createGain();
    const gp = g.gain;
    gp.setValueAtTime(0.0001, t);
    offs.forEach(function (o, i) {
      const last = i === offs.length - 1;
      gp.linearRampToValueAtTime(v * (last ? 1 : 0.85), t + o + 0.0012);
      if (!last) {
        gp.exponentialRampToValueAtTime(v * 0.12, t + o + 0.0095);
        gp.linearRampToValueAtTime(0.0001, t + o + 0.0105);
      } else {
        gp.exponentialRampToValueAtTime(0.0001, t + o + tail);
      }
    });
    n.connect(bp);
    bp.connect(g);
    g.connect(out);
    if (!e.short) {
      const b = ctx.createOscillator();
      b.type = 'sine';
      b.frequency.setValueAtTime(200, t);
      b.frequency.exponentialRampToValueAtTime(150, t + 0.05);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t);
      bg.gain.linearRampToValueAtTime(v * 0.22, t + 0.002);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      b.connect(bg);
      bg.connect(out);
      b.start(t);
      b.stop(t + 0.09);
    }
  }
  /* closed and open hats: a puff of noise; the bus keeps only its top */
  function hat(m, e) {
    const ctx = m.ctx;
    const t = e.t;
    const dec = e.open ? 0.2 : 0.045;
    const n = noiseAt(m, t, dec + 0.02, 41);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(e.v, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    n.connect(g);
    g.connect(m.bus.hat.input);
  }
  function shaker(m, e) {
    const ctx = m.ctx;
    const t = e.t;
    const n = noiseAt(m, t, 0.09, 51);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(e.v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    let out = g;
    if (e.pan) {
      const p = ctx.createStereoPanner();
      p.pan.value = e.pan;
      g.connect(p);
      out = p;
    }
    n.connect(g);
    out.connect(m.bus.shaker.input);
  }
  /* a round bass: a sine and a saw through a falling lowpass; the bus adds
     a little warmth on top so that small speakers hear it */
  function bass(m, e) {
    const ctx = m.ctx;
    const t = e.t, d = Math.max(0.06, e.d), f = mtof(e.m);
    const a = e.a || 0.008;
    const rel = e.r || 0.07;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(e.v, t + a);
    g.gain.setValueAtTime(e.v, t + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + rel);
    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = f;
    const low = ctx.createOscillator();
    low.type = 'sine';
    low.frequency.value = f / 2;
    const lowG = ctx.createGain();
    lowG.gain.value = 0.35;
    const saw = ctx.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2;
    lp.frequency.setValueAtTime(Math.min(f * 8, 2400), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 3, 240), t + 0.14);
    const sg = ctx.createGain();
    sg.gain.value = 0.4;
    body.connect(g);
    low.connect(lowG);
    lowG.connect(g);
    saw.connect(lp);
    lp.connect(sg);
    sg.connect(g);
    g.connect(m.bus.bass.input);
    [body, low, saw].forEach(function (o) {
      o.start(t);
      o.stop(t + d + rel + 0.03);
    });
  }
  /* an electric piano: FM with a sine carrier and a modulator at the same
     pitch, its index falling fast (a bark, then a mellow tone), and a tine
     14 times higher that only lives at the attack */
  function keys(m, e) {
    const ctx = m.ctx;
    const t = e.t;
    const v = e.v;
    e.ms.forEach(function (midi) {
      const f = mtof(midi);
      const car = ctx.createOscillator();
      car.frequency.value = f;
      const mod = ctx.createOscillator();
      mod.frequency.value = f;
      const tine = ctx.createOscillator();
      tine.frequency.value = f * 14;
      const i1 = ctx.createGain();
      i1.gain.setValueAtTime(f * (0.7 + 1.5 * v), t);
      i1.gain.exponentialRampToValueAtTime(f * 0.12, t + 0.5);
      const i2 = ctx.createGain();
      i2.gain.setValueAtTime(f * (0.2 + 0.45 * v), t);
      i2.gain.exponentialRampToValueAtTime(f * 0.004, t + 0.035);
      mod.connect(i1);
      i1.connect(car.frequency);
      tine.connect(i2);
      i2.connect(car.frequency);
      const p = v * 0.5;
      const end = t + e.d;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(p, t + 0.003);
      g.gain.exponentialRampToValueAtTime(p * Math.pow(0.18, Math.min(e.d, 2.2) / 2.2), end);
      g.gain.exponentialRampToValueAtTime(0.0001, end + 0.16);
      car.connect(g);
      g.connect(m.bus.keys.input);
      [car, mod, tine].forEach(function (o) { o.start(t); o.stop(end + 0.2); });
    });
  }
  /* a warm pad: detuned saws, three to a note, spread left to right, through
     a lowpass that opens while the chord comes in */
  function pad(m, e) {
    const ctx = m.ctx;
    const t = e.t, d = e.d, v = e.v;
    const a = Math.max(0.01, e.a);
    const r = e.r;
    const env = ctx.createGain();
    env.gain.setValueAtTime(a > 0.15 ? v * 0.03 : 0.0001, t);
    env.gain.exponentialRampToValueAtTime(v, t + a);
    env.gain.setValueAtTime(v, t + Math.max(a + 0.001, d));
    env.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.001, d) + r);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 1;
    lp.frequency.setValueAtTime(800, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + Math.max(a, 0.1) * 1.2);
    [-9, 0, 9].forEach(function (cents, gi) {
      const gg = ctx.createGain();
      gg.gain.value = 0.34;
      const pn = ctx.createStereoPanner();
      pn.pan.value = [-0.55, 0, 0.55][gi];
      gg.connect(pn);
      pn.connect(lp);
      e.ms.forEach(function (midi) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(midi);
        o.detune.value = cents;
        o.connect(gg);
        o.start(t);
        o.stop(t + Math.max(a + 0.001, d) + r + 0.05);
      });
    });
    lp.connect(env);
    env.connect(m.bus.pad.input);
  }
  /* a pluck for the arpeggios: two detuned saws through a quick lowpass; the
     bus sends it to the ping-pong delay */
  function pluck(m, e) {
    const ctx = m.ctx;
    const t = e.t, f = mtof(e.m);
    let out = m.bus.pluck.input;
    if (e.pan) {
      const pn = ctx.createStereoPanner();
      pn.pan.value = e.pan;
      pn.connect(out);
      out = pn;
    }
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 2.5;
    lp.frequency.setValueAtTime(Math.min(f * 5, 6000), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(f * 1.6, 600), t + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(e.v * 0.5, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + e.d + 0.1);
    [-6, 6].forEach(function (cents) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      o.start(t);
      o.stop(t + e.d + 0.14);
    });
    lp.connect(g);
    g.connect(out);
  }

  const PLAYERS = {
    kick: kick, clap: clap, hat: hat, shaker: shaker, bass: bass, keys: keys, pad: pad, pluck: pluck,
    bell: bell, brass: brass, timp: timpani, boom: boom, crash: crash, riser: riser, trem: tremolo
  };
  const STEM = {
    kick: 'kick', clap: 'clap', hat: 'hat', shaker: 'shaker', bass: 'bass', keys: 'keys', pad: 'pad', pluck: 'pluck',
    bell: 'bell', brass: 'brass', timp: 'perc', boom: 'perc', crash: 'fx', riser: 'fx', trem: 'brass'
  };
  const SOLO_GROUPS = { drums: ['kick', 'clap', 'hat', 'shaker'] };

  /* the automation of the score: the shared lowpass, the kick's ducking and
     the fade-out */
  function automate(m, sc) {
    m.cut.forEach(function (x) {
      const p = x[0], k = x[1];
      p.setValueAtTime(clamp(sc.cutoff[0][1] * k, 20, 20000), 0);
      for (let i = 1; i < sc.cutoff.length; i++) {
        p.exponentialRampToValueAtTime(clamp(sc.cutoff[i][1] * k, 20, 20000), sc.cutoff[i][0]);
      }
    });
    Object.keys(m.bus).forEach(function (name) {
      const b = m.bus[name];
      if (!b.depth) { return; }
      b.duck.setValueAtTime(1, 0);
      sc.duck.forEach(function (d, i) {
        const next = sc.duck[i + 1];
        const gap = next ? next.t - d.t : 1;
        const rel = Math.min(0.3, gap * 0.8);
        if (rel < 0.06) { return; }
        b.duck.setValueAtTime(1, Math.max(0, d.t - 0.004));
        b.duck.linearRampToValueAtTime(1 - b.depth * d.v, d.t + 0.006);
        b.duck.linearRampToValueAtTime(1, d.t + rel);
      });
    });
    const fp = m.master.fade.gain;
    fp.setValueAtTime(1, 0);
    if (sc.fade) {
      const n = 128;
      const curve = new Float32Array(n);
      for (let i = 0; i < n; i++) { curve[i] = Math.pow(Math.cos((i / (n - 1)) * Math.PI / 2), 1.2); }
      fp.setValueAtTime(1, sc.fade.t0);
      fp.setValueCurveAtTime(curve, sc.fade.t0, sc.fade.t1 - sc.fade.t0);
      fp.setValueAtTime(0, sc.fade.t1 + 0.001);
    }
  }

  /* ------------------------------------------------------------------
     After the render: the chain's own delay is taken out, the loudness is set
     and the peaks are kept under the ceiling.
     ------------------------------------------------------------------ */
  function offlineContext(channels, length, sr) {
    const C = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    return new C(channels, length, sr);
  }
  /* the samples the master chain delays everything by (its compressors look ahead) */
  function chainLatency(sr, noComp) {
    if (noComp) { return Promise.resolve(0); }
    const ctx = offlineContext(2, Math.round(sr * 0.2), sr);
    const chain = masterChain(ctx);
    const buf = ctx.createBuffer(1, 64, sr);
    buf.getChannelData(0)[0] = 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(chain.input);
    const at = Math.round(sr * 0.05);
    src.start(at / sr);
    return ctx.startRendering().then(function (out) {
      const d = out.getChannelData(0);
      let best = 0;
      let idx = at;
      for (let i = at; i < d.length; i++) {
        if (Math.abs(d[i]) > best) { best = Math.abs(d[i]); idx = i; }
      }
      return idx - at;
    });
  }

  /* BS.1770 K-weighting: a high shelf and a high pass, for any rate */
  function kWeight(x, sr) {
    function run(src, b, a) {
      const out = new Float32Array(src.length);
      let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
      for (let i = 0; i < src.length; i++) {
        const xi = src[i];
        const y = b[0] * xi + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2;
        x2 = x1; x1 = xi; y2 = y1; y1 = y;
        out[i] = y;
      }
      return out;
    }
    const G = 3.999843853973347, Q = 0.7071752369554196, fc = 1681.974450955533;
    const K = Math.tan(Math.PI * fc / sr);
    const Vh = Math.pow(10, G / 20);
    const Vb = Math.pow(Vh, 0.4996667741545416);
    const a0 = 1 + K / Q + K * K;
    const b1 = [(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0];
    const a1 = [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0];
    const fc2 = 38.13547087602444, Q2 = 0.5003270373238773;
    const K2 = Math.tan(Math.PI * fc2 / sr);
    const a02 = 1 + K2 / Q2 + K2 * K2;
    const a2 = [1, 2 * (K2 * K2 - 1) / a02, (1 - K2 / Q2 + K2 * K2) / a02];
    return run(run(x, b1, a1), [1, -2, 1], a2);
  }
  /* integrated loudness in LUFS (400 ms blocks, absolute and relative gate) */
  function loudness(L, R, sr) {
    const yl = kWeight(L, sr);
    const yr = kWeight(R, sr);
    const hop = Math.round(0.1 * sr);
    const nSub = Math.floor(L.length / hop);
    const ms = new Float64Array(nSub);
    for (let j = 0; j < nSub; j++) {
      let s = 0;
      for (let i = j * hop; i < (j + 1) * hop; i++) { s += yl[i] * yl[i] + yr[i] * yr[i]; }
      ms[j] = s / hop;
    }
    const blocks = [];
    for (let j = 0; j + 4 <= nSub; j++) { blocks.push((ms[j] + ms[j + 1] + ms[j + 2] + ms[j + 3]) / 4); }
    function lufs(z) { return -0.691 + 10 * Math.log10(z); }
    let kept = blocks.filter(function (z) { return z > 0 && lufs(z) > -70; });
    if (!kept.length) { return -70; }
    const mean = kept.reduce(function (a, b) { return a + b; }, 0) / kept.length;
    const rel = lufs(mean) - 10;
    kept = kept.filter(function (z) { return lufs(z) > rel; });
    if (!kept.length) { return lufs(mean); }
    return lufs(kept.reduce(function (a, b) { return a + b; }, 0) / kept.length);
  }
  /* the filters that estimate the signal between its samples (a windowed sinc
     through the twelve samples around a pair, at a quarter, a half and three
     quarters of the way), as a true-peak meter does */
  const BETWEEN = (function () {
    const half = 6;
    const phases = [];
    for (let p = 1; p < 4; p++) {
      const h = [];
      for (let k = -half + 1; k <= half; k++) {
        const x = k - p / 4;
        h.push((x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)) * 0.5 * (1 + Math.cos(Math.PI * x / half)));
      }
      phases.push(h);
    }
    return phases;
  })();
  /* the highest value x reaches between samples i and i + 1 */
  function peakBetween(x, i) {
    let m = 0;
    for (let p = 0; p < 3; p++) {
      const h = BETWEEN[p];
      let acc = 0;
      for (let k = 0; k < h.length; k++) {
        const j = i - 5 + k;
        if (j >= 0 && j < x.length) { acc += x[j] * h[k]; }
      }
      if (Math.abs(acc) > m) { m = Math.abs(acc); }
    }
    return m;
  }
  /* a look-ahead limiter that holds the signal, between its samples too, under
     `ceiling` (it takes a few milliseconds to come down and 60 ms to let go);
     it returns the lowest gain it used, 1 when it had nothing to do */
  function limitPeaks(L, R, ceiling, sr) {
    const n = L.length;
    const look = Math.max(1, Math.round(0.0015 * sr));
    const need = new Float32Array(n);
    let any = false;
    let i;
    for (i = 0; i < n; i++) {
      let p = Math.max(Math.abs(L[i]), Math.abs(R[i]));
      if (p > ceiling * 0.7) { p = Math.max(p, peakBetween(L, i), peakBetween(R, i)); }
      need[i] = p > ceiling ? ceiling / p : 1;
      if (p > ceiling) { any = true; }
    }
    if (!any) { return 1; }
    /* the lowest need in the next `look` samples */
    const fut = new Float32Array(n);
    const dq = [];
    let head = 0;
    for (i = n - 1; i >= 0; i--) {
      while (dq.length > head && need[dq[dq.length - 1]] >= need[i]) { dq.pop(); }
      dq.push(i);
      while (dq[head] > i + look) { head++; }
      fut[i] = need[dq[head]];
    }
    /* let go slowly, then smooth the way down over the look-ahead */
    const alpha = 1 - Math.exp(-1 / (0.06 * sr));
    const rel = new Float32Array(n);
    let prev = 1;
    for (i = 0; i < n; i++) {
      prev = Math.min(fut[i], prev + alpha * (1 - prev));
      rel[i] = prev;
    }
    let acc = 0;
    let worst = 1;
    for (i = 0; i < n; i++) {
      acc += rel[i];
      if (i >= look + 1) { acc -= rel[i - look - 1]; }
      const g = acc / Math.min(i + 1, look + 1);
      if (g < worst) { worst = g; }
      L[i] *= g;
      R[i] *= g;
    }
    return worst;
  }

  function finish(rendered, latency, sc, sr, opts) {
    const n = Math.round(sc.duration * sr);
    const L = new Float32Array(n);
    const R = new Float32Array(n);
    const a = rendered.getChannelData(0);
    const b = rendered.getChannelData(1);
    for (let i = 0; i < n; i++) {
      L[i] = (i + latency < a.length) ? a[i + latency] : 0;
      R[i] = (i + latency < b.length) ? b[i + latency] : 0;
    }
    if (!opts.raw) {
      const measured = loudness(L, R, sr);
      const L0 = L.slice();
      const R0 = R.slice();
      /* set the loudness, keep the peaks under the ceiling, measure again (the
         limiter takes a little off) and set it again for what it took */
      let gain = Math.pow(10, (TARGET.lufs - measured) / 20);
      let worst = 1;
      let after = measured;
      for (let pass = 0; pass < 4 && isFinite(gain) && gain > 0; pass++) {
        for (let i = 0; i < n; i++) { L[i] = L0[i] * gain; R[i] = R0[i] * gain; }
        worst = limitPeaks(L, R, TARGET.ceiling, sr);
        after = loudness(L, R, sr);
        if (Math.abs(after - TARGET.lufs) < 0.03) { break; }
        gain *= Math.pow(10, (TARGET.lufs - after) / 20);
      }
      root.mixReport = {
        measuredLufs: Math.round(measured * 10) / 10,
        gainDb: Math.round(20 * Math.log10(gain) * 10) / 10,
        limiterDb: Math.round(20 * Math.log10(worst) * 10) / 10,
        resultLufs: Math.round(after * 10) / 10
      };
      /* a hard guarantee */
      for (let i = 0; i < n; i++) {
        L[i] = clamp(L[i], -TARGET.ceiling, TARGET.ceiling);
        R[i] = clamp(R[i], -TARGET.ceiling, TARGET.ceiling);
      }
    }
    const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: sr });
    out.copyToChannel(L, 0);
    out.copyToChannel(R, 1);
    return out;
  }

  /* The whole soundtrack. `opts` is for working on it: { solo: ['bass', ...]
     plays only those stems (drums, kick, clap, hat, shaker, bass, keys, pad,
     pluck, bell, brass, perc, fx),
     raw: true skips the loudness and the limiter, noComp: true skips the
     compressors of the master chain, bus: { bell: { delay: 0 } } overrides
     entries of BUS }. */
  function renderSoundtrack(plan, sampleRate, opts) {
    opts = opts || {};
    const sr = sampleRate || 48000;
    const sc = buildScore(plan);
    const ctx = offlineContext(2, Math.ceil(sr * (sc.duration + 0.25)), sr);
    const m = makeMixer(ctx, sc, opts);
    automate(m, sc);
    const solo = opts.solo && opts.solo.reduce(function (all, x) { return all.concat(SOLO_GROUPS[x] || [x]); }, []);
    const events = sc.events.filter(function (e) {
      return PLAYERS[e.i] && !(solo && solo.indexOf(STEM[e.i]) < 0);
    });
    /* The notes are made a few seconds ahead of the render, not all at once: a
       graph of thousands of notes that have not started yet costs time on
       every render quantum. The render pauses every WINDOW seconds, makes the
       notes of the window after the next, and goes on. */
    const WINDOW = 4;
    let next = 0;
    function makeNotesBefore(until) {
      while (next < events.length && events[next].t < until) {
        PLAYERS[events[next].i](m, events[next]);
        next++;
      }
    }
    makeNotesBefore(2 * WINDOW);
    for (let k = 1; k * WINDOW < sc.duration; k++) {
      ctx.suspend(k * WINDOW).then(function () {
        makeNotesBefore((k + 2) * WINDOW);
        ctx.resume();
      });
    }
    return Promise.all([ctx.startRendering(), chainLatency(sr, opts.noComp)]).then(function (r) {
      return finish(r[0], r[1], sc, sr, opts);
    });
  }

  /* ------------------------------------------------------------------
     Sound effects: short, soft and tasteful in character. Each is a function
     of a context that draws it from t = 0, its length, and its peak in dBFS:
     the files are set loud (-3 dBFS, and -6 for the two swishes, which are
     noise) and meant to be turned down in the video's mix.
     ------------------------------------------------------------------ */
  function sfxNoise(ctx, seed) {
    const rnd = seeded(seed);
    const n = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { d[i] = rnd() * 2 - 1; }
    const s = ctx.createBufferSource();
    s.buffer = buf;
    return s;
  }
  function env(g, pts) {
    /* pts: [[seconds, value, 'lin'|'exp'], ...] starting with the first value */
    g.gain.setValueAtTime(pts[0][1], pts[0][0]);
    for (let i = 1; i < pts.length; i++) {
      if (pts[i][2] === 'lin') { g.gain.linearRampToValueAtTime(pts[i][1], pts[i][0]); }
      else { g.gain.exponentialRampToValueAtTime(pts[i][1], pts[i][0]); }
    }
  }
  function sine(ctx, type, f0, f1, tEnd) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, 0);
    if (f1 !== f0) { o.frequency.exponentialRampToValueAtTime(f1, tEnd); }
    o.start(0);
    return o;
  }
  function bell01(n, power, skew) {
    const c = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = Math.pow(i / (n - 1), skew);
      c[i] = Math.pow(Math.sin(Math.PI * x), power);
    }
    return c;
  }

  const SFX = {
    /* a soft trackpad click: a tick of band-passed noise and a hollow thud */
    click: { dur: 0.04, peak: -3, draw: function (c) {
      const n = sfxNoise(c, 101);
      const bp = biquad(c, 'bandpass', 3400, 1.1);
      const hp = biquad(c, 'highpass', 1200, 0.5);
      const g = c.createGain();
      env(g, [[0, 0.0001], [0.0007, 1, 'lin'], [0.02, 0.0001, 'exp']]);
      n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(c.destination);
      n.start(0, 0.2, 0.05);
      const o = sine(c, 'sine', 230, 120, 0.02);
      const og = c.createGain();
      env(og, [[0, 0.0001], [0.001, 0.55, 'lin'], [0.03, 0.0001, 'exp']]);
      o.connect(og); og.connect(c.destination);
    } },
    /* a soft swish for a camera move: air that swells and goes, its band rising */
    whoosh: { dur: 0.6, peak: -6, draw: function (c) {
      [0, 1].forEach(function (i) {
        const n = sfxNoise(c, 201 + i * 17);
        const bp = biquad(c, 'bandpass', 380, 1.0);
        bp.frequency.setValueAtTime(380, 0);
        bp.frequency.exponentialRampToValueAtTime(2600, 0.6);
        const hp = biquad(c, 'highpass', 300, 0.5);
        const lp = biquad(c, 'lowpass', 6500, 0.5);
        const g = c.createGain();
        g.gain.setValueAtTime(0, 0);
        g.gain.setValueCurveAtTime(bell01(256, 1.5, 0.85), 0, 0.6);
        const p = c.createStereoPanner();
        p.pan.setValueAtTime(i ? 0.5 : -0.5, 0);
        n.connect(bp); bp.connect(hp); hp.connect(lp); lp.connect(g); g.connect(p); p.connect(c.destination);
        n.start(0, 0.1 * i, 0.7);
      });
    } },
    /* a window appearing: a soft round bloop */
    pop: { dur: 0.15, peak: -3, draw: function (c) {
      const o = sine(c, 'sine', 300, 620, 0.055);
      const g = c.createGain();
      env(g, [[0, 0.0001], [0.004, 0.8, 'lin'], [0.14, 0.0001, 'exp']]);
      const o2 = sine(c, 'sine', 600, 1240, 0.055);
      const g2 = c.createGain();
      env(g2, [[0, 0.0001], [0.004, 0.16, 'lin'], [0.06, 0.0001, 'exp']]);
      const lp = biquad(c, 'lowpass', 3200, 0.5);
      o.connect(g); o2.connect(g2); g.connect(lp); g2.connect(lp); lp.connect(c.destination);
      const n = sfxNoise(c, 301);
      const bp = biquad(c, 'bandpass', 1400, 1.0);
      const ng = c.createGain();
      env(ng, [[0, 0.0001], [0.002, 0.1, 'lin'], [0.03, 0.0001, 'exp']]);
      n.connect(bp); bp.connect(ng); ng.connect(c.destination);
      n.start(0, 0.3, 0.05);
    } },
    /* one key of a keyboard: a plastic tick and a short thock */
    key: { dur: 0.05, peak: -3, draw: function (c) {
      const n = sfxNoise(c, 401);
      const g = c.createGain();
      env(g, [[0, 0.0001], [0.0008, 1, 'lin'], [0.012, 0.0001, 'exp']]);
      const a = biquad(c, 'bandpass', 1700, 3.5);
      const b = biquad(c, 'bandpass', 3900, 4.5);
      const bg = c.createGain();
      bg.gain.value = 0.7;
      n.connect(g); g.connect(a); g.connect(b); b.connect(bg);
      a.connect(c.destination); bg.connect(c.destination);
      n.start(0, 0.4, 0.06);
      const o = sine(c, 'sine', 150, 95, 0.025);
      const og = c.createGain();
      env(og, [[0, 0.0001], [0.001, 0.5, 'lin'], [0.035, 0.0001, 'exp']]);
      o.connect(og); og.connect(c.destination);
    } },
    /* a window docking into the screen edge: a soft low tap */
    thunk: { dur: 0.2, peak: -3, draw: function (c) {
      const o = sine(c, 'sine', 150, 55, 0.07);
      const g = c.createGain();
      env(g, [[0, 0.0001], [0.002, 0.9, 'lin'], [0.19, 0.0001, 'exp']]);
      const lp = biquad(c, 'lowpass', 900, 0.5);
      o.connect(g); g.connect(lp); lp.connect(c.destination);
      const n = sfxNoise(c, 501);
      const nl = biquad(c, 'lowpass', 500, 0.5);
      const ng = c.createGain();
      env(ng, [[0, 0.0001], [0.002, 0.3, 'lin'], [0.04, 0.0001, 'exp']]);
      n.connect(nl); nl.connect(ng); ng.connect(c.destination);
      n.start(0, 0.5, 0.06);
    } },
    /* a brighter swish for a title card or a big zoom: it rises and ends with a rush */
    'swoosh-up': { dur: 0.8, peak: -6, draw: function (c) {
      [0, 1].forEach(function (i) {
        const n = sfxNoise(c, 601 + i * 23);
        const bp = biquad(c, 'bandpass', 500, 1.8);
        bp.frequency.setValueAtTime(500, 0);
        bp.frequency.exponentialRampToValueAtTime(7500, 0.78);
        const hp = biquad(c, 'highpass', 400, 0.5);
        const g = c.createGain();
        g.gain.setValueAtTime(0.001, 0);
        g.gain.exponentialRampToValueAtTime(1, 0.62);
        g.gain.linearRampToValueAtTime(0, 0.8);
        const p = c.createStereoPanner();
        p.pan.setValueAtTime(i ? 0.35 : -0.35, 0);
        n.connect(bp); bp.connect(hp); hp.connect(g); g.connect(p); p.connect(c.destination);
        n.start(0, 0.1 * i, 0.9);
      });
    } }
  };

  function renderSfx(name, sampleRate) {
    const def = SFX[name];
    const sr = sampleRate || 48000;
    if (!def) { return Promise.reject(new Error('no sound effect called ' + name)); }
    const n = Math.round(def.dur * sr);
    const ctx = offlineContext(2, n, sr);
    def.draw(ctx);
    return ctx.startRendering().then(function (rendered) {
      const L = new Float32Array(rendered.getChannelData(0));
      const R = new Float32Array(rendered.getChannelData(1));
      let peak = 0;
      let i;
      for (i = 0; i < n; i++) { peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i])); }
      const gain = peak > 0 ? Math.pow(10, def.peak / 20) / peak : 1;
      const fadeN = Math.min(n, Math.round(0.004 * sr));
      for (i = 0; i < n; i++) {
        const f = i >= n - fadeN ? (n - 1 - i) / fadeN : 1;
        L[i] *= gain * f;
        R[i] *= gain * f;
      }
      const out = new AudioBuffer({ numberOfChannels: 2, length: n, sampleRate: sr });
      out.copyToChannel(L, 0);
      out.copyToChannel(R, 1);
      return out;
    });
  }

  root.renderSoundtrack = renderSoundtrack;
  root.renderSfx = renderSfx;
  root.buildScore = buildScore;
  root.scoreTools = { CHORDS: CHORDS, LOOPS: LOOPS, allowedPcs: allowedPcs, loudness: loudness, SFX: Object.keys(SFX) };
})();
