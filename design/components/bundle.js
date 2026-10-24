/* @ds-bundle: {"format":4,"namespace":"PipNews","components":[{"name":"Pip"},{"name":"PipControls"},{"name":"Broadcast"},{"name":"TopBand"},{"name":"Ticker"},{"name":"LowerThird"},{"name":"Stinger"},{"name":"Ident"},{"name":"SessionBoard"},{"name":"StatePill"},{"name":"NewsDesk"},{"name":"OTSBox"},{"name":"HourReview"},{"name":"Clawd"},{"name":"Mark"},{"name":"PlayWithSound"},{"name":"Band"},{"name":"PromptSketch"}]} */
(function () {
  'use strict';

  var React = window.React;
  if (!React) { return; }
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;

  var STAGE_W = 960;
  var STAGE_H = 540;

  function num(v, d) {
    var n = typeof v === 'number' ? v : parseFloat(v);
    return isFinite(n) ? n : d;
  }
  function bool(v, d) {
    if (v === undefined || v === null || v === '') { return d; }
    if (typeof v === 'string') { return v !== 'false' && v !== '0'; }
    return !!v;
  }
  function cx() {
    return Array.prototype.filter.call(arguments, Boolean).join(' ');
  }
  function hasElements(children) {
    return React.Children.toArray(children).some(function (c) { return c !== null && typeof c === 'object'; });
  }

  /* ------------------------------------------------------------------
     Clawd. These tables are copied verbatim from the Claude Code engine
     (version 2.1.299), where they draw Clawd in the terminal out of
     quadrant block glyphs. Do not redraw Clawd: change these tables
     only by copying a newer engine's.
     ------------------------------------------------------------------ */
  var CLAWD_SOURCE = {
    engine: '2.1.299',
    poses: {
      'default': { eyes: 'open', arms: 'down', feet: 'both' },
      'arms-up': { eyes: 'open', arms: 'up', feet: 'both' },
      'look-left': { eyes: 'left', arms: 'down', feet: 'both' },
      'look-right': { eyes: 'right', arms: 'down', feet: 'both' }
    },
    arms: {
      down: { r1L: ' \u2590', r1R: '', r2L: '\u259D\u259C', r2R: '\u2588\u2580' },
      up: { r1L: '\u2597\u259F', r1R: '\u2584', r2L: ' \u259C', r2R: '\u2588\u2598' },
      'one-up': { r1L: ' \u2590', r1R: '\u2584', r2L: '\u259D\u259C', r2R: '\u2588\u2598' }
    },
    eyes: {
      open: [{ glyphs: '\u259B\u2588\u2588\u2588\u259B\u2588' }],
      left: [{ glyphs: '\u259F\u2588\u2588\u2588\u259F\u2588' }],
      right: [{ glyphs: '\u2588\u259F\u2588\u2588\u2588\u259F' }],
      closed: [{ glyphs: '\u2582', lid: true }, { glyphs: '\u2588\u2588\u2588' }, { glyphs: '\u2582', lid: true }, { glyphs: '\u2588' }],
      wink: [{ glyphs: '\u259B\u2588\u2588\u2588' }, { glyphs: '\u2582', lid: true }, { glyphs: '\u2588' }]
    },
    feet: {
      both: ' \u259D\u259D   \u259D\u259D ',
      left: ' \u259D\u259D      ',
      right: '      \u259D\u259D '
    },
    facing: {
      'right-12': [{ glyphs: ' \u2590\u2588\u259C\u2588\u2588\u259B\u2588 ', from: 2, to: 8 }, { glyphs: '\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580', from: 2, to: 7 }, { glyphs: ' \u259D\u259D   \u259D\u259D ', from: 0, to: 0 }],
      'right-30': [{ glyphs: '  \u2588\u259B\u2588\u2588\u259B\u258C ', from: 2, to: 7 }, { glyphs: ' \u259D\u2588\u2588\u2588\u2588\u2588\u259B ', from: 2, to: 7 }, { glyphs: '  \u2598\u2598  \u2598\u2598 ', from: 0, to: 0 }],
      'right-55': [{ glyphs: '  \u2590\u2588\u259B\u2588\u259C  ', from: 3, to: 7 }, { glyphs: '  \u2590\u2588\u2588\u2588\u2588  ', from: 3, to: 7 }, { glyphs: '  \u259D\u259D \u259D\u259D  ', from: 0, to: 0 }],
      'right-75': [{ glyphs: '   \u2588\u2588\u259B\u258C  ', from: 3, to: 6 }, { glyphs: '   \u2588\u2588\u2588\u258C  ', from: 3, to: 6 }, { glyphs: '   \u2598  \u2598  ', from: 0, to: 0 }],
      edge: [{ glyphs: '   \u2590\u2588\u2588   ', from: 4, to: 6 }, { glyphs: '   \u2590\u2588\u2588   ', from: 4, to: 6 }, { glyphs: '   \u259D \u259D   ', from: 0, to: 0 }],
      'back-105': [{ glyphs: '   \u2588\u2588\u2588\u258C  ', from: 3, to: 6 }, { glyphs: '   \u2588\u2588\u2588\u258C  ', from: 3, to: 6 }, { glyphs: '   \u2598  \u2598  ', from: 0, to: 0 }],
      'back-125': [{ glyphs: '  \u2590\u2588\u2588\u2588\u2588  ', from: 3, to: 7 }, { glyphs: '  \u2590\u2588\u2588\u2588\u2588  ', from: 3, to: 7 }, { glyphs: '  \u259D\u259D \u259D\u259D  ', from: 0, to: 0 }],
      'back-150': [{ glyphs: '  \u2588\u2588\u2588\u2588\u2588\u258C ', from: 2, to: 7 }, { glyphs: ' \u259D\u2588\u2588\u2588\u2588\u2588\u259B ', from: 2, to: 7 }, { glyphs: '  \u2598\u2598  \u2598\u2598 ', from: 0, to: 0 }],
      back: [{ glyphs: ' \u2590\u2588\u2588\u2588\u2588\u2588\u2588 ', from: 2, to: 8 }, { glyphs: '\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580', from: 2, to: 7 }, { glyphs: ' \u259D\u259D   \u259D\u259D ', from: 0, to: 0 }],
      'left-75': [{ glyphs: '   \u259B\u2588\u2588\u258C  ', from: 3, to: 6 }, { glyphs: '   \u2588\u2588\u2588\u258C  ', from: 3, to: 6 }, { glyphs: '   \u2598  \u2598  ', from: 0, to: 0 }],
      'left-55': [{ glyphs: '  \u2590\u259C\u259B\u2588\u2588  ', from: 3, to: 7 }, { glyphs: '  \u2590\u2588\u2588\u2588\u2588  ', from: 3, to: 7 }, { glyphs: '  \u259D\u259D \u259D\u259D  ', from: 0, to: 0 }],
      'left-30': [{ glyphs: '  \u259B\u2588\u2588\u259B\u2588\u258C ', from: 2, to: 7 }, { glyphs: ' \u259D\u2588\u2588\u2588\u2588\u2588\u259B ', from: 2, to: 7 }, { glyphs: '  \u2598\u2598  \u2598\u2598 ', from: 0, to: 0 }],
      'left-12': [{ glyphs: ' \u2590\u259B\u2588\u2588\u2588\u259C\u2588 ', from: 2, to: 8 }, { glyphs: '\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580', from: 2, to: 7 }, { glyphs: ' \u259D\u259D   \u259D\u259D ', from: 0, to: 0 }]
    }
  };

  /* Quadrant glyph -> filled quadrants (upper-left 1, upper-right 2, lower-left 4, lower-right 8). */
  var QUAD = {
    ' ': 0, '\u2598': 1, '\u259D': 2, '\u2580': 3, '\u2596': 4, '\u258C': 5, '\u259E': 6, '\u259B': 7,
    '\u2597': 8, '\u259A': 9, '\u2590': 10, '\u259C': 11, '\u2584': 12, '\u2599': 13, '\u259F': 14, '\u2588': 15
  };
  var GRID_W = 18;
  var GRID_H = 10;

  function blankGrid() {
    var g = [];
    for (var r = 0; r < 12; r++) {
      var row = [];
      for (var c = 0; c < GRID_W; c++) { row.push(0); }
      g.push(row);
    }
    return g;
  }

  /* One terminal glyph becomes 2 x 4 square cells: a quadrant is twice as tall as
     it is wide. 0 = empty, 1 = body, 2 = eye. "dark" spans fill their empty
     quadrants with the eye colour, as the engine does with clawd_background. */
  function paintChar(g, ch, col, row, mode) {
    var x0 = col * 2;
    var y0 = row * 4;
    var dx, dy, qx, qy;
    if (x0 > GRID_W - 2 || y0 > 8) { return; }
    if (mode === 'lid') {
      for (dx = 0; dx < 2; dx++) {
        for (dy = 0; dy < 4; dy++) { g[y0 + dy][x0 + dx] = dy === 3 ? 2 : 1; }
      }
      return;
    }
    var bits = QUAD[ch] || 0;
    var masks = [[1, 2], [4, 8]];
    for (qy = 0; qy < 2; qy++) {
      for (qx = 0; qx < 2; qx++) {
        var on = (bits & masks[qy][qx]) !== 0;
        var v = on ? 1 : (mode === 'dark' ? 2 : 0);
        if (!v) { continue; }
        g[y0 + qy * 2][x0 + qx] = v;
        g[y0 + qy * 2 + 1][x0 + qx] = v;
      }
    }
  }

  function paintRun(g, glyphs, col, row, mode) {
    Array.from(glyphs).forEach(function (ch, i) { paintChar(g, ch, col + i, row, mode); });
  }

  /* The pixel grid (18 x 10) for a frame: {eyes, arms, feet} or {facing}. */
  function clawdGrid(f) {
    var g = blankGrid();
    var spec = f || {};
    var turn = spec.facing && CLAWD_SOURCE.facing[spec.facing];
    if (turn) {
      turn.forEach(function (row, r) {
        Array.from(row.glyphs).forEach(function (ch, i) {
          paintChar(g, ch, i, r, i >= row.from && i < row.to ? 'dark' : 'plain');
        });
      });
      return g.slice(0, GRID_H);
    }
    var arms = CLAWD_SOURCE.arms[spec.arms] || CLAWD_SOURCE.arms.down;
    var eyes = CLAWD_SOURCE.eyes[spec.eyes] || CLAWD_SOURCE.eyes.open;
    var feet = CLAWD_SOURCE.feet[spec.feet] || CLAWD_SOURCE.feet.both;
    var col = 2;
    paintRun(g, arms.r1L, 0, 0, 'plain');
    eyes.forEach(function (span) {
      paintRun(g, span.glyphs, col, 0, span.lid ? 'lid' : 'dark');
      col += Array.from(span.glyphs).length;
    });
    paintRun(g, arms.r1R, 8, 0, 'plain');
    paintRun(g, arms.r2L, 0, 1, 'plain');
    paintRun(g, '\u2588\u2588\u2588\u2588\u2588', 2, 1, 'dark');
    paintRun(g, arms.r2R, 7, 1, 'plain');
    paintRun(g, feet, 0, 2, 'plain');
    return g.slice(0, GRID_H);
  }

  /* A repaint clock for animated pieces. Static frames never start it. */
  function useClock(animate, fps) {
    var st = useState(0);
    var t = st[0];
    var setT = st[1];
    useEffect(function () {
      if (!animate) { return undefined; }
      var start = Date.now();
      var id = setInterval(function () { setT((Date.now() - start) / 1000); }, 1000 / (fps || 12));
      return function () { clearInterval(id); };
    }, [animate, fps]);
    return t;
  }

  /* Clawd's acts: the pose at time t. Static frames show the act's key pose. */
  var SWIVEL = ['edge', 'right-75', 'right-55', 'right-30', 'right-12'];
  function actFrame(act, t, animate) {
    var f = { eyes: 'open', arms: 'down', feet: 'both', facing: null, bob: 0 };
    if (act === 'urgent') { f.arms = 'one-up'; }
    if (act === 'cheer') { f.arms = 'up'; }
    if (act === 'glance') { f.eyes = 'right'; }
    if (!animate) { return f; }
    var blink = (t % 3.8) < 0.14;
    if (act === 'talk') {
      f.arms = ['down', 'one-up', 'down', 'down'][Math.floor(t * 2.4) % 4];
      f.bob = Math.round(Math.sin(t * 8) * 2);
      if (blink) { f.eyes = 'closed'; }
    } else if (act === 'urgent') {
      f.arms = Math.floor(t * 3) % 2 ? 'up' : 'one-up';
      f.bob = -Math.round(Math.abs(Math.sin(t * 9)) * 3);
      if (blink) { f.eyes = 'closed'; }
    } else if (act === 'cheer') {
      f.arms = Math.floor(t * 3) % 2 ? 'down' : 'up';
      f.bob = -Math.round(Math.abs(Math.sin(t * 6)) * 6);
      if (blink) { f.eyes = 'closed'; }
    } else if (act === 'swivel') {
      var i = Math.floor(t * 10);
      if (i < SWIVEL.length) { f.facing = SWIVEL[i]; } else if (blink) { f.eyes = 'closed'; }
    } else if (act === 'glance') {
      f.eyes = (t % 5) < 2.5 ? 'right' : 'open';
    } else {
      if (blink) { f.eyes = 'closed'; }
      var c = t % 9;
      if (c > 6 && c < 6.9) { f.eyes = 'left'; }
    }
    return f;
  }

  function Clawd(props) {
    var cell = num(props.cell, 16);
    var animate = bool(props.animate, false) && !reducedMotion();
    var t = useClock(animate, 12);
    var f = actFrame(props.act || 'idle', t, animate);
    var pose = props.pose && CLAWD_SOURCE.poses[props.pose];
    if (pose) {
      if (!animate) { f.eyes = pose.eyes; }
      f.arms = pose.arms;
      f.feet = pose.feet;
    }
    if (props.eyes) { f.eyes = props.eyes; }
    if (props.arms) { f.arms = props.arms; }
    if (props.feet) { f.feet = props.feet; }
    if (props.facing) { f.facing = props.facing; }
    var grid = clawdGrid(f);
    var body = '';
    var eye = '';
    for (var r = 0; r < GRID_H; r++) {
      var c = 0;
      while (c < GRID_W) {
        var v = grid[r][c];
        if (!v) { c++; continue; }
        var s = c;
        while (c < GRID_W && grid[r][c] === v) { c++; }
        var d = 'M' + s + ' ' + r + 'h' + (c - s) + 'v1h-' + (c - s) + 'z';
        if (v === 2) { eye += d; } else { body += d; }
      }
    }
    return h('svg', {
      className: cx('pn-clawd', props.className),
      viewBox: '0 0 ' + GRID_W + ' ' + GRID_H,
      width: GRID_W * cell,
      height: GRID_H * cell,
      shapeRendering: 'crispEdges',
      role: 'img',
      'aria-label': props.label || 'Clawd, the Claude Code mascot',
      style: f.bob ? { transform: 'translateY(' + f.bob + 'px)' } : undefined
    },
    h('path', { className: 'pn-clawd-body', d: body }),
    eye ? h('path', { className: 'pn-clawd-eye', d: eye }) : null);
  }

  /* ------------------------------------------------------------------
     Events and states: the newsroom's fixed vocabulary.
     ------------------------------------------------------------------ */
  /* Every story airs as BREAKING NEWS: one open, one jingle, the red
     BREAKING tab. A story's own words and colour start at the desk: its
     headline, the wall monitor, Clawd's act and its pill on the board.
     Finished has two faces: READY FOR REVIEW when files changed, WORK
     COMPLETE when nothing did. */
  var EVENTS = {
    'needs-input': { tag: 'BREAKING', headline: 'NEEDS YOUR INPUT', ots: 'CLAUDE ASKS', act: 'urgent' },
    ready: { tag: 'BREAKING', headline: 'READY FOR REVIEW', ots: 'CHANGES', act: 'cheer' },
    complete: { tag: 'BREAKING', headline: 'WORK COMPLETE', ots: 'CLAUDE SAYS', act: 'talk' },
    error: { tag: 'BREAKING', headline: 'STOPPED ON AN ERROR', ots: 'THE ERROR', act: 'glance' },
    /* Scheduled, not a story; first come, first served like the stories: a
       story on air at the hour delays it, and one landing during it waits */
    hourly: { tag: 'ON THE HOUR', headline: 'THE HOUR', words: ['ON THE', 'HOUR'], ots: 'THIS HOUR', act: 'talk', ident: 7.5, outro: 1.4 }
  };
  /* A session's state and the word on its pill in the listing, which sorts by
     `priority`: what needs you first, then what has finished, then what is
     working. A finished session is READY whether or not files changed. */
  var STATES = {
    'needs-input': { pill: 'INPUT', priority: 1 },
    error: { pill: 'ERROR', priority: 2 },
    ready: { pill: 'READY', priority: 3 },
    working: { pill: 'LIVE', priority: 4 }
  };

  function reducedMotion() {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }
  function clamp01(x) { return x < 0 ? 0 : (x > 1 ? 1 : x); }
  function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
  function easeOut(x) { return 1 - Math.pow(1 - x, 3); }
  function easeInOut(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

  /* The listing's state: one word on a glossy pill in the state's colour,
     as the first station sketch drew it. */
  function StatePill(props) {
    var state = STATES[props.state] ? props.state : 'working';
    return h('span', { className: cx('pn-pill', 'pn-k-' + state) }, props.label || STATES[state].pill);
  }

  /* ------------------------------------------------------------------
     Broadcast graphics, Local at Six. All positions are stage units
     (960 x 540).
     ------------------------------------------------------------------ */
  /* The station mark: KLWD in chrome and nothing else, sized by the letters
     (`size`, 40 in the bug). Chosen on the Brand page over a gold swoosh and
     four other hooks: the chrome stands alone. */
  function Mark(props) {
    return h('div', { className: cx('pn-mark', props.className), style: { fontSize: num(props.size, 40) + 'px' } },
      h('span', { className: 'pn-chrome pn-mark-letters' }, props.text || 'KLWD'));
  }

  /* The top band: the KLWD bug alone. The clock sits in the ticker, bottom
     right, and LIVE belongs to the sessions' pills. */
  function TopBand(props) {
    return h('div', { className: cx('pn-top', props.inline && 'pn-inline') },
      h('div', { className: 'pn-bug' }, h(Mark, { size: 40, text: props.mark })));
  }

  /* ------------------------------------------------------------------
     The crawl. On air it is a belt: each item, with the diamond after it,
     is laid on the belt's end out of sight behind the clock, and keeps its
     words until it has gone past the tab, so nothing changes on screen
     while it is being read. A new list of items only decides what is laid
     next. The belt runs at one speed whatever is on it, a frame at a time,
     and each Stage keeps one belt for every Ticker it shows, so the crawl
     carries on across the cuts.
     ------------------------------------------------------------------ */
  var CRAWL_SPEED = 53; /* stage px a second: the pace of the live board's sample crawl, one pass every 40 s */
  var CRAWL_LEAD_IN = 22; /* a new belt starts its first item this far in from the tab, as a static frame does */
  var CRAWL_AHEAD = 120; /* the belt is laid this far past the clock, out of sight */
  var CRAWL_MAX_STEP = 0.1; /* seconds: after a pause (a hidden window), the crawl carries on from where it stopped */
  var CrawlContext = React.createContext(null);

  /* What an item is on the belt: its `key` if it has one, else its words */
  function crawlKey(it) {
    if (typeof it === 'string') { return 'text:' + it; }
    if (!it) { return 'none'; }
    if (it.key) { return 'key:' + it.key; }
    return 'text:' + (it.lead ? it.lead + ' ' : '') + (it.text || '');
  }

  /* The next item to lay: the first in the list, top to bottom, not yet
     laid in this round, and never the one laid just before while another
     is waiting. However the list is reordered, every item comes round once
     a round, and an item that joins the list is laid as soon as its place
     in the list comes up. Null when the round is over. */
  function crawlNext(items, done, last) {
    var waiting = null;
    for (var i = 0; i < items.length; i++) {
      var key = crawlKey(items[i]);
      if (done[key]) { continue; }
      if (key !== last) { return items[i]; }
      waiting = items[i];
    }
    return waiting;
  }

  /* One step of the belt, with no drawing in it. `belt` is { offset, units,
     done, last, started }: how far the belt has moved past the left edge of
     the view (stage px), its units ({ key, item, width }), the keys laid in
     this round, the key of the last unit laid, and whether anything was
     ever laid. `input` is { dt, speed, view, items, measure }: seconds since
     the last step, stage px a second, the view's width, the list as it is
     now, and measure(item), the width of a unit for that item. Returns
     { belt, dropped, laid }: the belt after the step, how many units left
     past the tab, and the items laid at its end. */
  function crawlStep(belt, input) {
    var dt = Math.min(Math.max(num(input.dt, 0), 0), CRAWL_MAX_STEP);
    var offset = belt.offset + num(input.speed, CRAWL_SPEED) * dt;
    var units = belt.units.slice();
    var dropped = 0;
    while (units.length && offset >= units[0].width) {
      offset -= units[0].width;
      units.shift();
      dropped += 1;
    }
    var started = belt.started;
    if (!units.length) {
      /* An empty belt waits at the clock, so what comes next crawls in
         from there; a belt that never ran starts in from the tab. */
      offset = started ? -input.view : -CRAWL_LEAD_IN;
    }
    var end = 0;
    for (var i = 0; i < units.length; i++) { end += units[i].width; }
    var items = input.items || [];
    var done = {};
    for (var key in belt.done) { done[key] = true; }
    var last = belt.last;
    var laid = [];
    while (items.length && end - offset < input.view + CRAWL_AHEAD && laid.length < 32) {
      var item = crawlNext(items, done, last);
      if (item === null) {
        done = {};
        item = crawlNext(items, done, last);
      }
      var width = num(input.measure(item), 0);
      if (!(width > 0)) { break; }
      last = crawlKey(item);
      done[last] = true;
      units.push({ key: last, item: item, width: width });
      laid.push(item);
      end += width;
      started = true;
    }
    return { belt: { offset: offset, units: units, done: done, last: last, started: started }, dropped: dropped, laid: laid };
  }

  /* A unit: the item as a static frame draws it, and the diamond after it */
  function crawlUnit(it) {
    var unit = document.createElement('span');
    unit.className = 'pn-ticker-unit';
    var body = document.createElement('span');
    body.className = 'pn-ticker-item';
    var lead = typeof it === 'string' ? null : it.lead;
    if (lead) {
      var tag = document.createElement('span');
      tag.className = 'pn-ticker-lead';
      tag.textContent = lead + ' ';
      body.appendChild(tag);
    }
    body.appendChild(document.createTextNode(typeof it === 'string' ? it : (it.text || '')));
    var sep = document.createElement('i');
    sep.className = 'pn-ticker-sep';
    unit.appendChild(body);
    unit.appendChild(sep);
    return unit;
  }

  /* A unit's width as laid out, in stage px: the stage's scale, and any
     other transform round it, do not count */
  function crawlWidth(node) {
    return parseFloat(window.getComputedStyle(node).width) || 0;
  }

  /* The belt on air. React draws it empty; the units are laid on and taken
     off here, a frame at a time, so the words on screen never change. */
  function Belt(props) {
    var shared = React.useContext(CrawlContext);
    var own = useState(function () { return { belt: null }; })[0];
    var store = shared || own;
    var ref = React.useRef(null);
    var items = React.useRef(props.items);
    items.current = props.items;
    React.useLayoutEffect(function () {
      var el = ref.current;
      var view = el ? el.parentNode : null;
      if (!el || !view) { return undefined; }
      var clock = window.performance && window.performance.now ? function () { return window.performance.now(); } : Date.now;
      var later = window.requestAnimationFrame
        ? function (f) { return window.requestAnimationFrame(f); }
        : function (f) { return window.setTimeout(function () { f(clock()); }, 16); };
      var cancel = window.cancelAnimationFrame
        ? function (id) { window.cancelAnimationFrame(id); }
        : function (id) { window.clearTimeout(id); };
      var belt = store.belt || { offset: -CRAWL_LEAD_IN, units: [], done: {}, last: null, started: false };
      belt.units.forEach(function (u) { el.appendChild(crawlUnit(u.item)); });
      function measure(item) {
        var probe = crawlUnit(item);
        el.appendChild(probe);
        var width = crawlWidth(probe);
        el.removeChild(probe);
        return width;
      }
      var raf = 0;
      var then = null;
      function step(now) {
        var dt = then === null ? 0 : (now - then) / 1000;
        then = now;
        /* the units as drawn now: a typeface that has landed since changes their widths */
        for (var i = 0; i < belt.units.length; i++) {
          var node = el.children[i];
          var w = node ? crawlWidth(node) : 0;
          if (w > 0) { belt.units[i].width = w; }
        }
        var next = crawlStep(belt, { dt: dt, speed: CRAWL_SPEED, view: view.clientWidth, items: items.current, measure: measure });
        for (var d = 0; d < next.dropped; d++) { if (el.firstChild) { el.removeChild(el.firstChild); } }
        next.laid.forEach(function (item) { el.appendChild(crawlUnit(item)); });
        belt = next.belt;
        store.belt = belt;
        el.style.transform = 'translateX(' + (-belt.offset) + 'px)';
      }
      function frame(now) {
        step(now);
        raf = later(frame);
      }
      step(clock());
      raf = later(frame);
      return function () {
        cancel(raf);
        while (el.firstChild) { el.removeChild(el.firstChild); }
      };
    }, [store]);
    return h('div', { ref: ref, className: 'pn-ticker-belt' });
  }

  /* The crawl, with the clock at its right end. `sample` takes both from a scene. */
  function Ticker(props) {
    var scene = (props.sample && SAMPLES[props.sample]) || {};
    var items = props.items && props.items.length ? props.items : (scene.ticker || []);
    var time = props.time || scene.clock;
    var crawl = bool(props.animate, false) && !reducedMotion();
    var offset = num(props.offset, 0);
    function half(prefix) {
      var out = [];
      items.forEach(function (it, i) {
        var lead = typeof it === 'string' ? null : it.lead;
        var text = typeof it === 'string' ? it : it.text;
        out.push(h('span', { key: prefix + 'i' + i, className: 'pn-ticker-item' },
          lead ? h('span', { className: 'pn-ticker-lead' }, lead + ' ') : null, text));
        out.push(h('i', { key: prefix + 's' + i, className: 'pn-ticker-sep' }));
      });
      return out;
    }
    return h('div', { className: cx('pn-ticker', props.inline && 'pn-inline') },
      h('div', { className: 'pn-ticker-label' }, h('span', null, props.label || 'LATEST')),
      h('div', { className: 'pn-ticker-view' },
        crawl
          ? h(Belt, { items: items })
          : h('div', {
            className: 'pn-ticker-track',
            style: offset ? { transform: 'translateX(' + (-offset) + 'px)' } : undefined
          }, half('a'))),
      time ? h('div', { className: 'pn-ticker-clock' }, h('span', null, time)) : null);
  }

  /* ------------------------------------------------------------------
     Pages. The listing has four rows. With more sessions it shows them
     four at a time, and THE HOUR IN REVIEW does the same with its rows.
     A page holds 8 s on the board and 10 s in the review, on a clock that
     starts when the graphic appears, so the board always comes back on
     its first page after a story. A turn is B · Push, chosen on PiP
     Newsroom · More than four: each row leaves to the right as BREAKING
     NEWS's words leave in its outro, fading as it goes, and once it has
     gone the next page's row slides in from the left as the lower third
     does, rows 110 ms apart from the top; the page tab goes last. What
     changes while a page is up (a session tuning in or out, a new state)
     waits for the next turn, so nothing moves while a page is read; with
     one page before and after, the board is drawn as it comes, as it
     always was. With reduced motion a turn is a cut, on the same clock.
     ------------------------------------------------------------------ */
  var PAGE_ROWS = 4;
  var BOARD_PAGE_MS = 8000;
  var REVIEW_PAGE_MS = 10000;
  var TURN = { stagger: 110, leave: 420, enter: 460 };
  /* the last thing to move is the tab's entrance */
  var TURN_MS = PAGE_ROWS * TURN.stagger + TURN.leave + TURN.enter;

  function pageCount(n) { return Math.max(1, Math.ceil(n / PAGE_ROWS)); }
  function pageItems(items, page) { return items.slice(page * PAGE_ROWS, (page + 1) * PAGE_ROWS); }

  /* What a paged graphic shows now: its items as they were at the last
     turn, the page in view, the page before while its turn runs, and how
     many turns there have been, for keys */
  function usePages(items, pageMs, animate) {
    var latest = React.useRef(items);
    latest.current = items;
    var shown = React.useRef({ items: items, page: 0 });
    var turn = React.useRef({ prev: null, n: 0 });
    var redraw = useState(0)[1];
    if (items.length <= PAGE_ROWS && shown.current.items.length <= PAGE_ROWS) {
      shown.current = { items: items, page: 0 };
    }
    useEffect(function () {
      if (!animate) { return undefined; }
      var begun = Date.now();
      var next;
      var settle;
      function later() {
        next = setTimeout(step, pageMs - ((Date.now() - begun) % pageMs));
      }
      function step() {
        var from = shown.current;
        var to = latest.current;
        if (to.length <= PAGE_ROWS && from.items.length <= PAGE_ROWS) {
          shown.current = { items: to, page: 0 };
        } else {
          var page = from.page + 1;
          shown.current = { items: to, page: page >= pageCount(to.length) ? 0 : page };
          turn.current = { prev: from, n: turn.current.n + 1 };
          clearTimeout(settle);
          settle = setTimeout(function () {
            turn.current = { prev: null, n: turn.current.n };
            redraw(function (k) { return k + 1; });
          }, TURN_MS);
        }
        redraw(function (k) { return k + 1; });
        later();
      }
      later();
      return function () { clearTimeout(next); clearTimeout(settle); };
    }, [animate, pageMs]);
    var pushing = animate && !reducedMotion();
    return { items: shown.current.items, page: shown.current.page, prev: pushing ? turn.current.prev : null, n: turn.current.n };
  }

  /* Each slot of a page: the row in view, and while a turn runs the row
     of the page before leaving it, each on its turn's clock */
  function pageSlots(view, slotClass, rowClass, content) {
    var cur = pageItems(view.items, view.page);
    var before = view.prev ? pageItems(view.prev.items, view.prev.page) : [];
    var slots = [];
    for (var r = 0; r < Math.max(cur.length, before.length); r += 1) {
      var faces = [];
      if (before[r]) {
        faces.push(h('div', {
          key: 'out:' + view.n + ':' + (before[r].id || r),
          className: cx(rowClass, 'pn-turn-leave'),
          style: { animationDelay: r * TURN.stagger + 'ms' }
        }, content(before[r])));
      }
      if (cur[r]) {
        faces.push(h('div', {
          key: 'in:' + view.n + ':' + (cur[r].id || r),
          className: cx(rowClass, view.prev && 'pn-turn-enter'),
          style: view.prev ? { animationDelay: r * TURN.stagger + TURN.leave + 'ms' } : undefined
        }, content(cur[r])));
      }
      slots.push(h('div', { key: r, className: slotClass }, faces));
    }
    return slots;
  }

  /* Which page of how many, on the ticker clock's blue tab; only with two
     pages or more. It turns after the rows. */
  function pageTab(view, tabClass) {
    var pages = pageCount(view.items.length);
    var before = view.prev ? pageCount(view.prev.items.length) : 1;
    if (pages < 2 && before < 2) { return null; }
    var faces = [];
    if (view.prev && before > 1) {
      faces.push(h('div', {
        key: 'out:' + view.n,
        className: 'pn-page pn-turn-leave',
        style: { animationDelay: PAGE_ROWS * TURN.stagger + 'ms' }
      }, pageWords(view.prev.page, before)));
    }
    if (pages > 1) {
      faces.push(h('div', {
        key: 'in:' + view.n,
        className: cx('pn-page', view.prev && 'pn-turn-enter'),
        style: view.prev ? { animationDelay: PAGE_ROWS * TURN.stagger + TURN.leave + 'ms' } : undefined
      }, pageWords(view.page, pages)));
    }
    return h('div', { className: tabClass }, faces);
  }
  function pageWords(page, pages) {
    return h('span', { className: 'pn-ticker-clock pn-page-tab' }, h('span', null, (page + 1) + ' OF ' + pages));
  }

  /* The listing, as the first station sketch drew it: a glossy row per
     session, its project on a plate, its title, and its state on a pill,
     four rows a page (Pages, above). `animate` turns the pages; without it
     the board holds its first page. `sample` takes the sessions from a
     scene. */
  function SessionBoard(props) {
    var scene = (props.sample && SAMPLES[props.sample]) || {};
    var list = (props.sessions || scene.sessions || []).slice();
    if (bool(props.sort, true)) {
      list.sort(function (a, b) {
        return (STATES[a.state] || STATES.working).priority - (STATES[b.state] || STATES.working).priority;
      });
    }
    var view = usePages(list, BOARD_PAGE_MS, bool(props.animate, false));
    return h('div', { className: cx('pn-board', props.inline && 'pn-inline') },
      pageSlots(view, 'pn-board-slot', 'pn-row', function (s) {
        return [
          /* The project leads the row on a plate, as chosen on PiP
             Newsroom · Project in the listing; a session without one has
             no plate */
          s.project ? h('span', { key: 'project', className: 'pn-row-project' }, h('span', null, s.project)) : null,
          h('span', { key: 'name', className: 'pn-row-name' }, s.name),
          h(StatePill, { key: 'pill', state: s.state })
        ];
      }),
      pageTab(view, 'pn-board-tab'));
  }

  /* The lower third. Every story wears the red BREAKING tab; only the hour
     keeps its gold. The headline is the story's own. */
  function LowerThird(props) {
    var kind = EVENTS[props.kind] ? props.kind : 'needs-input';
    var ev = EVENTS[kind];
    var strap = props.strap || props.session;
    var family = kind === 'hourly' ? 'hourly' : 'breaking';
    return h('div', { className: cx('pn-l3', 'pn-k-' + family, props.inline && 'pn-inline') },
      h('div', { className: 'pn-l3-line' },
        h('div', { className: 'pn-l3-tag' }, h('span', null, props.tag || ev.tag)),
        h('div', { className: 'pn-l3-head' }, h('span', null, props.headline || ev.headline), h('i', { className: 'pn-l3-glint', 'aria-hidden': 'true' }))),
      strap ? h('div', { className: 'pn-l3-strap' }, h('span', null,
        h('span', { className: 'pn-l3-title' }, strap),
        props.project ? h('b', null, '\u00B7 ' + props.project) : null)) : null);
  }

  /* The wall monitor behind the anchor: a chrome bezel around a small screen. */
  function OTSBox(props) {
    var kind = EVENTS[props.kind] ? props.kind : 'needs-input';
    return h('div', { className: cx('pn-ots', 'pn-k-' + kind, props.inline && 'pn-inline') },
      h('div', { className: 'pn-monitor-screen' },
        h('div', { className: 'pn-ots-head' }, props.label || EVENTS[kind].ots),
        h('div', { className: 'pn-ots-body' },
          /* A long figure (the hour's "+1,482 -356") steps down a size to stay on one line */
          props.figure ? h('div', { className: cx('pn-ots-figure', String(props.figure).length > 9 && 'pn-ots-figure--long') }, props.figure) : null,
          /* a permission ask: the command in gold, Claude's description of it under it */
          props.command ? h('div', { className: 'pn-ots-command' }, props.command) : null,
          props.quote ? h('div', { className: 'pn-ots-quote' }, props.quote) : null,
          props.sub ? h('div', { className: 'pn-ots-sub' }, props.sub) : null),
        props.foot ? h('div', { className: 'pn-ots-foot' }, props.foot) : null));
  }

  /* The stinger's background: a wall of glass panes seen at an angle, on the
     station's navy. A wave of the event's colour crosses it over the whole run
     and leaves each pane glowing at its own level, so the last frame keeps a
     texture. */
  var PANES = (function () {
    var rnd = seeded(5813);
    var out = [];
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 11; c++) { out.push({ x: c * 100 - 70, y: r * 100 - 30, d: c * 100 + r * 60, v: rnd() }); }
    }
    return out;
  })();
  /* `back`: the outro's wave, sweeping back from the right and leaving the
     panes it passes dark. The same rule draws both: a pane glows once the
     intro's wave has passed it, until the outro's wave passes it again. */
  function glassWall(p, back) {
    var front = back ? 1450 - 1700 * p : -250 + 1700 * p;
    return [
      h('div', { key: 'wall', className: 'pn-stinger-wall', 'aria-hidden': 'true' },
        PANES.map(function (g, i) {
          var lit = clamp01(1 - Math.abs(g.d - front) / 260);
          var settled = g.d < front ? 0.08 + 0.3 * g.v : 0.04;
          return h('div', { key: i, className: 'pn-stinger-pane', style: { left: g.x + 'px', top: g.y + 'px', opacity: Math.max(0.75 * lit, settled).toFixed(3) } });
        })),
      h('div', { key: 'glass', className: 'pn-stinger-glass' })
    ];
  }

  /* One line of chrome words: the outline underneath, hidden from VoiceOver,
     and the chrome on top, which the glint crosses (0 to 1). */
  function chromeLine(word, className, style, glint) {
    return h('div', { key: word, className: className, style: style },
      h('span', { className: 'pn-stinger-ink', 'aria-hidden': 'true' }, word),
      h('span', { className: 'pn-stinger-face', style: { backgroundPosition: (130 - 160 * glint).toFixed(1) + '% 0, 0 0' } }, word));
  }

  /* BREAKING NEWS, for every story, in red: the intro before the desk and
     the outro after it. Each runs on one number, progress 0 to 1, so a
     storyboard frame and the moving version are the same picture at the
     same moment. */
  var BREAKING = { words: ['BREAKING', 'NEWS'], duration: 1.4, outro: 1.2 };
  function Stinger(props) {
    var outro = bool(props.outro, false);
    var animate = bool(props.animate, false) && !reducedMotion();
    var dur = num(props.duration, outro ? BREAKING.outro : BREAKING.duration);
    var t = useClock(animate, 30);
    var p = animate ? clamp01(t / dur) : clamp01(num(props.progress, 1));
    var words = props.words || BREAKING.words;
    if (outro) { return outroPicture(p, words); }
    var glint = seg(p, 0.6, 0.92);
    var lines = words.map(function (w, i) {
      var s = easeOut(seg(p, 0.22 + 0.1 * i, 0.5 + 0.1 * i));
      return chromeLine(w, 'pn-stinger-line', {
        opacity: s,
        transform: 'translateX(' + ((1 - s) * -140).toFixed(1) + 'px) scale(' + (1.3 - 0.3 * s).toFixed(3) + ')'
      }, glint);
    });
    return h('div', { className: 'pn-stinger pn-k-breaking' },
      glassWall(p),
      h('div', { className: 'pn-stinger-words' }, lines));
  }

  /* The outro is the intro's last picture, run out: a glint crosses the
     words (0-30%), the words leave to the right one after the other (10-57%),
     the red wave sweeps back across the wall and darkens it (0-75%), and the
     whole open fades away to the board underneath (70-100%). */
  function outroPicture(p, words) {
    var glint = seg(p, 0, 0.3);
    var lines = words.map(function (w, i) {
      var s = easeInOut(seg(p, 0.1 + 0.12 * i, 0.45 + 0.12 * i));
      return chromeLine(w, 'pn-stinger-line', {
        opacity: (1 - s).toFixed(3),
        transform: 'translateX(' + (s * 180).toFixed(1) + 'px) scale(' + (1 + 0.25 * s).toFixed(3) + ')'
      }, glint);
    });
    return h('div', { className: 'pn-stinger pn-k-breaking', style: { opacity: (1 - easeInOut(seg(p, 0.7, 1))).toFixed(3) } },
      glassWall(seg(p, 0, 0.75), true),
      h('div', { className: 'pn-stinger-words' }, lines));
  }

  /* ON THE HOUR: the scheduled report's open. The station clock counts the
     last five seconds, its seconds hand stepping with the pips; on the long
     pip the minute hand jumps to the hour, a glint crosses the face, and the
     clock steps aside as the words slam in. One number drives it, as it
     drives the stinger: progress 0 is 14:59:55, two thirds is the hour, 1 is
     2.5 s past it. */
  var STRIKE = 2 / 3;

  /* the minute before the hour ("14:59" for "15:00") */
  function minuteBefore(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ''));
    if (!m) { return '14:59'; }
    var total = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + 1439) % 1440;
    return pad2(Math.floor(total / 60)) + ':' + pad2(total % 60);
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function hoursMinutes(hhmm) {
    var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '')) || [0, '15', '00'];
    return [parseInt(m[1], 10), parseInt(m[2], 10)];
  }
  /* a clock's tick: a quick step with a little overshoot, over 0.16 s */
  function tickEase(x) {
    var u = clamp01(x / 0.16) - 1;
    return 1 + 2.6 * u * u * u + 1.6 * u * u;
  }

  /* The station clock, drawn in the ident's 360 x 360 box from one moment,
     `t`: seconds from the hour, -5 at the first pip, 0 on the hour, 2.5 when
     the ident ends; `prev` is the minute before the hour. The monitor's
     chrome bezel round a glossy blue face, gold bars for the hours, chrome
     hands, a gold seconds hand and the mark. The seconds hand steps with each
     pip; on the long pip the minute hand jumps to the hour and a glint
     crosses the face. */
  function stationClock(c) {
    var sec = c.t < 0 ? 60 + c.t : c.t;
    var whole = Math.floor(sec);
    var sAng = (whole - 1 + tickEase(sec - whole)) * 6;
    var jump = c.t < 0 ? 0 : tickEase(c.t);
    var hm = hoursMinutes(c.prev);
    var mAng = (hm[1] + jump) * 6;
    var hAng = ((hm[0] % 12) + (hm[1] + jump) / 60) * 30;
    var glint = c.t < 0 ? 0 : seg(c.t, 0.02, 0.55);
    var marks = [];
    for (var i = 0; i < 60; i++) {
      marks.push(h('i', { key: i, className: i % 5 === 0 ? 'pn-dial-hour' : 'pn-dial-min', style: { transform: 'rotate(' + i * 6 + 'deg)' } }));
    }
    function hand(cls, ang) { return h('i', { className: cls, style: { transform: 'rotate(' + ang.toFixed(2) + 'deg)' } }); }
    return h('div', { className: 'pn-dial', 'aria-hidden': 'true' },
      h('div', { className: 'pn-dial-face' },
        marks,
        h('div', { className: 'pn-dial-mark pn-chrome' }, 'KLWD'),
        hand('pn-dial-hand pn-dial-hand--h', hAng),
        hand('pn-dial-hand pn-dial-hand--m', mAng),
        hand('pn-dial-sec', sAng),
        h('i', { className: 'pn-dial-cap' }),
        h('i', { className: 'pn-dial-glint', style: { left: (-30 + 160 * glint).toFixed(1) + '%' } })));
  }

  /* `outro`: the ident's last picture, run out over 1.4 s. A glint crosses
     the words (0-30%), the words leave to the right one after the other
     (15-62%), the clock drops back and fades (40-72%), and the ident fades
     to the board underneath (70-100%). */
  function Ident(props) {
    var outro = bool(props.outro, false);
    var animate = bool(props.animate, false) && !reducedMotion();
    var dur = num(props.duration, outro ? EVENTS.hourly.outro : EVENTS.hourly.ident);
    var t = useClock(animate, 30);
    var q = animate ? clamp01(t / dur) : clamp01(num(props.progress, 1));
    var p = outro ? 1 : q;
    var o = outro ? q : 0;
    var hour = props.hour || '15:00';
    var words = props.words || EVENTS.hourly.words;
    var struck = p >= STRIKE;
    var now = struck ? 60 : Math.floor(55 + 5 * p / STRIKE);
    var move = easeInOut(seg(p, STRIKE + 0.01, STRIKE + 0.16));
    var glint = outro ? seg(o, 0, 0.3) : seg(p, 0.88, 1);
    var clock = stationClock({ t: (p - STRIKE) * EVENTS.hourly.ident, hour: hour, prev: minuteBefore(hour) });
    var lines = words.map(function (w, i) {
      var s = easeOut(seg(p, STRIKE + 0.04 + 0.06 * i, STRIKE + 0.16 + 0.06 * i));
      var leave = outro ? easeInOut(seg(o, 0.15 + 0.12 * i, 0.5 + 0.12 * i)) : 0;
      return chromeLine(w, 'pn-stinger-line pn-ident-line', {
        opacity: (s * (1 - leave)).toFixed(3),
        transform: 'translateX(' + ((1 - s) * 160 + leave * 180).toFixed(1) + 'px) scale(' + (1.3 - 0.3 * s + 0.25 * leave).toFixed(3) + ')'
      }, glint);
    });
    var drop = outro ? easeInOut(seg(o, 0.4, 0.72)) : 0;
    /* the clock and the words share the frame's centre line */
    var cxp = 480 - 230 * move;
    var cyp = 268;
    var sc = (1 - 0.2 * move) * (1 - 0.3 * drop);
    return h('div', { className: cx('pn-ident', 'pn-k-hourly'), style: outro ? { opacity: (1 - easeInOut(seg(o, 0.7, 1))).toFixed(3) } : undefined },
      h('div', { className: 'pn-ident-rays', style: { background: 'repeating-conic-gradient(from ' + (p * 30 + o * 12).toFixed(1) + 'deg at 50% 50%, rgba(255, 224, 138, 0.07) 0deg 6deg, rgba(255, 224, 138, 0) 6deg 18deg)' } }),
      h('div', {
        className: 'pn-ident-clock',
        role: 'img',
        'aria-label': struck ? 'The station clock at ' + hour : 'The station clock, ' + (60 - now) + ' seconds to ' + hour,
        style: { opacity: (1 - drop).toFixed(3), transform: 'translate(' + cxp.toFixed(1) + 'px, ' + cyp.toFixed(1) + 'px) scale(' + sc.toFixed(3) + ')' }
      }, clock),
      h('div', { className: 'pn-ident-words' }, lines));
  }

  /* THE HOUR IN REVIEW: what each session did this hour, a row each: its
     project, one detail and its state pill, four rows a page (Pages,
     above). Rows keep the listing's order. `animate` turns the pages;
     without it the review holds its first page. `sample` takes the rows
     and the span from a scene. */
  function HourReview(props) {
    var scene = (props.sample && SAMPLES[props.sample]) || {};
    var rows = (props.rows || scene.rows || []).slice().sort(function (a, b) {
      return (STATES[a.state] || STATES.working).priority - (STATES[b.state] || STATES.working).priority;
    });
    var view = usePages(rows, REVIEW_PAGE_MS, bool(props.animate, false));
    return h('div', { className: cx('pn-review', props.inline && 'pn-inline') },
      h('div', { className: 'pn-review-head' },
        h('div', { className: 'pn-review-tag' }, h('span', null, props.span || scene.span || '14:00–15:00')),
        h('div', { className: 'pn-review-title' }, h('span', null, props.label || 'THE HOUR IN REVIEW'))),
      h('div', { className: 'pn-review-rows' }, pageSlots(view, 'pn-review-slot', 'pn-review-row', function (r) {
        var st = STATES[r.state] ? r.state : 'working';
        return [
          h('div', { key: 'body', className: 'pn-review-body' },
            h('div', { className: 'pn-review-name' }, r.project || r.name),
            r.detail ? h('div', { className: 'pn-review-meta' }, r.detail) : null),
          h(StatePill, { key: 'pill', state: st })
        ];
      })),
      pageTab(view, 'pn-review-tab'));
  }

  /* The studio: a dusk skyline through the studio window, drawn on the same
     pixel grid as Clawd, and the anchor desk in front of it. The desk is one
     solid piece that overlaps itself, so nothing behind it shows through at
     any window size; the station mug and the script sit on its top. */
  function seeded(a) {
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* The city through the day. The clock picks the part of the day: morning
     from 05:00, afternoon from 11:00, evening from 17:00 (the station's own
     dusk) and night from 21:00. The towers and windows never move; the sky,
     the towers' colour and the windows' light change: a few lit in the
     morning, none by day, a third at dusk, over half at night with some blue
     from televisions, and stars and red mast beacons after dark. */
  var DAY_PARTS = ['morning', 'afternoon', 'evening', 'night'];
  function dayPart(time) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(time || ''));
    if (!m) { return 'evening'; }
    var hr = parseInt(m[1], 10) % 24;
    if (hr >= 21 || hr < 5) { return 'night'; }
    if (hr < 11) { return 'morning'; }
    if (hr < 17) { return 'afternoon'; }
    return 'evening';
  }
  /* windows lit warm below the first share, blue below the second */
  var LIT = { morning: [0.08, 0.08], afternoon: [0, 0], evening: [0.3, 0.3], night: [0.45, 0.55] };
  var SKYLINE = (function () {
    var rnd = seeded(20261020);
    var towers = '';
    var windows = [];
    var beacons = '';
    var x = -12;
    var horizon = 330;
    while (x < 972) {
      var w = 36 + Math.floor(rnd() * 6) * 10;
      var tall = 70 + Math.floor(rnd() * 14) * 10 + (rnd() < 0.18 ? 60 : 0);
      var top = horizon - tall;
      towers += 'M' + x + ' ' + top + 'h' + w + 'v' + tall + 'h-' + w + 'z';
      if (rnd() < 0.3) {
        var mx = x + Math.floor(w / 2) - 1;
        towers += 'M' + mx + ' ' + (top - 24) + 'h3v24h-3z';
        beacons += 'M' + (mx - 1) + ' ' + (top - 29) + 'h5v5h-5z';
      }
      for (var wy = top + 10; wy < horizon - 10; wy += 14) {
        for (var wx = x + 6; wx < x + w - 8; wx += 10) {
          windows.push({ d: 'M' + wx + ' ' + wy + 'h4v6h-4z', r: rnd() });
        }
      }
      x += w + 4 + Math.floor(rnd() * 3) * 4;
    }
    var parts = {};
    DAY_PARTS.forEach(function (k) {
      var warm = '';
      var cool = '';
      var dark = '';
      windows.forEach(function (wd) {
        if (wd.r < LIT[k][0]) { warm += wd.d; } else if (wd.r < LIT[k][1]) { cool += wd.d; } else { dark += wd.d; }
      });
      parts[k] = { warm: warm, cool: cool, dark: dark };
    });
    var srnd = seeded(1969);
    var stars = '';
    for (var i = 0; i < 46; i++) {
      var sz = srnd() < 0.2 ? 3 : 2;
      stars += 'M' + Math.floor(srnd() * 960) + ' ' + (6 + Math.floor(srnd() * 150)) + 'h' + sz + 'v' + sz + 'h-' + sz + 'z';
    }
    return { towers: towers, parts: parts, beacons: beacons, stars: stars };
  })();
  var MULLIONS = 'M232 0h10v330h-10zM482 0h10v330h-10zM722 0h10v330h-10zM0 96h960v7h-960z';

  /* The script on the desk: a stack of pages and one loose page on top, lying
     flat, drawn in the desk top's own perspective (y 328 at the back, about
     350 at the front). */
  var SCRIPT = (function () {
    function pt(X, Z, lift) {
      var p = 800 / (800 + Z);
      return (480 + (X - 480) * p).toFixed(1) + ' ' + (350 - Z * 0.16 * p - lift).toFixed(1);
    }
    function sheet(cx, cz, deg) {
      var a = deg * Math.PI / 180;
      var c = Math.cos(a);
      var sn = Math.sin(a);
      return function (dx, dz, lift) { return pt(cx + dx * c - dz * sn, cz + dx * sn + dz * c, lift || 0); };
    }
    function poly(list) { return 'M' + list.join('L') + 'Z'; }
    var W = 46;
    var L = 59;
    var st = sheet(388, 66, -6);
    var top = sheet(384, 68, -11);
    var leaves = '';
    [1.4, 2.8, 4.2].forEach(function (lift) { leaves += 'M' + st(-W, -L, lift) + 'L' + st(W, -L, lift); });
    var type = '';
    for (var i = 0, dz = -L + 22; dz < L - 8; dz += 8.5, i++) {
      var end = (i % 4 === 3) ? W - 30 : W - 8;
      type += 'M' + top(-W + 8, dz, 6) + 'L' + top(end, dz, 6);
    }
    return {
      edge: poly([st(-W, -L, 0), st(W, -L, 0), st(W, -L, 5), st(W, L, 5), st(-W, L, 5), st(-W, -L, 5)]),
      stackTop: poly([st(-W, -L, 5), st(W, -L, 5), st(W, L, 5), st(-W, L, 5)]),
      leaves: leaves,
      page: poly([top(-W, -L, 6), top(W, -L, 6), top(W, L, 6), top(-W, L, 6)]),
      head: poly([top(-W, -L, 6), top(W, -L, 6), top(W, -L + 13, 6), top(-W, -L + 13, 6)]),
      type: type
    };
  })();

  function NewsDesk(props) {
    var kind = EVENTS[props.kind] ? props.kind : 'needs-input';
    var part = DAY_PARTS.indexOf(props.part) >= 0 ? props.part : dayPart(props.time);
    var city = SKYLINE.parts[part];
    var dark = part === 'evening' || part === 'night';
    /* the key light takes the story's colour */
    return h('div', { className: cx('pn-desk', 'pn-desk--' + part, 'pn-k-' + kind) },
      h('div', { className: 'pn-sky' }),
      h('svg', { className: 'pn-skyline', viewBox: '0 0 960 540', 'aria-hidden': 'true' },
        part === 'night' ? h('path', { className: 'pn-stars', d: SKYLINE.stars }) : null,
        h('path', { className: 'pn-towers', d: SKYLINE.towers }),
        h('path', { className: 'pn-win-dark', d: city.dark }),
        city.warm ? h('path', { className: 'pn-win-lit', d: city.warm }) : null,
        city.cool ? h('path', { className: 'pn-win-cool', d: city.cool }) : null,
        dark ? h('path', { className: 'pn-beacons', d: SKYLINE.beacons }) : null,
        h('path', { className: 'pn-mullions', d: MULLIONS })),
      h('div', { className: 'pn-glow', 'aria-hidden': 'true' }),
      h('div', { className: 'pn-anchor' },
        h(Clawd, { cell: 18, act: props.act || EVENTS[kind].act, animate: props.animate, pose: props.pose, eyes: props.eyes, arms: props.arms, facing: props.facing })),
      h('div', { className: 'pn-desk-front' }),
      h('div', { className: 'pn-desk-top' }),
      h('div', { className: 'pn-script-shadow', 'aria-hidden': 'true' }),
      h('svg', { className: 'pn-script', viewBox: '0 0 960 540', 'aria-hidden': 'true' },
        h('path', { className: 'pn-script-edge', d: SCRIPT.edge }),
        h('path', { className: 'pn-script-leaves', d: SCRIPT.leaves }),
        h('path', { className: 'pn-script-stack', d: SCRIPT.stackTop }),
        h('path', { className: 'pn-script-page', d: SCRIPT.page }),
        h('path', { className: 'pn-script-head', d: SCRIPT.head }),
        h('path', { className: 'pn-script-type', d: SCRIPT.type })),
      h('div', { className: 'pn-mug', 'aria-hidden': 'true' },
        h('i', { className: 'pn-mug-handle' }),
        h('i', { className: 'pn-mug-body' }),
        h('i', { className: 'pn-mug-rim' })),
      h('svg', { className: 'pn-desk-lip', viewBox: '0 0 960 540', 'aria-hidden': 'true' },
        h('path', { className: 'pn-lip-chrome', d: 'M0 348Q480 358 960 348V353Q480 363 0 353Z' }),
        h('path', { className: 'pn-lip-lo', d: 'M0 351Q480 361 960 351V353Q480 363 0 353Z' }),
        h('path', { className: 'pn-lip-hi', d: 'M0 348Q480 358 960 348V349.5Q480 359.5 0 349.5Z' }),
        h('path', { className: 'pn-lip-gold', d: 'M0 353Q480 363 960 353V356Q480 366 0 356Z' })));
  }

  /* Steps through a run of scenes when animated; a static frame shows the first. */
  function useRun(run, animate) {
    var st = useState(0);
    var i = st[0];
    var setI = st[1];
    var n = run && run.length ? run.length : 0;
    useEffect(function () {
      if (!n || !animate) { return undefined; }
      var id = setTimeout(function () {
        setI(function (x) { return x + 1; });
      }, Math.max(0.4, num(run[i % n].dur, 4)) * 1000);
      return function () { clearTimeout(id); };
    }, [n, animate, i]);
    if (!n) { return null; }
    return { scene: run[i % n].scene, index: i % n, step: i };
  }

  /* The board's ring sends out its signal: three waves 3 s apart, each
     leaving the ring and spreading to two and a half times its size as it
     fades, 9 s from the ring to gone. A wave's delay is read from the clock
     when it is drawn, so the board and an outro's board underneath send the
     same waves, and they never restart when the board comes back after a
     story. Drawn only while the picture animates: a still shows the ring
     alone, as reduced motion does. */
  var SIGNAL = { period: 9000, waves: 3 };
  function Signal() {
    var at = useState(function () { return Date.now(); })[0];
    var waves = [];
    for (var i = 0; i < SIGNAL.waves; i++) {
      var lead = (at + i * SIGNAL.period / SIGNAL.waves) % SIGNAL.period;
      waves.push(h('i', { key: i, style: { animationDelay: -lead + 'ms' } }));
    }
    return h('div', { className: 'pn-signal', 'aria-hidden': 'true' }, waves);
  }

  function Broadcast(props) {
    var animate = bool(props.animate, false);
    var run = props.run || (props.sample && RUNS[props.sample]) || null;
    var live = useRun(run, animate);
    var scene = (live && live.scene) || props.scene || SAMPLES[props.sample] || SAMPLES['run-board'];
    var mode = scene.mode || 'board';
    var ev = scene.event || {};
    var kind = EVENTS[ev.kind] ? ev.kind : 'needs-input';
    var parts = [];
    if (mode === 'desk') {
      parts.push(h(NewsDesk, { key: 'desk', kind: kind, act: scene.act, time: scene.clock, animate: animate }));
      parts.push(h(OTSBox, { key: 'ots', kind: kind, label: ev.label, command: ev.command, quote: ev.quote, figure: ev.figure, sub: ev.sub, foot: ev.foot }));
      parts.push(h(LowerThird, {
        key: 'l3',
        kind: kind,
        headline: scene.headline,
        strap: scene.strap,
        session: ev.session,
        project: ev.project
      }));
    } else if (mode === 'stinger') {
      parts.push(h(Stinger, { key: 'st', kind: kind, progress: scene.progress, animate: animate }));
    } else if (mode === 'outro') {
      /* the board it hands back to waits underneath, ring, signal, ticker
         and all, in a layer of its own so the ticker's tab and clock stay
         under the open */
      var back = scene.board || {};
      parts.push(h('div', { key: 'under', className: 'pn-board-under', style: { position: 'absolute', left: 0, top: 0, width: STAGE_W + 'px', height: STAGE_H + 'px', zIndex: 0 } },
        animate ? h(Signal) : null,
        h(SessionBoard, { sessions: back.sessions }),
        h(Ticker, { items: back.ticker, time: back.clock, animate: animate })));
      parts.push(scene.open === 'hour'
        ? h(Ident, { key: 'id-out', outro: true, hour: scene.hour, progress: scene.progress, animate: animate })
        : h(Stinger, { key: 'st', outro: true, progress: scene.progress, animate: animate }));
    } else if (mode === 'ident') {
      parts.push(h(Ident, { key: 'id', hour: scene.hour, progress: scene.progress, animate: animate }));
    } else if (mode === 'review') {
      parts.push(h(HourReview, { key: 'rv', rows: scene.rows, span: scene.span, label: scene.label, animate: animate }));
    } else {
      if (animate) { parts.push(h(Signal, { key: 'signal' })); }
      parts.push(h(SessionBoard, { key: 'board', sessions: scene.sessions, animate: animate }));
    }
    parts.push(h(TopBand, { key: 'top' }));
    if (mode !== 'stinger' && mode !== 'outro' && mode !== 'ident') {
      parts.push(h(Ticker, { key: 'tick', items: scene.ticker, time: scene.clock, label: scene.tickerLabel, offset: scene.tickerOffset, animate: animate }));
    }
    return h('div', {
      key: live ? 'scene-' + live.step : 'scene',
      className: cx('pn-broadcast', 'pn-mode-' + mode, (mode === 'stinger' || (mode === 'outro' && scene.open !== 'hour')) && 'pn-k-breaking'),
      style: { position: 'absolute', left: 0, top: 0, width: STAGE_W + 'px', height: STAGE_H + 'px' }
    }, parts);
  }

  function Stage(props) {
    var w = num(props.width, STAGE_W);
    /* One crawl per stage: every Ticker drawn on it carries on the same belt */
    var crawl = useState(function () { return { belt: null }; })[0];
    return h(CrawlContext.Provider, { value: crawl },
      h('div', { className: 'pn-stage-wrap', style: { width: w + 'px', height: (w * STAGE_H / STAGE_W) + 'px' } },
        h('div', {
          className: cx('pn-stage', bool(props.animate, false) && 'pn-anim'),
          style: { transform: 'scale(' + (w / STAGE_W) + ')' }
        }, props.children)));
  }

  /* ------------------------------------------------------------------
     Our window around the feed: the proof of concept's own panel, not
     macOS's picture-in-picture, drawn to look like it. On hover it shows
     three controls: close (stop tracking) at the top left, and sound on or
     off and Back to Claude at the top right.
     ------------------------------------------------------------------ */
  /* The glyphs are drawn for macOS's 33 pt buttons; ours are 44 pt
     (pip-control), so every glyph is drawn a third bigger */
  var GLYPH_SCALE = 44 / 33;
  function glyphSize(n) { return Math.round(n * GLYPH_SCALE * 100) / 100; }
  function icon(w, hgt, kids) {
    return h('svg', {
      width: glyphSize(w), height: glyphSize(hgt), viewBox: '0 0 ' + w + ' ' + hgt, fill: 'none', stroke: 'currentColor',
      strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true'
    }, kids);
  }
  /* Masks need ids; each icon gets its own */
  var iconSeq = 0;
  function nextId(base) { iconSeq += 1; return base + '-' + iconSeq; }

  /* close: an X */
  function iconClose() {
    return icon(14, 14, [h('path', { key: 'x', d: 'M2.6 2.6l8.8 8.8M11.4 2.6l-8.8 8.8', strokeWidth: 1.7 })]);
  }
  /* Back to Claude: macOS's own glyph for leaving picture-in-picture. The
     window behind in outline with an arrow out of its corner, and a solid
     window in front of it, cut clear of the outline. */
  function iconReturn() {
    var id = nextId('pn-ret');
    return icon(22, 18, [
      h('defs', { key: 'd' },
        h('mask', { id: id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 22, height: 18 },
          h('rect', { x: 0, y: 0, width: 22, height: 18, fill: '#ffffff' }),
          h('rect', { x: 7, y: 5.5, width: 15.5, height: 12.5, rx: 3.6, fill: '#000000' }))),
      h('g', { key: 'b', mask: 'url(#' + id + ')' },
        h('rect', { x: 1, y: 1, width: 15.5, height: 11.5, rx: 2.6, strokeWidth: 1.5 }),
        h('path', { d: 'M4.2 3.6v3.3M4.2 3.6h3.3M4.4 3.8l3.8 3.6', strokeWidth: 1.4 })),
      h('rect', { key: 'f', x: 8.8, y: 7.2, width: 12, height: 9, rx: 2.4, fill: 'currentColor', stroke: 'none' })
    ]);
  }
  /* sound: a speaker sending out two waves when on, crossed by a slash when off */
  function iconSound(on) {
    var body = 'M2.1 5.7h2.6l3.6-3.2c.5-.4 1.2-.1 1.2.6v9.8c0 .7-.7 1-1.2.6L4.7 10.3H2.1c-.6 0-1.1-.5-1.1-1.1V6.8c0-.6.5-1.1 1.1-1.1z';
    if (on) {
      return icon(20, 16, [
        h('path', { key: 'b', d: body, fill: 'currentColor', stroke: 'none' }),
        h('path', { key: 'w1', d: 'M12.2 5.4a3.6 3.6 0 0 1 0 5.2', strokeWidth: 1.6 }),
        h('path', { key: 'w2', d: 'M14.8 3a7 7 0 0 1 0 10', strokeWidth: 1.6 })
      ]);
    }
    var id = nextId('pn-mute');
    return icon(20, 16, [
      h('defs', { key: 'd' },
        h('mask', { id: id, maskUnits: 'userSpaceOnUse', x: 0, y: 0, width: 20, height: 16 },
          h('rect', { x: 0, y: 0, width: 20, height: 16, fill: '#ffffff' }),
          h('path', { d: 'M1.6 1.4l14.4 13.2', stroke: '#000000', strokeWidth: 4.2 }))),
      h('g', { key: 'g', mask: 'url(#' + id + ')' },
        h('path', { d: body, fill: 'currentColor', stroke: 'none' }),
        h('path', { d: 'M12.2 5.4a3.6 3.6 0 0 1 0 5.2', strokeWidth: 1.6 })),
      h('path', { key: 's', d: 'M1.6 1.4l14.4 13.2', strokeWidth: 1.7 })
    ]);
  }

  /* The hover controls, in Liquid Glass as macOS draws picture-in-picture:
     clear glass circles the picture shows through, 44 pt, over a light
     dimming of the picture so white glyphs read on any frame. `sound` is the
     state the sound button shows ("on" or "off"); `hover` names the button
     under the pointer ("close", "sound" or "back"): its glass brightens and
     nothing pops up, no name and no tooltip. The names are for VoiceOver
     only. Review boards mimic the glass; the app uses macOS's own. */
  function PipControls(props) {
    var w = num(props.width, 716);
    var soundOn = !(props.sound === 'off' || props.sound === false || props.sound === 'false');
    function button(key, cls, label, glyph) {
      var under = props.hover === key;
      return h('div', { key: key, className: cx('pn-glass', 'pn-ctl-btn', cls, under && 'pn-glass--hover'), role: 'img', 'aria-label': label }, glyph);
    }
    return h('div', { className: 'pn-ctl', style: { width: w + 'px', height: Math.round(w * 9 / 16) + 'px' } },
      h('div', { key: 'dim', className: 'pn-ctl-dim' }),
      button('close', 'pn-ctl-close', 'Stop tracking', iconClose()),
      button('sound', 'pn-ctl-sound', soundOn ? 'Mute' : 'Unmute', iconSound(soundOn)),
      button('back', 'pn-ctl-return', 'Back to Claude', iconReturn()));
  }

  /* `blank` draws the window with nothing in it: the window itself, for
     designing the window. */
  function Pip(props) {
    var w = num(props.width, 716);
    var animate = bool(props.animate, false);
    var blank = bool(props.blank, false);
    var content = blank ? null : hasElements(props.children) ? props.children
      : h(Broadcast, { scene: props.scene, sample: props.sample, run: props.run, animate: animate });
    var style = { width: w + 'px', height: Math.round(w * 9 / 16) + 'px' };
    if (props.radius !== undefined) { style.borderRadius = num(props.radius, 20) + 'px'; }
    return h('div', {
      className: cx('pn-pip', bool(props.shadow, true) && 'pn-pip--shadow', props.className),
      style: style
    },
    blank ? null : h(Stage, { width: w, animate: animate }, content),
    bool(props.controls, false) ? h(PipControls, { width: w, sound: props.sound, hover: props.hover }) : null);
  }

  /* The window's size is its quadrant: the screen's visible area splits into
     four quadrants at its centre lines (as in the proof of concept's
     Corner.swift), and the window fills its quadrant at 16:9, `margin` in from
     every side. That full size is where it opens and the largest it ever gets;
     it resizes down to `minScale` of it. */
  function pct(v, d) {
    if (typeof v === 'string' && v.trim().slice(-1) === '%') { return num(v.trim().slice(0, -1), d * 100) / 100; }
    return num(v, d);
  }
  function pipSize(screenW, screenH, margin) {
    var qw = num(screenW, 1512) / 2;
    var qh = num(screenH, 982) / 2;
    var m = num(margin, 20);
    var w = Math.floor(qw - 2 * m);
    var hh = Math.round(w * 9 / 16);
    var cap = Math.floor(qh - 2 * m);
    if (hh > cap) { hh = cap; w = Math.round(hh * 16 / 9); }
    return { width: w, height: hh };
  }
  function pipRange(screenW, screenH, margin, minScale) {
    var full = pipSize(screenW, screenH, margin);
    var nw = Math.round(full.width * pct(minScale, 0.7));
    return { min: { width: nw, height: Math.round(nw * 9 / 16) }, full: full };
  }

  /* ------------------------------------------------------------------
     Sample scenes. Example sessions, not anyone's real work: every frame
     on the station canvas names one of these, so changing a line here
     changes every frame that shows it.
     ------------------------------------------------------------------ */
  var S = {
    auth: { id: 'auth', name: 'Refactor auth middleware', project: 'api-server' },
    checkout: { id: 'checkout', name: 'Fix flaky checkout test', project: 'web-shop' },
    notes: { id: 'notes', name: 'Write release notes for 2.4', project: 'docs-site' },
    sqlite: { id: 'sqlite', name: 'Migrate settings to SQLite', project: 'desktop-app' },
    crash: { id: 'crash', name: 'Check last night\u2019s crash reports', project: 'mobile-app' },
    search: { id: 'search', name: 'Speed up product search', project: 'search-api' },
    runners: { id: 'runners', name: 'Move CI to the new runners', project: 'ci-config' }
  };
  function at(base, state) {
    return { id: base.id, name: base.name, project: base.project, state: state };
  }
  /* Needs your input, a permission: the command, and Claude's own description of it */
  var EV_ASK = { kind: 'needs-input', session: S.checkout.name, project: S.checkout.project, command: 'npm install', quote: 'Install dependencies', foot: 'Waiting 0:12' };
  var EV_READY = { kind: 'ready', session: S.notes.name, project: S.notes.project, figure: '+182 \u221240', sub: '4 files changed', foot: 'Finished in 9 min' };
  /* Needs your input, the other kind: a question, not a permission */
  var EV_QUESTION = { kind: 'needs-input', session: S.auth.name, project: S.auth.project, quote: 'Expired sessions: log users out at once, or on their next request?', foot: 'Waiting 0:05' };
  /* Finished with nothing changed: Claude's last words, quoted */
  var EV_COMPLETE = { kind: 'complete', session: S.crash.name, project: S.crash.project, quote: 'Both crashes come from the old 3.1 build. Nothing to fix.', foot: 'Finished in 6 min' };
  /* Stopped on an error: the engine's error kind, in plain words */
  var EV_ERROR = { kind: 'error', session: S.sqlite.name, project: S.sqlite.project, quote: 'Claude is overloaded right now. Try again in a moment.', foot: 'Stopped after 31 min' };
  var EV_ASK_LONG = {
    kind: 'needs-input',
    session: 'Investigate the intermittent failures in the nightly integration pipeline',
    project: 'ci-config',
    quote: 'Run the whole integration suite against the staging database? It takes about 25 minutes, needs the VPN up the whole time and locks the shared test accounts until it ends.',
    foot: 'Waiting 0:08'
  };
  var EV_READY_LONG = {
    kind: 'ready',
    session: 'Upgrade every package in the monorepo to its latest major version and fix what breaks',
    project: 'platform-monorepo',
    figure: '+12,480 \u22129,731',
    sub: '238 files changed',
    foot: 'Finished in 1 h 48 min'
  };
  var EV_HOUR = { kind: 'hourly', figure: '+1,546 \u2212368', sub: 'Across 4 sessions', foot: '14:00 to 15:00' };
  var TICK_WORKING = [
    'api-server: editing src/auth/session.ts',
    'web-shop: running the test suite',
    'docs-site: drafting CHANGELOG.md',
    'desktop-app: writing migration 004'
  ];
  var TICK_ASK = [
    { lead: 'BREAKING', text: 'Fix flaky checkout test needs your input' },
    'api-server: editing src/auth/session.ts',
    'docs-site: drafting CHANGELOG.md'
  ];
  var TICK_HOUR = [
    { lead: 'ON THE HOUR', text: '2 stories since 14:00' },
    { lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input \u00B7 27 min' },
    { lead: 'READY', text: 'Release notes for 2.4 waiting for review' }
  ];

  var SAMPLES = {
    /* The live board: how many sessions, and what they need */
    'board-one': {
      mode: 'board',
      clock: '14:32',
      sessions: [at(S.auth, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '1 session working' }, TICK_WORKING[0]]
    },
    'board-two': {
      mode: 'board',
      clock: '14:32',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '2 sessions working' }, TICK_WORKING[0], TICK_WORKING[1]]
    },
    'board-three': {
      mode: 'board',
      clock: '14:32',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '3 sessions working' }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
    },
    'run-board': {
      mode: 'board',
      clock: '14:32',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'working'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '4 sessions working' }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
    },
    'board-needs-you': {
      mode: 'board',
      clock: '14:34',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'needs-input'), at(S.notes, 'working'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input \u00B7 1 min' }, TICK_WORKING[0], TICK_WORKING[2]]
    },
    'board-ready': {
      mode: 'board',
      clock: '14:37',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'ready'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'BREAKING', text: 'Release notes for 2.4 ready for review' }, TICK_WORKING[0], TICK_WORKING[1]]
    },
    'run-return': {
      mode: 'board',
      clock: '14:38',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'needs-input'), at(S.notes, 'ready'), at(S.sqlite, 'working')],
      ticker: [
        { lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input \u00B7 5 min' },
        { lead: 'READY', text: 'Release notes for 2.4 waiting for review' }
      ]
    },

    /* More than four: seven sessions, four a page */
    'board-seven': {
      mode: 'board',
      clock: '14:38',
      sessions: [at(S.checkout, 'needs-input'), at(S.notes, 'ready'), at(S.auth, 'working'), at(S.sqlite, 'working'), at(S.crash, 'working'), at(S.search, 'working'), at(S.runners, 'working')],
      ticker: [
        { lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input · 5 min' },
        { lead: 'READY', text: 'Release notes for 2.4 waiting for review' },
        'api-server: editing src/auth/session.ts'
      ]
    },

    /* Breaking news: needs your input */
    'brk-stinger-1': { mode: 'stinger', clock: '14:33', progress: 0.34, event: EV_ASK },
    'brk-stinger-2': { mode: 'stinger', clock: '14:33', progress: 0.74, event: EV_ASK },
    'run-stinger': { mode: 'stinger', clock: '14:33', progress: 1, event: EV_ASK },
    'run-needs-input': { mode: 'desk', clock: '14:33', act: 'urgent', event: EV_ASK, ticker: TICK_ASK },
    /* the longest text it has to carry: a long title on the strap, a question past three lines */
    'brk-long-desk': {
      mode: 'desk',
      clock: '14:41',
      act: 'urgent',
      event: EV_ASK_LONG,
      ticker: [{ lead: 'BREAKING', text: EV_ASK_LONG.session + ' needs your input' }, TICK_WORKING[0], TICK_WORKING[2]]
    },

    /* Every story airs as BREAKING NEWS: the same open, then its own desk.
       Each has a run from the board and back, all in the same afternoon, so
       only the story changes. */

    /* Needs your input, the other kind: Claude asks you a question */
    'ask-question-desk': {
      mode: 'desk',
      clock: '14:41',
      act: 'urgent',
      event: EV_QUESTION,
      ticker: [{ lead: 'BREAKING', text: 'Refactor auth middleware needs your input' }, TICK_WORKING[1], TICK_WORKING[2]]
    },

    /* Finished, with changes: READY FOR REVIEW */
    'ready-board': {
      mode: 'board',
      clock: '14:36',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'working'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '4 sessions working' }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
    },
    'ready-desk': {
      mode: 'desk',
      clock: '14:36',
      act: 'cheer',
      event: EV_READY,
      ticker: [{ lead: 'BREAKING', text: 'Release notes for 2.4 ready for review' }, TICK_WORKING[0], TICK_WORKING[1]]
    },
    /* the longest text: a long title on the strap, the biggest changes on the monitor */
    'ready-long-desk': {
      mode: 'desk',
      clock: '16:02',
      act: 'cheer',
      event: EV_READY_LONG,
      ticker: [{ lead: 'BREAKING', text: EV_READY_LONG.session + ' ready for review' }, TICK_WORKING[0], TICK_WORKING[1]]
    },

    /* Finished, nothing changed: WORK COMPLETE, with Claude's last words */
    'complete-board': {
      mode: 'board',
      clock: '14:44',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.crash, 'working'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '4 sessions working' }, TICK_WORKING[0], TICK_WORKING[1], 'mobile-app: reading the crash reports']
    },
    'complete-desk': {
      mode: 'desk',
      clock: '14:44',
      act: 'talk',
      event: EV_COMPLETE,
      ticker: [{ lead: 'BREAKING', text: 'Last night\u2019s crash reports checked: nothing to fix' }, TICK_WORKING[0], TICK_WORKING[1]]
    },
    'complete-return': {
      mode: 'board',
      clock: '14:44',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.crash, 'ready'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'BREAKING', text: 'Last night\u2019s crash reports checked: nothing to fix' }, TICK_WORKING[0], TICK_WORKING[1]]
    },

    /* Stopped on an error: the turn died on an API error */
    'error-board': {
      mode: 'board',
      clock: '14:47',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'working'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '4 sessions working' }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[3]]
    },
    'error-desk': {
      mode: 'desk',
      clock: '14:47',
      act: 'glance',
      event: EV_ERROR,
      ticker: [{ lead: 'BREAKING', text: 'Migrate settings to SQLite stopped on an error' }, TICK_WORKING[0], TICK_WORKING[1]]
    },
    'error-return': {
      mode: 'board',
      clock: '14:47',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'working'), at(S.sqlite, 'error')],
      ticker: [{ lead: 'STILL WAITING', text: 'Migrate settings to SQLite stopped on an error' }, TICK_WORKING[0], TICK_WORKING[1]]
    },

    /* Every pill on the board at once, sorted: INPUT, ERROR, READY, LIVE */
    'board-every-state': {
      mode: 'board',
      clock: '14:52',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'needs-input'), at(S.notes, 'ready'), at(S.sqlite, 'error')],
      ticker: [
        { lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input \u00B7 19 min' },
        { lead: 'STILL WAITING', text: 'Migrate settings to SQLite stopped on an error \u00B7 5 min' },
        { lead: 'BREAKING', text: 'Release notes for 2.4 ready for review' }
      ]
    },

    /* One after another: a story lands while another is at the desk. It goes
       into the ticker as COMING UP and airs, with its own BREAKING NEWS, as
       soon as that desk ends; then the board carries both. All within 14:36. */
    'queue-desk': {
      mode: 'desk',
      clock: '14:36',
      act: 'urgent',
      event: EV_ASK,
      ticker: [{ lead: 'COMING UP', text: 'Release notes for 2.4 ready for review' }, { lead: 'BREAKING', text: 'Fix flaky checkout test needs your input' }, TICK_WORKING[0]]
    },
    'queue-next-desk': {
      mode: 'desk',
      clock: '14:36',
      act: 'cheer',
      event: EV_READY,
      ticker: [{ lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input' }, { lead: 'BREAKING', text: 'Release notes for 2.4 ready for review' }, TICK_WORKING[0]]
    },
    'queue-return': {
      mode: 'board',
      clock: '14:36',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'needs-input'), at(S.notes, 'ready'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input' }, { lead: 'BREAKING', text: 'Release notes for 2.4 ready for review' }, TICK_WORKING[0]]
    },

    /* On the hour: the 15:00 report on the same four sessions, and a quiet
       hour elsewhere in the day. The hour's numbers are examples too. */
    'hour-board': {
      mode: 'board',
      clock: '14:59',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'needs-input'), at(S.notes, 'ready'), at(S.sqlite, 'working')],
      ticker: [
        { lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input \u00B7 26 min' },
        { lead: 'READY', text: 'Release notes for 2.4 waiting for review' },
        TICK_WORKING[0]
      ]
    },
    'hour-ident-1': { mode: 'ident', clock: '14:59', hour: '15:00', progress: 0.45 },
    'hour-ident-2': { mode: 'ident', clock: '15:00', hour: '15:00', progress: 1 },
    'hour-desk': {
      mode: 'desk',
      clock: '15:00',
      act: 'talk',
      event: EV_HOUR,
      headline: '2 STORIES',
      strap: '1 needs you \u00B7 1 ready for review',
      ticker: TICK_HOUR
    },
    'hour-review': {
      mode: 'review',
      clock: '15:00',
      span: '14:00\u201315:00',
      rows: [
        { id: 'auth', project: 'api-server', state: 'working', detail: '+1,204 \u2212310' },
        { id: 'checkout', project: 'web-shop', state: 'needs-input', detail: 'Waiting 27 min' },
        { id: 'notes', project: 'docs-site', state: 'ready', detail: '+182 \u221240' },
        { id: 'sqlite', project: 'desktop-app', state: 'working', detail: '+64 \u221212' }
      ],
      ticker: TICK_HOUR
    },
    'review-seven': {
      mode: 'review',
      clock: '15:00',
      span: '14:00–15:00',
      rows: [
        { id: 'checkout', project: 'web-shop', state: 'needs-input', detail: 'Waiting 27 min' },
        { id: 'notes', project: 'docs-site', state: 'ready', detail: '+182 −40' },
        { id: 'auth', project: 'api-server', state: 'working', detail: '+1,204 −310' },
        { id: 'sqlite', project: 'desktop-app', state: 'working', detail: '+64 −12' },
        { id: 'crash', project: 'mobile-app', state: 'working', detail: '+18 −3' },
        { id: 'search', project: 'search-api', state: 'working', detail: '+240 −88' },
        { id: 'runners', project: 'ci-config', state: 'working', detail: '+31 −9' }
      ],
      ticker: TICK_HOUR
    },
    'hour-return': {
      mode: 'board',
      clock: '15:01',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'needs-input'), at(S.notes, 'ready'), at(S.sqlite, 'working')],
      ticker: [
        { lead: 'ON THE HOUR', text: '2 stories at 15:00 \u00B7 next report 16:00' },
        { lead: 'STILL WAITING', text: 'Fix flaky checkout test needs your input \u00B7 28 min' }
      ]
    },
    'hour-quiet': {
      mode: 'desk',
      clock: '11:00',
      act: 'talk',
      event: { kind: 'hourly', figure: '+204 \u221218', sub: 'Across 4 sessions', foot: '10:00 to 11:00' },
      headline: 'A QUIET HOUR',
      strap: '4 sessions working, nothing needs you',
      ticker: [{ lead: 'ON THE HOUR', text: 'A quiet hour: 4 sessions working' }, TICK_WORKING[0], TICK_WORKING[2]]
    },
    'quiet-board': {
      mode: 'board',
      clock: '10:59',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'working'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'ON THE DESK', text: '4 sessions working' }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
    },
    'quiet-ident': { mode: 'ident', clock: '11:00', hour: '11:00', progress: 1 },
    'quiet-return': {
      mode: 'board',
      clock: '11:00',
      sessions: [at(S.auth, 'working'), at(S.checkout, 'working'), at(S.notes, 'working'), at(S.sqlite, 'working')],
      ticker: [{ lead: 'ON THE HOUR', text: 'A quiet hour \u00B7 next report 12:00' }, TICK_WORKING[0], TICK_WORKING[2]]
    },
    /* first come, first served: a question on air at the hour holds the report
       back, and a story that lands during the report waits for it */
    'hour-wait-desk': {
      mode: 'desk',
      clock: '15:00',
      act: 'urgent',
      event: EV_QUESTION,
      ticker: [{ lead: 'COMING UP', text: 'The 15:00 report' }, { lead: 'BREAKING', text: 'Refactor auth middleware needs your input' }]
    },
    'hour-desk-coming': {
      mode: 'desk',
      clock: '15:00',
      act: 'talk',
      event: EV_HOUR,
      headline: '2 STORIES',
      strap: '1 needs you \u00B7 1 ready for review',
      ticker: [{ lead: 'COMING UP', text: 'Migrate settings to SQLite stopped on an error' }, { lead: 'ON THE HOUR', text: '2 stories since 14:00' }]
    }
  };

  /* The outro: the open run out over the board it hands back to. `open` is
     'hour' for the report's outro (with its `hour`), else BREAKING NEWS's. */
  function outroOf(board, progress, open, hour) {
    return { mode: 'outro', clock: board.clock, progress: num(progress, 1), board: board, open: open, hour: hour };
  }
  SAMPLES['brk-outro-1'] = outroOf(SAMPLES['board-needs-you'], 0.4);
  SAMPLES['brk-outro-2'] = outroOf(SAMPLES['board-needs-you'], 0.8);
  SAMPLES['hour-outro-1'] = outroOf(SAMPLES['hour-return'], 0.4, 'hour', '15:00');
  SAMPLES['hour-outro-2'] = outroOf(SAMPLES['hour-return'], 0.8, 'hour', '15:00');

  var RUNS = {
    /* The board and its stories, as they air: a question, the board, then a
       finished session while the question still waits */
    loop: [
      { scene: SAMPLES['run-board'], dur: 4 },
      { scene: SAMPLES['run-stinger'], dur: 1.9 },
      { scene: SAMPLES['run-needs-input'], dur: 10 },
      { scene: outroOf(SAMPLES['board-needs-you']), dur: 1.4 },
      { scene: SAMPLES['board-needs-you'], dur: 4 },
      { scene: SAMPLES['run-stinger'], dur: 1.9 },
      { scene: SAMPLES['queue-next-desk'], dur: 10 },
      { scene: outroOf(SAMPLES['queue-return']), dur: 1.4 },
      { scene: SAMPLES['queue-return'], dur: 6 }
    ],
    /* BREAKING NEWS as it airs, for a permission ask: the board, the intro, the desk, the outro, back to the board */
    breaking: [
      { scene: SAMPLES['run-board'], dur: 2 },
      { scene: SAMPLES['run-stinger'], dur: 1.9 },
      { scene: SAMPLES['run-needs-input'], dur: 10 },
      { scene: outroOf(SAMPLES['board-needs-you']), dur: 1.4 },
      { scene: SAMPLES['board-needs-you'], dur: 5 }
    ],
    /* The other stories as they air, each from the board and back */
    'breaking-ready': [
      { scene: SAMPLES['ready-board'], dur: 2 },
      { scene: SAMPLES['run-stinger'], dur: 1.9 },
      { scene: SAMPLES['ready-desk'], dur: 10 },
      { scene: outroOf(SAMPLES['board-ready']), dur: 1.4 },
      { scene: SAMPLES['board-ready'], dur: 5 }
    ],
    'breaking-complete': [
      { scene: SAMPLES['complete-board'], dur: 2 },
      { scene: SAMPLES['run-stinger'], dur: 1.9 },
      { scene: SAMPLES['complete-desk'], dur: 10 },
      { scene: outroOf(SAMPLES['complete-return']), dur: 1.4 },
      { scene: SAMPLES['complete-return'], dur: 5 }
    ],
    'breaking-error': [
      { scene: SAMPLES['error-board'], dur: 2 },
      { scene: SAMPLES['run-stinger'], dur: 1.9 },
      { scene: SAMPLES['error-desk'], dur: 10 },
      { scene: outroOf(SAMPLES['error-return']), dur: 1.4 },
      { scene: SAMPLES['error-return'], dur: 5 }
    ],
    /* The 15:00 report as it airs: ident, desk, the hour in review, board */
    hour: [
      { scene: SAMPLES['hour-board'], dur: 2 },
      { scene: SAMPLES['hour-ident-2'], dur: 7.5 },
      { scene: SAMPLES['hour-desk'], dur: 10 },
      { scene: SAMPLES['hour-review'], dur: 10 },
      { scene: outroOf(SAMPLES['hour-return'], 1, 'hour', '15:00'), dur: 1.6 },
      { scene: SAMPLES['hour-return'], dur: 5 }
    ],
    /* A quiet hour: the ident, the desk and the outro, no review */
    'quiet-hour': [
      { scene: SAMPLES['quiet-board'], dur: 2 },
      { scene: SAMPLES['quiet-ident'], dur: 7.5 },
      { scene: SAMPLES['hour-quiet'], dur: 10 },
      { scene: outroOf(SAMPLES['quiet-return'], 1, 'hour', '11:00'), dur: 1.6 },
      { scene: SAMPLES['quiet-return'], dur: 5 }
    ]
  };

  /* ------------------------------------------------------------------
     Sound. BREAKING NEWS and the hour each get a jingle, synthesised
     with Web Audio from a short score, so the product's own window and
     the review boards play the same thing. Every jingle is built on the
     station's four-note logo, one note per call letter, K-L-W-D: up a
     fourth, a fifth and a fourth (A, D, A, D in D minor for BREAKING NEWS,
     which plays for every story).
     Browsers only make sound after a click, so review boards play it from
     a button (PlayWithSound); the product plays it as the stinger starts.
     ------------------------------------------------------------------ */
  var HZ = {
    D2: 73.42, F2: 87.31, A2: 110.0, D3: 146.83, F3: 174.61, Fs3: 185.0, A3: 220.0, C4: 261.63, Cs4: 277.18,
    D4: 293.66, E4: 329.63, F4: 349.23, Fs4: 369.99, A4: 440.0, C5: 523.25, D5: 587.33, A5: 880.0, D6: 1174.66
  };

  function noise(ctx, seconds) {
    var rnd = seeded(7151);
    var n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) { d[i] = rnd() * 2 - 1; }
    return buf;
  }
  /* A hall: stereo noise with an exponential decay, made once per context */
  function hall(ctx, seconds) {
    var n = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var rnd = seeded(911 + ch * 31);
      var d = buf.getChannelData(ch);
      var pre = Math.floor(ctx.sampleRate * 0.012);
      for (var i = pre; i < n; i++) { d[i] = (rnd() * 2 - 1) * Math.pow(1 - (i - pre) / (n - pre), 3.2); }
    }
    return buf;
  }

  /* The mix: a dry path and a hall send into a gentle compressor */
  function mixer(ctx, dest) {
    var master = ctx.createGain();
    master.gain.value = 0.5;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.knee.value = 8;
    comp.ratio.value = 2.5;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    var limit = ctx.createDynamicsCompressor();
    limit.threshold.value = -3;
    limit.knee.value = 0;
    limit.ratio.value = 20;
    limit.attack.value = 0.0015;
    limit.release.value = 0.08;
    var verb = ctx.createConvolver();
    verb.buffer = hall(ctx, 2.4);
    var wet = ctx.createGain();
    wet.gain.value = 0.24;
    var dry = ctx.createGain();
    verb.connect(wet);
    wet.connect(master);
    dry.connect(master);
    master.connect(comp);
    comp.connect(limit);
    limit.connect(dest);
    return { ctx: ctx, dry: dry, send: verb, master: master, white: noise(ctx, 2) };
  }
  function voice(m, level, sendLevel) {
    var g = m.ctx.createGain();
    g.gain.value = level;
    g.connect(m.dry);
    if (sendLevel) {
      var s = m.ctx.createGain();
      s.gain.value = sendLevel;
      g.connect(s);
      s.connect(m.send);
    }
    return g;
  }

  /* The instruments */
  function brass(m, t, f, dur, vel, rel) {
    var ctx = m.ctx;
    var r = rel || 0.28;
    var out = voice(m, 1, 0.8);
    var amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(vel, t + 0.018);
    amp.gain.exponentialRampToValueAtTime(vel * 0.6, t + 0.16);
    amp.gain.setValueAtTime(vel * 0.6, t + dur);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur + r);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.9;
    lp.frequency.setValueAtTime(f * 1.5, t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * 10, 8000), t + 0.04);
    lp.frequency.exponentialRampToValueAtTime(Math.min(f * 4, 5000), t + 0.3);
    [-8, 0, 7].forEach(function (cents) {
      var o = ctx.createOscillator();
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
  function timpani(m, t, f, vel, ring) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.5);
    var len = ring || 1.1;
    [[1, len], [1.5, len * 0.36], [1.99, len * 0.23]].forEach(function (p, i) {
      var o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.setValueAtTime(f * p[0] * 1.45, t);
      o.frequency.exponentialRampToValueAtTime(f * p[0], t + 0.045);
      var g = ctx.createGain();
      var v = vel * (i === 0 ? 1 : 0.35);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + p[1]);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + p[1] + 0.05);
    });
    var n = ctx.createBufferSource();
    n.buffer = m.white;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    var ng = ctx.createGain();
    ng.gain.setValueAtTime(vel * 0.6, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    n.connect(lp);
    lp.connect(ng);
    ng.connect(out);
    n.start(t);
    n.stop(t + 0.1);
  }
  function boom(m, t, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.2);
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 1.25);
  }
  function crash(m, t, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.9);
    var n = ctx.createBufferSource();
    n.buffer = m.white;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.9);
    n.connect(hp);
    hp.connect(g);
    g.connect(out);
    n.start(t);
    n.stop(t + 1.95);
  }
  function riser(m, t, dur, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.6);
    var n = ctx.createBufferSource();
    n.buffer = m.white;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 3;
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.exponentialRampToValueAtTime(7000, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
    n.connect(bp);
    bp.connect(g);
    g.connect(out);
    n.start(t);
    n.stop(t + dur + 0.05);
  }
  /* The logo's own voice: a bright FM bell over the brass */
  function bell(m, t, f, dur, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 1);
    var car = ctx.createOscillator();
    car.type = 'sine';
    car.frequency.value = f;
    var mod = ctx.createOscillator();
    mod.type = 'sine';
    mod.frequency.value = f * 3.5;
    var idx = ctx.createGain();
    idx.gain.setValueAtTime(f * 2.2, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.25, t + dur * 0.6);
    mod.connect(idx);
    idx.connect(car.frequency);
    var oct = ctx.createOscillator();
    oct.type = 'triangle';
    oct.frequency.value = f * 2;
    var og = ctx.createGain();
    og.gain.value = 0.18;
    oct.connect(og);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(g);
    og.connect(g);
    g.connect(out);
    [car, mod, oct].forEach(function (o) { o.start(t); o.stop(t + dur + 0.05); });
  }
  /* The newsroom pulse: short square ticks under the tail */
  function tick(m, t, f, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.3);
    var o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1900;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
    o.connect(lp);
    lp.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + 0.09);
  }
  function tremolo(m, t, f, dur, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 1);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 3200;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.08);
    g.gain.setValueAtTime(vel, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var trem = ctx.createGain();
    trem.gain.value = 0.5;
    var lfo = ctx.createOscillator();
    lfo.frequency.value = 13;
    var depth = ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth);
    depth.connect(trem.gain);
    [-6, 6].forEach(function (cents) {
      var o = ctx.createOscillator();
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

  /* BREAKING NEWS, 5.8 s. It is cut to the stinger's own marks (1.4 s): a
     riser and a timpani roll before the words, the logo's four notes on
     four hits as BREAKING and NEWS slam in, the last and biggest as NEWS
     lands, then the beat runs on under the desk and fades. */
  function scoreBreaking(m, t0) {
    var roll = [0, 0.06, 0.11, 0.155, 0.195, 0.23, 0.26, 0.285];
    riser(m, t0, 0.31, 0.12);
    roll.forEach(function (x, i) { timpani(m, t0 + x, HZ.D2, 0.06 + 0.22 * i / (roll.length - 1), 0.3); });
    var hits = [
      { at: 0.31, logo: HZ.A4, chord: [HZ.D3, HZ.F3, HZ.A3, HZ.D4], drum: HZ.D2, dur: 0.1 },
      { at: 0.45, logo: HZ.D5, chord: [HZ.F3, HZ.A3, HZ.D4], drum: HZ.A2, dur: 0.1 },
      { at: 0.59, logo: HZ.A5, chord: [HZ.F3, HZ.A3, HZ.C4, HZ.F4], drum: HZ.F2, dur: 0.12 },
      { at: 0.84, logo: HZ.D6, chord: [HZ.D3, HZ.A3, HZ.D4, HZ.F4, HZ.A4], drum: HZ.D2, dur: 1.0 }
    ];
    hits.forEach(function (x, i) {
      var last = i === hits.length - 1;
      x.chord.forEach(function (f) { brass(m, t0 + x.at, f, x.dur, last ? 0.17 : 0.06); });
      timpani(m, t0 + x.at, x.drum, last ? 1 : (i === 0 ? 0.35 : 0.3), last ? 1.3 : 0.6);
      bell(m, t0 + x.at, x.logo, last ? 1.7 : 0.55, last ? 0.3 : 0.17);
    });
    boom(m, t0 + 0.31, 0.15);
    boom(m, t0 + 0.84, 1);
    crash(m, t0 + 0.84, 0.5);
    brass(m, t0 + 0.84, HZ.D2, 1.0, 0.12);
    tremolo(m, t0 + 0.84, HZ.D5, 1.7, 0.05);
    tremolo(m, t0 + 0.84, HZ.A5, 1.7, 0.035);
    /* the beat runs on after the melody, under the cut to the desk (1.9 s),
       holds for two bars, then fades out by about 5.1 s: sixteenths on the
       logo's notes and a soft drum on every beat */
    var step = 60 / 132 / 4;
    var line = [HZ.D4, HZ.D4, HZ.A4, HZ.D4, HZ.F4, HZ.D4, HZ.A4, HZ.D4];
    var ticks = 36;
    var hold = 16;
    for (var k = 0; k < ticks; k++) {
      var fade = k < hold ? 1 : Math.pow(1 - (k - hold) / (ticks - hold), 1.5);
      tick(m, t0 + 1.02 + k * step, line[k % line.length], 0.13 * fade + 0.003);
      if (k % 4 === 0) { timpani(m, t0 + 1.02 + k * step, HZ.D2, 0.34 * fade + 0.02, 0.5); }
    }
  }

  /* BREAKING NEWS, the outro, 3.4 s. Cut to the outro's marks (1.2 s): a
     short roll as the glint crosses the words, three of the logo's notes on
     three hits as the words leave (D minor, then the dominant), and the
     fourth on a closing chord, D major, as the open fades to the board; then
     it rings out over the board. */
  function scoreBreakingOut(m, t0) {
    var roll = [0, 0.05, 0.09, 0.125, 0.155];
    riser(m, t0, 0.2, 0.07);
    roll.forEach(function (x, i) { timpani(m, t0 + x, HZ.D2, 0.05 + 0.12 * i / (roll.length - 1), 0.28); });
    var hits = [
      { at: 0.2, logo: HZ.A4, chord: [HZ.D3, HZ.F3, HZ.A3, HZ.D4], drum: HZ.D2 },
      { at: 0.38, logo: HZ.D5, chord: [HZ.F3, HZ.A3, HZ.D4], drum: HZ.A2 },
      { at: 0.56, logo: HZ.A5, chord: [HZ.A3, HZ.Cs4, HZ.E4], drum: HZ.A2 }
    ];
    hits.forEach(function (x, i) {
      x.chord.forEach(function (f) { brass(m, t0 + x.at, f, 0.1, 0.06); });
      timpani(m, t0 + x.at, x.drum, i === 0 ? 0.32 : 0.28, 0.5);
      bell(m, t0 + x.at, x.logo, 0.5, 0.16);
    });
    var end = t0 + 0.84;
    [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4, HZ.Fs4].forEach(function (f) { brass(m, end, f, 0.9, 0.15); });
    brass(m, end, HZ.D2, 0.9, 0.1);
    timpani(m, end, HZ.D2, 1, 1.3);
    boom(m, end, 0.85);
    crash(m, end, 0.42);
    bell(m, end, HZ.D6, 1.9, 0.28);
    tremolo(m, end, HZ.D5, 1.8, 0.045);
    tremolo(m, end, HZ.A5, 1.8, 0.03);
  }

  /* The station's time signal: a short pure tone on the logo's top note */
  function pip(m, t, dur, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.15);
    var o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = HZ.D6;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
    g.gain.setValueAtTime(vel, t + dur - 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  /* ON THE HOUR, 9.6 s from five seconds before the hour. Cut to the ident's
     marks (7.5 s): five short pips as the seconds hand steps (0-4 s), a long
     one on the hour as the minute hand jumps (5 s); then the logo's four
     notes on a stately brass fanfare in D major, on the strike, as ON THE
     lands, as HOUR lands, and the last and biggest as the words settle
     (6.4 s); it rings out into the desk. Routine, not news: no roll and no
     riser. */
  function scoreHour(m, t0) {
    for (var i = 0; i < 5; i++) { pip(m, t0 + i, 0.1, 0.16); }
    var strike = t0 + 5;
    pip(m, strike, 0.5, 0.18);
    var hits = [
      { at: 0, logo: HZ.A4, chord: [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4] },
      { at: 0.42, logo: HZ.D5, chord: [HZ.Fs3, HZ.A3, HZ.D4] },
      { at: 0.84, logo: HZ.A5, chord: [HZ.A3, HZ.Cs4, HZ.E4] },
      { at: 1.4, logo: HZ.D6, chord: [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4, HZ.Fs4] }
    ];
    hits.forEach(function (x, i) {
      var last = i === hits.length - 1;
      x.chord.forEach(function (f) { brass(m, strike + x.at, f, last ? 1.6 : 0.32, last ? 0.12 : 0.065); });
      timpani(m, strike + x.at, i % 2 ? HZ.A2 : HZ.D2, last ? 0.8 : 0.35, last ? 1.4 : 0.7);
      bell(m, strike + x.at, x.logo, last ? 2.2 : 0.7, last ? 0.26 : 0.16);
    });
    crash(m, strike + 1.4, 0.3);
    boom(m, strike + 1.4, 0.5);
    tremolo(m, strike + 1.4, HZ.D5, 2.6, 0.04);
    tremolo(m, strike + 1.4, HZ.A5, 2.6, 0.028);
  }

  /* ON THE HOUR, the outro, 3.6 s. Cut to the outro's marks (1.4 s): the
     logo's four notes come back down on the bells, top to bottom (D6, A5,
     D5, A4), over a soft pad as the words leave; then a warm
     D major chord as the clock goes and the ident fades to the board, dying
     away under the board. No pips, no roll. */
  function scoreHourOut(m, t0) {
    [{ at: 0.1, f: HZ.D6 }, { at: 0.3, f: HZ.A5 }, { at: 0.5, f: HZ.D5 }, { at: 0.7, f: HZ.A4 }].forEach(function (x) {
      bell(m, t0 + x.at, x.f, 0.9, 0.17);
    });
    [HZ.Fs3, HZ.A3, HZ.D4].forEach(function (f) { brass(m, t0 + 0.1, f, 0.7, 0.04); });
    var end = t0 + 1.0;
    [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4, HZ.Fs4].forEach(function (f) { brass(m, end, f, 0.3, 0.11, 1.8); });
    brass(m, end, HZ.D2, 0.3, 0.06, 1.8);
    timpani(m, end, HZ.D2, 0.55, 1.2);
    bell(m, end, HZ.D5, 2.0, 0.2);
    crash(m, end, 0.18);
    tremolo(m, end, HZ.A4, 2.2, 0.03);
    tremolo(m, end, HZ.D5, 2.2, 0.025);
  }

  var JINGLES = {
    breaking: { duration: 5.8, score: scoreBreaking },
    'breaking-out': { duration: 3.4, score: scoreBreakingOut },
    hour: { duration: 9.6, score: scoreHour },
    'hour-out': { duration: 3.6, score: scoreHourOut }
  };

  /* Plays a jingle now (or at `when`, on the context's clock). Returns a
     function that fades it out. */
  var AUDIO = null;
  var PLAYING = null;
  function audioContext() {
    var C = window.AudioContext || window.webkitAudioContext;
    if (!C) { return null; }
    if (!AUDIO) { AUDIO = new C(); }
    if (AUDIO.state === 'suspended') { AUDIO.resume(); }
    return AUDIO;
  }
  function playJingle(name, when) {
    return playJingles([{ name: name, at: num(when, 0) }]);
  }
  /* Several jingles in one mix, each at its time (`at`, on the context's
     clock): a segment's intro and outro. Returns a function that fades all. */
  function playJingles(list) {
    var ctx = audioContext();
    if (!ctx) { return function () {}; }
    if (PLAYING) { PLAYING(); }
    var out = ctx.createGain();
    out.connect(ctx.destination);
    var m = mixer(ctx, out);
    list.forEach(function (x) {
      var j = JINGLES[x.name];
      if (j) { j.score(m, Math.max(ctx.currentTime + 0.02, num(x.at, 0))); }
    });
    PLAYING = function () {
      var now = ctx.currentTime;
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.08);
      window.setTimeout(function () { out.disconnect(); }, 200);
    };
    return PLAYING;
  }
  /* Renders a jingle offline, for files and tests: resolves to an AudioBuffer. */
  function renderJingle(name, sampleRate) {
    var j = JINGLES[name];
    var C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!j || !C) { return Promise.reject(new Error('no jingle or no offline audio')); }
    var sr = num(sampleRate, 44100);
    var ctx = new C(2, Math.ceil(sr * j.duration), sr);
    var m = mixer(ctx, ctx.destination);
    j.score(m, 0.02);
    return ctx.startRendering();
  }

  /* Review-board furniture, never part of the window: the window playing a
     run, and under it a button that plays the run again from the start with
     its jingles: BREAKING NEWS as each intro starts, the outro's as each
     outro starts, and the hour's as its ident and its outro start. A run
     with none of them plays `jingle` at `cue`. */
  function PlayWithSound(props) {
    var w = num(props.width, 716);
    var st = useState(0);
    var take = st[0];
    var setTake = st[1];
    var cue = num(props.cue, 2);
    function play() {
      var ctx = audioContext();
      setTake(take + 1);
      if (!ctx) { return; }
      var list = [];
      var at = 0;
      (RUNS[props.sample] || []).forEach(function (step) {
        if (step.scene.mode === 'stinger') { list.push({ name: 'breaking', at: ctx.currentTime + at }); }
        if (step.scene.mode === 'outro') { list.push({ name: step.scene.open === 'hour' ? 'hour-out' : 'breaking-out', at: ctx.currentTime + at }); }
        if (step.scene.mode === 'ident') { list.push({ name: 'hour', at: ctx.currentTime + at }); }
        at += num(step.dur, 4);
      });
      if (!list.length) { list.push({ name: props.jingle || 'breaking', at: ctx.currentTime + cue }); }
      playJingles(list);
    }
    return h('div', { className: 'pn-sound', style: { width: w + 'px' } },
      h(Pip, { key: 'take-' + take, width: w, sample: props.sample, animate: true, shadow: false, radius: props.radius }),
      h('div', { className: 'pn-sound-bar' },
        h('button', { type: 'button', className: 'pn-sound-btn', onClick: play }, '\u25B6 Play with sound'),
        props.caption ? h('span', { className: 'pn-sound-note' }, props.caption) : null));
  }

  /* ------------------------------------------------------------------
     The band above the prompt: the mod's own control inside the Claude
     desktop app. One plate: KLWD in chrome on the studio plate and, at
     its end, the action, TUNE IN on the lower third's gold or TUNE OUT on
     the ticker clock's blue, parted from the mark by an edge of its own.
     TUNE IN puts this session on KLWD, TUNE OUT takes it off. There is no
     count: the plate is the same however many sessions are on KLWD. In
     the mod the plate is one Svg picture with a blank native Button laid
     over it, and that is all. Review boards draw it with the package's
     own classes.
     ------------------------------------------------------------------ */
  /* `tuned`: this session is on air. `parts` outlines the plate. */
  function Band(props) {
    var tuned = bool(props.tuned, false);
    return h('div', { className: cx('pn-band', bool(props.parts, false) && 'pn-band--parts') },
      h('span', { className: 'pn-band-plate', role: 'img', 'aria-label': tuned ? 'KLWD, Tune out' : 'KLWD, Tune in' },
        h('span', { className: 'pn-mark pn-band-mark' }, h('span', { className: 'pn-chrome pn-mark-letters' }, 'KLWD')),
        h('span', { className: cx('pn-band-act', tuned ? 'pn-band-act--out' : 'pn-band-act--in') },
          h('span', { className: 'pn-band-word' }, tuned ? 'TUNE OUT' : 'TUNE IN'))));
  }

  /* Review-board furniture: what usage-band, another mod by the same
     author, draws in the band, copied from its source (its marks and its
     own colours), to show ours beside another mod's. */
  var USAGE = { low: '#3A82DA', critical: '#D2544A', quiet: '#87867F', track: '#8C8C8C' };
  var USAGE_HOURGLASS = '<path d="M3.4 1.6h6.2M3.4 11.4h6.2M4 1.6v1.6l2.5 3.3L9 3.2V1.6M4 11.4V9.8l2.5-3.3L9 9.8v1.6"/>';
  var USAGE_CALENDAR = '<rect x="1.8" y="2.8" width="9.4" height="8.4" rx="1.6"/><path d="M1.8 5.7h9.4M4.4 1.5v2.4M8.6 1.5v2.4"/>';
  var USAGE_PADLOCK = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="22" viewBox="0 0 13 22"><g transform="translate(0 4.5)" fill="none" stroke="' + USAGE.quiet + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2.6" y="5.9" width="7.8" height="5.5" rx="1.4"/><path d="M4.3 5.9V3.3a2.2 2.2 0 0 1 4.4 0M6.5 8.2v.9"/></g></svg>';
  function usageMark(glyph, used, left, colour) {
    var ring = 59.06;
    var wedge = 18.85;
    return '<svg xmlns="http://www.w3.org/2000/svg" width="41" height="22" viewBox="0 0 41 22">' +
      '<g transform="translate(0 4.5)" fill="none" stroke="' + USAGE.quiet + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + glyph + '</g>' +
      '<circle cx="30" cy="11" r="9.4" fill="none" stroke="' + USAGE.track + '" stroke-opacity="0.3" stroke-width="2.6"/>' +
      '<circle cx="30" cy="11" r="9.4" fill="none" stroke="' + colour + '" stroke-width="2.6" stroke-dasharray="' + (ring * used).toFixed(2) + ' ' + ring + '" transform="rotate(-90 30 11)"/>' +
      '<circle cx="30" cy="11" r="3" fill="none" stroke="' + USAGE.track + '" stroke-opacity="0.3" stroke-width="6"/>' +
      '<circle cx="30" cy="11" r="3" fill="none" stroke="' + USAGE.quiet + '" stroke-width="6" stroke-dasharray="' + (wedge * left).toFixed(2) + ' ' + wedge + '" transform="rotate(-90 30 11)"/>' +
      '</svg>';
  }
  /* An Svg in the band is drawn as an image, as here */
  function svgImage(key, source, w, hgt, alt) {
    return h('img', { key: key, src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source), width: w, height: hgt, alt: alt });
  }
  function UsageBand() {
    return h('span', { className: 'pn-usage' },
      h('span', { key: 's', className: 'pn-usage-meter' }, svgImage('i', usageMark(USAGE_HOURGLASS, 0.42, 0.6, USAGE.low), 41, 22, 'Current session: 42% used'), h('b', { key: 'p', style: { color: USAGE.low } }, '42%')),
      h('span', { key: 'w', className: 'pn-usage-meter' }, svgImage('i', usageMark(USAGE_CALENDAR, 0.92, 0.3, USAGE.critical), 41, 22, 'Weekly: 92% used'), h('b', { key: 'p', style: { color: USAGE.critical } }, '92%')),
      svgImage('l', USAGE_PADLOCK, 13, 22, 'Session lock: off'));
  }

  /* Review-board furniture: a plain sketch of the Claude desktop app's
     prompt box with the band above it, in the app's light or dark theme.
     Not ours and never on air: no logo, no wordmark. The band holds
     `beside` ("usage": another mod's band, first, as our hook keeps what
     is beneath it) and then ours; Band's props pass through. `width` is
     the transcript column's, in px. */
  function PromptSketch(props) {
    var dark = props.theme === 'dark';
    var w = num(props.width, 720);
    return h('div', { className: cx('pn-app', dark ? 'pn-app--dark' : 'pn-app--light'), style: { width: (w + 80) + 'px' } },
      h('div', { key: 'lines', className: 'pn-app-lines', 'aria-hidden': 'true' },
        [0.94, 0.86, 0.58].map(function (f, i) { return h('i', { key: i, style: { width: Math.round(w * f) + 'px' } }); })),
      h('div', { key: 'band', className: 'pn-app-band' },
        props.beside === 'usage' ? h(UsageBand, { key: 'usage' }) : null,
        h(Band, { key: 'ours', tuned: props.tuned, parts: props.parts })),
      h('div', { key: 'field', className: 'pn-app-field' },
        h('span', { key: 'hint', className: 'pn-app-hint' }, 'Reply\u2026'),
        h('span', { key: 'add', className: 'pn-app-add', 'aria-hidden': 'true' },
          h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round' }, h('path', { d: 'M7 2.5v9M2.5 7h9' }))),
        h('span', { key: 'send', className: 'pn-app-send', 'aria-hidden': 'true' },
          h('svg', { width: 14, height: 14, viewBox: '0 0 14 14', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' }, h('path', { d: 'M7 11.5V2.5M3 6.5l4-4 4 4' })))));
  }

  window.PipNews = {
    Pip: Pip,
    PipControls: PipControls,
    Broadcast: Broadcast,
    TopBand: TopBand,
    Ticker: Ticker,
    LowerThird: LowerThird,
    Stinger: Stinger,
    Ident: Ident,
    SessionBoard: SessionBoard,
    StatePill: StatePill,
    NewsDesk: NewsDesk,
    OTSBox: OTSBox,
    HourReview: HourReview,
    Clawd: Clawd,
    Mark: Mark,
    Stage: Stage,
    crawlStep: crawlStep,
    crawlSpeed: CRAWL_SPEED,
    EVENTS: EVENTS,
    STATES: STATES,
    CLAWD_SOURCE: CLAWD_SOURCE,
    clawdGrid: clawdGrid,
    pipSize: pipSize,
    dayPart: dayPart,
    pipRange: pipRange,
    samples: SAMPLES,
    runs: RUNS,
    PlayWithSound: PlayWithSound,
    Band: Band,
    PromptSketch: PromptSketch,
    playJingle: playJingle,
    playJingles: playJingles,
    renderJingle: renderJingle,
    jingles: Object.keys(JINGLES)
  };
})();
