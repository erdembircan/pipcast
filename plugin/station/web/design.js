/* @ds-bundle: {"format":4,"namespace":"PipNews","components":[{"name":"Pip"},{"name":"PipControls"},{"name":"Broadcast"},{"name":"Backdrop"},{"name":"TopBand"},{"name":"Ticker"},{"name":"LowerThird"},{"name":"Stinger"},{"name":"Ident"},{"name":"SessionBoard"},{"name":"StatePill"},{"name":"NewsDesk"},{"name":"OTSBox"},{"name":"HourReview"},{"name":"WeatherIcon"},{"name":"WeatherNow"},{"name":"WeatherDays"},{"name":"Stormtracker"},{"name":"AlertOpen"},{"name":"Clawd"},{"name":"Mark"},{"name":"PlayWithSound"},{"name":"Band"},{"name":"PromptSketch"}]} */
(function () {
  'use strict';

  var React = window.React;
  if (!React) { return; }
  var h = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useLayoutEffect = React.useLayoutEffect;

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

  /* Clawd's clock. He moves in whole poses, so his acts step on a timer, 12
     times a second, and each step draws him again; he is a layer of his own,
     so a step redraws nothing behind him. Static frames never start it. The
     opens and outros have no clock: the compositor plays them (Motion on the
     compositor, below). */
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
     next. The belt runs at one speed whatever is on it, and each Stage
     keeps one belt for every Ticker it shows, so the crawl carries on
     across the cuts.

     The system's compositor moves it, as it moves the opens and outros.
     Each unit is a layer of its own that the Web Animations API carries
     in one straight run on the page's timeline, from the ticker's right
     end, out of sight, to just past the tab, and each run starts as the
     one before it has carried its unit's width, so the units ride end to
     end. The page only lays units on and takes them off, four times a
     second. Moved by the page a frame at a time, the crawl stuttered
     whenever something kept the page from its frames, as a game running
     behind the window does, while everything the compositor moved stayed
     smooth. While the window is hidden the belt stands still, and it
     carries on from where it stopped.
     ------------------------------------------------------------------ */
  var CRAWL_SPEED = 53; /* stage px a second: the pace of the live board's sample crawl, one pass every 40 s */
  var CRAWL_LEAD_IN = 22; /* a new belt starts its first item this far in from the tab, as a static frame does */
  var CRAWL_AHEAD = 120; /* the belt is laid this far past the clock, out of sight */
  var CRAWL_LINE = STAGE_W; /* every run starts at the ticker's right end, past the end of any view */
  var CRAWL_LOOK_MS = 250; /* how often the belt looks at what to lay on and take off */
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

  /* One look at the belt, with no drawing in it. `belt` is { offset,
     units, done, last, started }: how far the belt had moved past the left
     edge of the view at the last look (stage px), its units ({ key, item,
     width }), the keys laid in this round, the key of the last unit laid,
     and whether anything was ever laid. `input` is { offset, view, items,
     measure }: how far the belt has moved now, the view's width, the list
     as it is now, and measure(item), the width of a unit for that item.
     Returns { belt, dropped, laid }: the belt after the look, how many
     units have gone past the tab, and the items laid at its end. A unit
     with no item is an empty stretch. */
  function crawlStep(belt, input) {
    var offset = num(input.offset, belt.offset);
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
      if (!laid.length && units.length && end - offset < input.view) {
        /* The belt's end came into view before this look laid anything
           after it, as when the page was held up: the stretch to the clock
           stays empty, and the item comes on from the clock, as on an
           empty belt */
        units.push({ key: 'gap', item: null, width: input.view - (end - offset) });
        end = offset + input.view;
      }
      last = crawlKey(item);
      done[last] = true;
      units.push({ key: last, item: item, width: width });
      laid.push(item);
      end += width;
      started = true;
    }
    return { belt: { offset: offset, units: units, done: done, last: last, started: started }, dropped: dropped, laid: laid };
  }

  /* The run that carries a unit `width` stage px wide from the crawl's
     line to where its right end passes the tab, at the crawl's speed, so
     that its left edge is `x` px from the view's left edge at `now`, a
     time in ms on the page's timeline. Returns { keyframes, duration,
     startTime }, as the Web Animations API takes them. */
  function crawlRun(x, width, now) {
    return {
      keyframes: [
        { transform: 'translateX(' + CRAWL_LINE + 'px)' },
        { transform: 'translateX(' + (-width) + 'px)' }
      ],
      duration: (CRAWL_LINE + width) * 1000 / CRAWL_SPEED,
      startTime: now - (CRAWL_LINE - x) * 1000 / CRAWL_SPEED
    };
  }

  /* A unit: the item as a static frame draws it, and the diamond after it.
     With no item it is an empty stretch `width` px wide. */
  function crawlUnit(it, width) {
    var unit = document.createElement('span');
    unit.className = 'pn-ticker-unit';
    if (it === null) {
      unit.style.width = width + 'px';
      unit.style.paddingRight = '0';
      return unit;
    }
    var body = document.createElement('span');
    body.className = 'pn-ticker-item';
    var lead = typeof it === 'string' ? null : it.lead;
    var sky = typeof it === 'string' ? null : it.sky;
    /* the words go in the item, or after the sky's icon when it has one */
    var words = body;
    if (sky) {
      body.className += ' pn-wx-tick';
      var holder = document.createElement('span');
      holder.innerHTML = weatherIconMarkup(sky, nextWx());
      body.appendChild(holder.firstChild);
      words = document.createElement('span');
      body.appendChild(words);
    }
    if (lead) {
      var tag = document.createElement('span');
      tag.className = 'pn-ticker-lead';
      tag.textContent = lead + ' ';
      words.appendChild(tag);
    }
    words.appendChild(document.createTextNode(typeof it === 'string' ? it : (it.text || '')));
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

  /* Whether the page can hand a run to the compositor. Without the Web
     Animations API the crawl stands still, as with reduced motion. */
  function canCrawl() {
    return typeof window.Element === 'function' && typeof window.Element.prototype.animate === 'function';
  }

  /* The belt on air. React draws it empty; the units are laid on and taken
     off here, and each one moves on its own run. */
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
      var belt = store.belt || { offset: -CRAWL_LEAD_IN, units: [], done: {}, last: null, started: false };
      /* the units on screen, in the belt's order: each node and its run */
      var on = [];
      /* where the belt stands while the window is hidden, or null */
      var held = null;
      /* a typeface that lands changes the units' widths, and the belt is set
         again before the picture is drawn */
      var watch = typeof window.ResizeObserver === 'function'
        ? new window.ResizeObserver(function () { refit(now()); })
        : null;
      function now() {
        var t = document.timeline ? document.timeline.currentTime : null;
        return typeof t === 'number' ? t : window.performance.now();
      }
      function measure(item) {
        var probe = crawlUnit(item);
        el.appendChild(probe);
        var width = crawlWidth(probe);
        el.removeChild(probe);
        return width;
      }
      /* Hands a unit's node its run, so that its left edge is `x` at `t` */
      function carry(node, x, width, t) {
        var run = crawlRun(x, width, t);
        var anim = node.animate(run.keyframes, { duration: run.duration, fill: 'both' });
        anim.startTime = run.startTime;
        return anim;
      }
      /* Where a unit's left edge is at `t`, as its run carries it */
      function where(u, t) {
        return CRAWL_LINE - (t - u.anim.startTime) * CRAWL_SPEED / 1000;
      }
      function lay(unit, x, t) {
        var node = crawlUnit(unit.item, unit.width);
        el.appendChild(node);
        on.push({ node: node, anim: carry(node, x, unit.width, t) });
        if (watch) { watch.observe(node); }
      }
      function takeOff(u) {
        if (watch) { watch.unobserve(u.node); }
        u.anim.cancel();
        if (u.node.parentNode === el) { el.removeChild(u.node); }
      }
      /* How far the belt has moved past the view's left edge at `t`, read
         off the run of the unit laid last, which goes on longest */
      function offsetAt(t) {
        if (held !== null) { return held; }
        var n = on.length;
        if (!n || typeof on[n - 1].anim.startTime !== 'number') { return belt.offset; }
        var before = 0;
        for (var i = 0; i < n - 1; i++) { before += belt.units[i].width; }
        return before - where(on[n - 1], t);
      }
      /* Sets every unit's run again, so that the belt is `offset` past the
         view's left edge at `t` */
      function carryAll(offset, t) {
        var x = -offset;
        on.forEach(function (u, i) {
          u.anim.cancel();
          u.anim = carry(u.node, x, belt.units[i].width, t);
          x += belt.units[i].width;
        });
      }
      /* The units as drawn now. When a typeface has landed since they were
         measured, their widths have changed, and the belt is set again from
         where it is, the first unit staying where it was. */
      function refit(t) {
        if (held !== null) { return; }
        var changed = false;
        var units = belt.units.map(function (unit, i) {
          /* an empty stretch keeps the width it was laid with: no typeface
             changes it, and the layout gives it back rounded */
          var w = on[i] && unit.item !== null ? crawlWidth(on[i].node) : 0;
          if (w > 0 && w !== unit.width) {
            changed = true;
            return { key: unit.key, item: unit.item, width: w };
          }
          return unit;
        });
        if (!changed) { return; }
        var offset = offsetAt(t);
        belt = { offset: offset, units: units, done: belt.done, last: belt.last, started: belt.started };
        store.belt = belt;
        carryAll(offset, t);
      }
      function look() {
        if (held !== null) { return; }
        var t = now();
        refit(t);
        var next = crawlStep(belt, { offset: offsetAt(t), view: view.clientWidth, items: items.current, measure: measure });
        on.splice(0, next.dropped).forEach(takeOff);
        /* each new unit goes on at the end of the one before it, and the
           first on an empty belt where the belt is now */
        var all = next.belt.units;
        for (var j = on.length; j < all.length; j++) {
          lay(all[j], j > 0 ? where(on[j - 1], t) + all[j - 1].width : -next.belt.offset, t);
        }
        belt = next.belt;
        store.belt = belt;
      }
      /* While the window is hidden the belt stands where it is, and it
         carries on from there as the window shows again. WebKit stops a
         hidden page's clock, but its runs then carry on from where the
         clock has got to, as if they had run all the while. */
      function onVisibility() {
        if (document.visibilityState === 'hidden') {
          if (held === null) { held = offsetAt(now()); }
        } else if (held !== null) {
          var offset = held;
          held = null;
          belt.offset = offset;
          carryAll(offset, now());
        }
      }
      /* the units the belt has already, from where the last Ticker on this
         Stage left them */
      var t0 = now();
      var x0 = -belt.offset;
      belt.units.forEach(function (unit) {
        lay(unit, x0, t0);
        x0 += unit.width;
      });
      look();
      if (document.visibilityState === 'hidden') { held = belt.offset; }
      document.addEventListener('visibilitychange', onVisibility);
      var timer = window.setInterval(look, CRAWL_LOOK_MS);
      return function () {
        window.clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisibility);
        if (watch) { watch.disconnect(); }
        belt.offset = offsetAt(now());
        store.belt = belt;
        on.forEach(takeOff);
        on = [];
      };
    }, [store]);
    return h('div', { ref: ref, className: 'pn-ticker-belt' });
  }

  /* The crawl, with the clock at its right end. `sample` takes both from a scene. */
  function Ticker(props) {
    var scene = (props.sample && SAMPLES[props.sample]) || {};
    var items = props.items && props.items.length ? props.items : (scene.ticker || []);
    var time = props.time || scene.clock;
    var crawl = bool(props.animate, false) && !reducedMotion() && canCrawl();
    var offset = num(props.offset, 0);
    function half(prefix) {
      var out = [];
      items.forEach(function (it, i) {
        var lead = typeof it === 'string' ? null : it.lead;
        var text = typeof it === 'string' ? it : it.text;
        var sky = typeof it === 'string' ? null : it.sky;
        var leadSpan = lead ? h('span', { className: 'pn-ticker-lead' }, lead + ' ') : null;
        /* the forecast line carries its sky's icon before its words */
        out.push(sky
          ? h('span', { key: prefix + 'i' + i, className: 'pn-ticker-item pn-wx-tick' }, h(WeatherIcon, { sky: sky }), h('span', null, leadSpan, text))
          : h('span', { key: prefix + 'i' + i, className: 'pn-ticker-item' }, leadSpan, text));
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

  /* The account's usage limits under the listing, as chosen on PiP Newsroom ·
     Usage limits: SESSION, Claude's five-hour window, then WEEK, its
     seven-day one. Each is its name in the ticker's gold caps, a meter filled
     to the share used, and the figure, a whole percent. usage-band's steps in
     the station's colours: from 70% the meter and the figure turn the lower
     third's gold, from 90% BREAKING's red. They sit on the page tab's line,
     the tab keeping the right end, and stay put while the pages turn. */
  var LIMITS = [
    { kind: 'session', label: 'SESSION', name: 'Session limit' },
    { kind: 'week', label: 'WEEK', name: 'Weekly limit' }
  ];
  function limitStep(percent) {
    return percent >= 90 ? 'top' : (percent >= 70 ? 'high' : null);
  }
  function LimitMeters(props) {
    var given = props.limits || [];
    var meters = [];
    LIMITS.forEach(function (limit) {
      var found = null;
      given.forEach(function (meter) {
        if (meter && meter.kind === limit.kind) { found = meter; }
      });
      if (!found) { return; }
      var percent = Math.max(0, Math.min(100, Math.round(num(found.percent, 0))));
      var step = limitStep(percent);
      meters.push(h('span', {
        key: limit.kind,
        className: cx('pn-limit', step && 'pn-limit--' + step),
        role: 'img',
        'aria-label': limit.name + ', ' + percent + '% used'
      },
      h('span', { className: 'pn-ticker-lead' }, limit.label),
      h('span', { className: 'pn-limit-track' }, h('i', { className: 'pn-limit-fill', style: { width: percent + '%' } })),
      h('span', { className: 'pn-limit-figure' }, percent + '%')));
    });
    return meters.length ? h('div', { className: 'pn-board-limits' }, meters) : null;
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
      pageTab(view, 'pn-board-tab'),
      h(LimitMeters, { limits: props.limits || scene.limits }));
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
        h('div', { className: 'pn-l3-head' }, h('span', null, props.headline || ev.headline), h('i', { className: 'pn-l3-sweep', 'aria-hidden': 'true' }, h('i', { className: 'pn-l3-glint' })))),
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
  /* Motion on the compositor. An open or an outro draws every piece from one
     number, the run's progress from 0 to 1: `move(id, at)` names a piece and
     keeps `at`, its style at any progress. A still frame draws each piece at
     its progress. The moving version draws the last frame and hands each
     piece's whole run to the Web Animations API, as keyframes sampled from
     the same `at` 60 times a second, every stretch that runs in a straight
     line folded to its two ends. The system's compositor plays them at the
     display's own rate, however busy the page is: in Low Power Mode WebKit
     gives a page 30 frames a second and runs its timers late, and the opens
     stuttered while they drew themselves on a timer. Without the Web
     Animations API, or with reduced motion, the last frame stays. */
  var MOTION_RATE = 60;
  /* how far a sample may sit off a straight line and still be folded into it */
  var MOTION_EPSILON = 0.001;
  /* four decimals are finer than any screen shows, and keep every number in
     plain digits: a style parser may refuse 1e-7 */
  function round4(v) { return +v.toFixed(4); }
  var NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
  function numbersOf(style, names) {
    var out = [];
    names.forEach(function (name) {
      String(style[name]).replace(NUMBER, function (m) { out.push(parseFloat(m)); return m; });
    });
    return out;
  }
  function motionFrames(at, dur) {
    var n = Math.max(1, Math.round(dur * MOTION_RATE));
    var frames = [];
    for (var i = 0; i <= n; i++) {
      var style = at(i / n);
      var frame = { offset: i / n };
      for (var name in style) {
        if (Object.prototype.hasOwnProperty.call(style, name)) { frame[name] = style[name]; }
      }
      frames.push(frame);
    }
    var names = Object.keys(frames[0]).filter(function (key) { return key !== 'offset'; });
    var values = frames.map(function (f) { return numbersOf(f, names); });
    /* a frame stays where the straight line from the last frame kept to the
       one after it misses a sample */
    var kept = [0];
    for (var k = 1; k < n; k++) {
      var a = kept[kept.length - 1];
      var b = k + 1;
      var straight = true;
      for (var j = a + 1; j < b && straight; j++) {
        var t = (j - a) / (b - a);
        for (var v = 0; v < values[j].length; v++) {
          var line = values[a][v] + (values[b][v] - values[a][v]) * t;
          if (Math.abs(values[j][v] - line) > MOTION_EPSILON) { straight = false; break; }
        }
      }
      if (!straight) { kept.push(k); }
    }
    kept.push(n);
    return kept.map(function (i) { return frames[i]; });
  }
  /* `run` names the run, so new words or another hour start it again */
  function useMotion(animate, dur, run) {
    var ref = useRef(null);
    var moves = {};
    var latest = useRef(moves);
    latest.current = moves;
    useLayoutEffect(function () {
      var root = ref.current;
      if (!animate || !root || typeof root.animate !== 'function') { return undefined; }
      var pieces = Array.prototype.slice.call(root.querySelectorAll('[data-pn-move]'));
      if (root.hasAttribute('data-pn-move')) { pieces.unshift(root); }
      var running = [];
      pieces.forEach(function (el) {
        var at = latest.current[el.getAttribute('data-pn-move')];
        if (at) { running.push(el.animate(motionFrames(at, dur), { duration: dur * 1000, fill: 'both' })); }
      });
      return function () { running.forEach(function (anim) { anim.cancel(); }); };
    }, [animate, dur, run]);
    return {
      ref: ref,
      move: function (id, at) { moves[id] = at; return id; }
    };
  }

  /* `back`: the outro's wave, sweeping back from the right and leaving the
     panes it passes dark. The same rule draws both: a pane glows once the
     intro's wave has passed it, until the outro's wave passes it again.
     `wave` turns the run's progress into the wave's. */
  function glassWall(p, back, wave, move) {
    return [
      h('div', { key: 'wall', className: 'pn-stinger-wall', 'aria-hidden': 'true' },
        PANES.map(function (g, i) {
          var at = function (x) {
            var front = back ? 1450 - 1700 * wave(x) : -250 + 1700 * wave(x);
            var lit = clamp01(1 - Math.abs(g.d - front) / 260);
            var settled = g.d < front ? 0.08 + 0.3 * g.v : 0.04;
            return { opacity: round4(Math.max(0.75 * lit, settled)) };
          };
          return h('div', { key: i, className: 'pn-stinger-pane', 'data-pn-move': move('pane-' + i, at), style: { left: g.x + 'px', top: g.y + 'px', opacity: at(p).opacity } });
        })),
      h('div', { key: 'glass', className: 'pn-stinger-glass' })
    ];
  }

  /* One line of chrome words: the outline underneath, hidden from VoiceOver,
     the chrome on top, and the glint, which crosses the chrome (0 to 1). The
     glint is a window that slides across the line while the bright copy of
     the word inside it slides back the same distance, so the word stays put
     and only the light moves. */
  function chromeLine(word, className, p, lineAt, glintAt, move) {
    function windowAt(x) { return { transform: 'translateX(' + round4(-163 + 320 * glintAt(x)) + '%)' }; }
    function copyAt(x) { return { transform: 'translateX(' + round4(163 - 320 * glintAt(x)) + '%)' }; }
    return h('div', { key: word, className: className, 'data-pn-move': move('line-' + word, lineAt), style: lineAt(p) },
      h('div', { className: 'pn-stinger-cast' },
        h('span', { className: 'pn-stinger-ink', 'aria-hidden': 'true' }, word),
        h('span', { className: 'pn-stinger-face' }, word)),
      h('span', { className: 'pn-stinger-glint', 'aria-hidden': 'true', 'data-pn-move': move('glint-' + word, windowAt), style: windowAt(p) },
        h('span', { className: 'pn-stinger-shine', 'data-pn-move': move('shine-' + word, copyAt), style: copyAt(p) }, word)));
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
    var words = props.words || BREAKING.words;
    var motion = useMotion(animate, dur, (outro ? 'outro ' : 'intro ') + words.join(' '));
    var p = animate ? 1 : clamp01(num(props.progress, 1));
    if (outro) { return outroPicture(p, words, motion); }
    var lines = words.map(function (w, i) {
      return chromeLine(w, 'pn-stinger-line', p, function (x) {
        var s = easeOut(seg(x, 0.22 + 0.1 * i, 0.5 + 0.1 * i));
        return {
          opacity: round4(s),
          transform: 'translateX(' + round4((1 - s) * -140) + 'px) scale(' + round4(1.3 - 0.3 * s) + ')'
        };
      }, function (x) { return seg(x, 0.6, 0.92); }, motion.move);
    });
    return h('div', { ref: motion.ref, className: 'pn-stinger pn-k-breaking' },
      glassWall(p, false, function (x) { return x; }, motion.move),
      h('div', { className: 'pn-stinger-words' }, lines));
  }

  /* The outro is the intro's last picture, run out: a glint crosses the
     words (0-30%), the words leave to the right one after the other (10-57%),
     the red wave sweeps back across the wall and darkens it (0-75%), and the
     whole open fades away to the board underneath (70-100%). */
  function outroPicture(p, words, motion) {
    var lines = words.map(function (w, i) {
      return chromeLine(w, 'pn-stinger-line', p, function (x) {
        var s = easeInOut(seg(x, 0.1 + 0.12 * i, 0.45 + 0.12 * i));
        return {
          opacity: round4(1 - s),
          transform: 'translateX(' + round4(s * 180) + 'px) scale(' + round4(1 + 0.25 * s) + ')'
        };
      }, function (x) { return seg(x, 0, 0.3); }, motion.move);
    });
    function fadeAt(x) { return { opacity: round4(1 - easeInOut(seg(x, 0.7, 1))) }; }
    return h('div', { ref: motion.ref, className: 'pn-stinger pn-k-breaking', 'data-pn-move': motion.move('open', fadeAt), style: fadeAt(p) },
      glassWall(p, true, function (x) { return seg(x, 0, 0.75); }, motion.move),
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

  /* The station clock, drawn in the ident's 360 x 360 box. `time(x)` is the
     moment at the run's progress x, in seconds from the hour: -5 at the first
     pip, 0 on the hour, 2.5 when the ident ends; `prev` is the minute before
     the hour, and `x` the progress drawn. The monitor's chrome bezel round a
     glossy blue face, gold bars for the hours, chrome hands, a gold seconds
     hand and the mark. The seconds hand steps with each pip; on the long pip
     the minute hand jumps to the hour and a glint crosses the face. */
  function stationClock(c) {
    var hm = hoursMinutes(c.prev);
    function jump(x) { var t = c.time(x); return t < 0 ? 0 : tickEase(t); }
    /* counted on from the minute before, so the hand turns on through the
       hour and never back round the dial */
    function seconds(x) {
      var sec = 60 + c.time(x);
      var whole = Math.floor(sec);
      return (whole - 1 + tickEase(sec - whole)) * 6;
    }
    function turn(angle) { return function (x) { return { transform: 'rotate(' + round4(angle(x)) + 'deg)' }; }; }
    var hourAt = turn(function (x) { return ((hm[0] % 12) + (hm[1] + jump(x)) / 60) * 30; });
    var minuteAt = turn(function (x) { return (hm[1] + jump(x)) * 6; });
    var secondAt = turn(seconds);
    /* the glint starts off the face's left edge (-30%) and crosses 160% of
       the 336 px face */
    function glintAt(x) {
      var t = c.time(x);
      var g = t < 0 ? 0 : seg(t, 0.02, 0.55);
      return { transform: 'translateX(' + round4(537.6 * g) + 'px) skewX(-20deg)' };
    }
    var marks = [];
    for (var i = 0; i < 60; i++) {
      marks.push(h('i', { key: i, className: i % 5 === 0 ? 'pn-dial-hour' : 'pn-dial-min', style: { transform: 'rotate(' + i * 6 + 'deg)' } }));
    }
    function piece(cls, id, at) { return h('i', { className: cls, 'data-pn-move': c.move(id, at), style: at(c.x) }); }
    return h('div', { className: 'pn-dial', 'aria-hidden': 'true' },
      h('div', { className: 'pn-dial-face' },
        marks,
        h('div', { className: 'pn-dial-mark pn-chrome' }, 'KLWD'),
        piece('pn-dial-hand pn-dial-hand--h', 'hour-hand', hourAt),
        piece('pn-dial-hand pn-dial-hand--m', 'minute-hand', minuteAt),
        piece('pn-dial-sec', 'second-hand', secondAt),
        h('i', { className: 'pn-dial-cap' }),
        piece('pn-dial-glint', 'dial-glint', glintAt)));
  }

  /* `outro`: the ident's last picture, run out over 1.4 s. A glint crosses
     the words (0-30%), the words leave to the right one after the other
     (15-62%), the clock drops back and fades (40-72%), and the ident fades
     to the board underneath (70-100%). */
  function Ident(props) {
    var outro = bool(props.outro, false);
    var animate = bool(props.animate, false) && !reducedMotion();
    var dur = num(props.duration, outro ? EVENTS.hourly.outro : EVENTS.hourly.ident);
    var hour = props.hour || '15:00';
    var words = props.words || EVENTS.hourly.words;
    var motion = useMotion(animate, dur, (outro ? 'outro ' : 'intro ') + hour + ' ' + words.join(' '));
    var q = animate ? 1 : clamp01(num(props.progress, 1));
    /* the run's progress x as the intro's p, or as the outro's o with p at its end */
    function P(x) { return outro ? 1 : x; }
    function O(x) { return outro ? x : 0; }
    var struck = P(q) >= STRIKE;
    var now = struck ? 60 : Math.floor(55 + 5 * P(q) / STRIKE);
    function glintAt(x) { return outro ? seg(O(x), 0, 0.3) : seg(P(x), 0.88, 1); }
    var lines = words.map(function (w, i) {
      return chromeLine(w, 'pn-stinger-line pn-ident-line', q, function (x) {
        var s = easeOut(seg(P(x), STRIKE + 0.04 + 0.06 * i, STRIKE + 0.16 + 0.06 * i));
        var leave = outro ? easeInOut(seg(O(x), 0.15 + 0.12 * i, 0.5 + 0.12 * i)) : 0;
        return {
          opacity: round4(s * (1 - leave)),
          transform: 'translateX(' + round4((1 - s) * 160 + leave * 180) + 'px) scale(' + round4(1.3 - 0.3 * s + 0.25 * leave) + ')'
        };
      }, glintAt, motion.move);
    });
    /* the clock and the words share the frame's centre line */
    function clockAt(x) {
      var aside = easeInOut(seg(P(x), STRIKE + 0.01, STRIKE + 0.16));
      var drop = outro ? easeInOut(seg(O(x), 0.4, 0.72)) : 0;
      var sc = (1 - 0.2 * aside) * (1 - 0.3 * drop);
      return {
        opacity: round4(1 - drop),
        transform: 'translate(' + round4(480 - 230 * aside) + 'px, 268px) scale(' + round4(sc) + ')'
      };
    }
    /* the rays turn as one piece about the frame's centre */
    function raysAt(x) { return { transform: 'rotate(' + round4(P(x) * 30 + O(x) * 12) + 'deg)' }; }
    function fadeAt(x) { return { opacity: round4(1 - easeInOut(seg(O(x), 0.7, 1))) }; }
    var clock = stationClock({ prev: minuteBefore(hour), time: function (x) { return (P(x) - STRIKE) * EVENTS.hourly.ident; }, x: q, move: motion.move });
    return h('div', { ref: motion.ref, className: cx('pn-ident', 'pn-k-hourly'), 'data-pn-move': outro ? motion.move('open', fadeAt) : undefined, style: outro ? fadeAt(q) : undefined },
      h('div', { className: 'pn-ident-rays', 'data-pn-move': motion.move('rays', raysAt), style: raysAt(q) }),
      h('div', {
        className: 'pn-ident-clock',
        role: 'img',
        'aria-label': struck ? 'The station clock at ' + hour : 'The station clock, ' + (60 - now) + ' seconds to ' + hour,
        'data-pn-move': motion.move('clock', clockAt),
        style: clockAt(q)
      }, clock),
      h('div', { className: 'pn-ident-words' }, lines));
  }

  /* THE HOUR IN REVIEW: what each session did this hour, a row each, read
     as the session's row on the board: its project on the listing's plate,
     its title over one detail, and its state pill, four rows a page (Pages,
     above). A row with no title names its project on the title's line,
     with no plate. Rows keep the listing's order. `animate` turns the
     pages; without it the review holds its first page. `sample` takes the
     rows and the span from a scene. */
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
          r.name && r.project ? h('span', { key: 'project', className: 'pn-row-project' }, h('span', null, r.project)) : null,
          h('div', { key: 'body', className: 'pn-review-body' },
            h('div', { className: 'pn-review-name' }, r.name || r.project),
            r.detail ? h('div', { className: 'pn-review-meta' }, r.detail) : null),
          h(StatePill, { key: 'pill', state: st })
        ];
      })),
      pageTab(view, 'pn-review-tab'));
  }

  /* ------------------------------------------------------------------
     KLWD WEATHER: the weekly forecast, a 90s local weather segment drawn
     from a WeatherScene (index.d.ts). CURRENT CONDITIONS and EXTENDED
     FORECAST are pages of the report on the hour; STORM WARNING is its
     own segment, WEATHER ALERT's open and STORMTRACKER, a storm on its
     track in WebGL. The icons are drawn here, in the station's chrome and
     gold, as markup, so the crawl can carry one too.
     ------------------------------------------------------------------ */
  /* The words of the pages, as packages/contract/src/copy.ts has them: a
     test holds the two together */
  var WEATHER = {
    now: 'CURRENT CONDITIONS',
    days: 'EXTENDED FORECAST',
    tracker: 'STORMTRACKER',
    week: 'THE WEEK',
    arrival: 'TIME OF ARRIVAL',
    start: 'NOW',
    out: 'OUT',
    alert: ['WEATHER', 'ALERT']
  };
  /* The outlook on the strap's tag: its words and its colour. READY's green
     for clear skies, the station's gold for clouds, BREAKING's red for a storm. */
  var OUTLOOKS = {
    clear: { word: 'CLEAR SKIES', k: 'pn-k-ready' },
    clouds: { word: 'CLOUDS GATHERING', k: 'pn-k-working' },
    storm: { word: 'STORM WARNING', k: 'pn-k-breaking' }
  };
  var SKY_WORDS = { sun: 'Sunny', partly: 'Partly cloudy', overcast: 'Overcast', storm: 'Storms' };

  function skyStop(offset, name, hex, opacity) {
    return '<stop offset="' + offset + '" style="stop-color: var(--' + name + ', ' + hex + ');' + (opacity === undefined ? '' : ' stop-opacity: ' + opacity + ';') + '"></stop>';
  }
  /* The gradients an icon is filled with. Each icon has its own, ending in
     `uid`, so that two icons on a page never share a url(#...) */
  function skyDefs(uid) {
    return '<defs>' +
      '<radialGradient id="pn-wx-sun-g-' + uid + '" cx="0.42" cy="0.38" r="0.7">' + skyStop(0, 'gold-hi', '#ffe08a') + skyStop(0.55, 'gold', '#f2b630') + skyStop(1, 'gold-lo', '#b97d0c') + '</radialGradient>' +
      '<linearGradient id="pn-wx-ray-g-' + uid + '" x1="0" y1="0" x2="0" y2="1">' + skyStop(0, 'gold-hi', '#ffe08a') + skyStop(1, 'gold', '#f2b630') + '</linearGradient>' +
      '<linearGradient id="pn-wx-cloud-g-' + uid + '" gradientUnits="userSpaceOnUse" x1="0" y1="22" x2="0" y2="86">' + skyStop(0, 'chrome-hi', '#ffffff') + skyStop(0.55, 'chrome', '#c9d3e3') + skyStop(1, 'chrome-lo', '#7f90b3') + '</linearGradient>' +
      '<linearGradient id="pn-wx-cloud-d-' + uid + '" gradientUnits="userSpaceOnUse" x1="0" y1="22" x2="0" y2="86">' + skyStop(0, 'chrome-lo', '#7f90b3') + skyStop(1, 'morning-tower', '#4a5878') + '</linearGradient>' +
      '<linearGradient id="pn-wx-bolt-g-' + uid + '" x1="0" y1="0" x2="0" y2="1">' + skyStop(0, 'gold-hi', '#ffe08a') + skyStop(0.5, 'gold', '#f2b630') + skyStop(1, 'gold-lo', '#b97d0c') + '</linearGradient>' +
      '</defs>';
  }
  function tenth(n) { return Math.round(n * 10) / 10; }
  /* The sun: ten rays round a disc, with a highlight */
  function skySun(uid) {
    var rays = '';
    for (var k = 0; k < 10; k++) {
      var a = (k * 36 - 90) * Math.PI / 180;
      var tip = [60 + 47 * Math.cos(a), 50 + 47 * Math.sin(a)];
      var n = [Math.cos(a + Math.PI / 2), Math.sin(a + Math.PI / 2)];
      var base = [60 + 31 * Math.cos(a), 50 + 31 * Math.sin(a)];
      var p1 = [base[0] + 7 * n[0], base[1] + 7 * n[1]];
      var p2 = [base[0] - 7 * n[0], base[1] - 7 * n[1]];
      rays += '<polygon points="' + tenth(tip[0]) + ',' + tenth(tip[1]) + ' ' + tenth(p1[0]) + ',' + tenth(p1[1]) + ' ' + tenth(p2[0]) + ',' + tenth(p2[1]) + '" fill="url(#pn-wx-ray-g-' + uid + ')" style="stroke: var(--gold-lo, #b97d0c); stroke-width: 2; stroke-linejoin: round;"></polygon>';
    }
    return rays + '<circle cx="60" cy="50" r="27" fill="url(#pn-wx-sun-g-' + uid + ')" style="stroke: var(--gold-lo, #b97d0c); stroke-width: 2.5;"></circle><ellipse cx="51" cy="39" rx="12" ry="7" style="fill: var(--chrome-hi, #ffffff); opacity: 0.6;"></ellipse>';
  }
  /* A cloud: four shapes drawn twice, the rim underneath and the fill over it; the dark one is a storm cloud */
  function skyCloud(dark, uid) {
    function shapes(attrs) {
      return '<circle cx="40" cy="60" r="18" ' + attrs + '></circle><circle cx="62" cy="46" r="25" ' + attrs + '></circle><circle cx="86" cy="60" r="17" ' + attrs + '></circle><rect x="24" y="58" width="80" height="26" rx="13" ' + attrs + '></rect>';
    }
    var rim = dark ? 'var(--chrome, #c9d3e3)' : 'var(--chrome-lo, #7f90b3)';
    return shapes('style="fill: ' + rim + '; stroke: ' + rim + '; stroke-width: 7;"') +
      shapes('fill="url(#pn-wx-' + (dark ? 'cloud-d' : 'cloud-g') + '-' + uid + ')"') +
      '<ellipse cx="57" cy="34" rx="15" ry="6" style="fill: var(--chrome-hi, #ffffff); opacity: ' + (dark ? 0.3 : 0.7) + ';"></ellipse>';
  }
  function skyBolt(uid) {
    return '<polygon points="66,52 46,80 59,80 50,102 82,68 67,68 76,52" fill="url(#pn-wx-bolt-g-' + uid + ')" style="stroke: var(--on-gold, #2a1800); stroke-width: 2.5; stroke-linejoin: round;"></polygon>';
  }
  /* What an icon draws: the sun, the sun behind a cloud, two clouds, a storm
     cloud over a bolt. `boltClass` puts the bolt in a group of its own, for
     WEATHER ALERT's flashes. */
  function skyShapes(sky, uid, boltClass) {
    if (sky === 'partly') { return '<g transform="translate(-6 -6) scale(0.8)">' + skySun(uid) + '</g><g transform="translate(16 16) scale(0.84)">' + skyCloud(false, uid) + '</g>'; }
    if (sky === 'overcast') { return '<g transform="translate(-12 -10) scale(0.86)">' + skyCloud(true, uid) + '</g><g transform="translate(14 12) scale(0.86)">' + skyCloud(false, uid) + '</g>'; }
    if (sky === 'storm') { return (boltClass ? '<g class="' + boltClass + '">' + skyBolt(uid) + '</g>' : skyBolt(uid)) + '<g transform="translate(0 -12)">' + skyCloud(true, uid) + '</g>'; }
    return skySun(uid);
  }
  var wxSeq = 0;
  function nextWx() { wxSeq += 1; return wxSeq; }
  /* An icon as markup, for the crawl: `uid` ends its gradients' ids */
  function weatherIconMarkup(sky, uid) {
    var kind = SKY_WORDS[sky] ? sky : 'sun';
    return '<svg class="pn-wx-icon" viewBox="0 0 120 100" role="img" aria-label="' + SKY_WORDS[kind] + '">' + skyDefs(uid) + skyShapes(kind, uid) + '</svg>';
  }
  /* A sky's icon. `size` is its width in px; with none, the page's style
     sizes it. `bolt` names the group the bolt is drawn in, for WEATHER ALERT. */
  function WeatherIcon(props) {
    var uid = useState(nextWx)[0];
    var sky = SKY_WORDS[props.sky] ? props.sky : 'sun';
    var size = num(props.size, 0);
    return h('svg', {
      className: cx('pn-wx-icon', props.className),
      viewBox: '0 0 120 100',
      role: 'img',
      'aria-label': SKY_WORDS[sky],
      style: size ? { width: size + 'px', height: (size * 100 / 120) + 'px' } : undefined,
      dangerouslySetInnerHTML: { __html: skyDefs(uid) + skyShapes(sky, uid, props.bolt) }
    });
  }

  /* The weather wall: the wall monitor made big, with its head bar. `k` is
     the page's colour, gold for the weather and red for a warning. */
  function weatherWall(k, head, until, content) {
    return h('div', { className: cx('pn-wx-wall', k) },
      h.apply(null, ['div', { className: 'pn-wx-screen' },
        h('div', { className: 'pn-wx-head' }, h('span', null, head), until ? h('small', null, until) : null)].concat(content)));
  }
  function noMove() { return undefined; }
  /* Chrome lettering at rest, as the stinger's words end: the same line, with
     its glint off to the side */
  function chromeStill(word, className) {
    return chromeLine(word, className, 1, function () { return {}; }, function () { return 1; }, noMove);
  }

  /* CURRENT CONDITIONS: what the weathercaster says "right now" over. The
     sky, the week's share used as the temperature in chrome lettering, and
     the outlook in words. */
  function WeatherNow(props) {
    var wx = props.weather || SAMPLES['weather-now'].weather;
    return weatherWall('pn-k-hourly', WEATHER.now, null, [
      h('div', { key: 'now', className: 'pn-wx-now' },
        h(WeatherIcon, { sky: wx.sky, className: 'pn-wx-now-sky' }),
        h('div', { className: 'pn-wx-now-read' },
          h('span', { className: 'pn-wx-now-cap' }, WEATHER.week),
          chromeStill(wx.used, 'pn-stinger-line pn-wx-now-temp'),
          h('span', { className: 'pn-wx-now-word' }, wx.word)))
    ]);
  }

  /* EXTENDED FORECAST: a panel a day from today to the reset's day, the sky
     of the day's high with the high and the low, and under them the verdict
     on a tag in the outlook's colour. */
  function WeatherDays(props) {
    var wx = props.weather || SAMPLES['weather-days'].weather;
    var days = wx.days || [];
    var outlook = OUTLOOKS[wx.outlook] || OUTLOOKS.clear;
    return weatherWall('pn-k-hourly', WEATHER.days, wx.until, [
      h('div', { key: 'days', className: cx('pn-wx-days', days.length > 5 && 'pn-wx-days--7') },
        days.map(function (d, i) {
          return h('div', { key: i, className: cx('pn-wx-day', d.out && 'pn-wx-out') },
            h('span', { className: 'pn-wx-day-name' }, d.name),
            h(WeatherIcon, { sky: d.sky }),
            h('span', { className: 'pn-wx-hi' }, d.high),
            h('span', { className: 'pn-wx-lo' }, d.low));
        })),
      h('div', { key: 'strip', className: 'pn-wx-strip' },
        h('span', { className: cx('pn-wx-tag', outlook.k) }, h('span', null, wx.word || outlook.word)),
        h('span', null, wx.strap))
    ]);
  }

  /* STORMTRACKER's globe. A 90s station's storm tracker in WebGL 2, drawn
     straight onto the canvas with no library, the week's usage as the storm.

     What the period footage shows, and this follows: the earth from orbit,
     lit, with its atmosphere glowing at the limb and satellite clouds over
     it; the camera dives down to a low, oblique view of a region where the
     horizon still curves; satellite clouds drift with their shadows moving
     on the land and sea; a storm, its clouds standing up in 3D, comes in
     from the left and grows as it goes, toward the coast it will hit; its
     track is drawn ahead of it, and a TIME OF ARRIVAL list says when.

     The storm forms over the western Gulf at NOW and moves east, faster as
     it goes, growing, its core colouring as it strengthens (as a colourised
     satellite picture shows a storm's tops), leaving its rain behind. The
     track's marks come up as it passes each day's close the week reaches
     before it runs out. Landfall on Florida's Gulf coast is where the week
     runs out: lightning, OUT.

     One timeline, 13 s: 0-2.6 s the dive from orbit, 2.6-9 s the storm on
     its track, 9-13 s landfall, the storm turning on over the coast with its
     OUT tag up. stormScene(root, options) draws into the
     canvas in `root`, and places the elements in it that have data-at and
     data-row from the scene's camera. `options.marks` are the TrackMarks
     (`at` is how far along the track), `options.textures` the folder of the
     four pictures, and `options.hold` the moment of the timeline to draw
     once, or null to run it once from now and keep its last picture. It
     returns { dispose, ready }, or null when there is no graphics context;
     `ready` comes once a held moment has been drawn, or the scene is given up.
     When a picture cannot be uploaded or the scene cannot be drawn it gives the
     scene up and calls `options.onFail`, once. Colours are read from the
     station's tokens on `root`.

     How the picture is made. The scene is a short list of things drawn in a
     fixed order each frame, with a few lights, in linear colour that is
     turned to the screen's sRGB on the way out (so a colour given as
     #rrggbb is used as it stands, then encoded, which is what makes the
     palette read as it does). This is our code, written from the published
     math: Blinn, Phong, Cook and Torrance and Schlick for the highlight,
     Epic's 2013 form of Schlick's Fresnel, Mikkelsen's bump mapping from
     derivatives (2010), the sRGB curve of IEC 61966-2-1, and the usual
     projection and rotation matrices. Its pictures were checked against the
     ones three.js r149 drew of this scene, and match to within a level, so
     what the lighting, the texture settings, the order things are drawn and
     blended in, and the camera's numbers do is what the scene looked like
     before. */
  var stormScene = (function () {
    var DUR = 13, T_DIVE = 2.6, T_LAND = 9.0;
    var START = [25.4, -95.4], END = [27.95, -82.75];
    var NEAR = 0.001, FAR = 200, FOV = 38, RATIO = 2;
    var CLEAR = [1 / 255, 3 / 255, 10 / 255];

    function rad(d) { return d * Math.PI / 180; }
    function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
    function smooth(x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); }

    /* Vectors are [x, y, z], quaternions [x, y, z, w] and matrices sixteen
       numbers, one column after another, as WebGL takes them. */
    function vAdd(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function vSub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function vMul(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
    function vDot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function vCross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
    function vLen(a) { return Math.sqrt(vDot(a, a)); }
    function vUnit(a) { return vMul(a, 1 / (vLen(a) || 1)); }
    function vLerp(a, b, f) { return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
    /* the part of `a` that lies in the plane whose normal is `n` */
    function vAcross(a, n) { var d = vDot(n, n); return d === 0 ? [0, 0, 0] : vSub(a, vMul(n, vDot(n, a) / d)); }

    function qAboutY(angle) { return [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)]; }
    function qAboutZ(angle) { return [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)]; }
    function qConjugate(q) { return [-q[0], -q[1], -q[2], q[3]]; }
    /* the turn that takes the unit vector `a` to the unit vector `b` */
    function qBetween(a, b) {
      var across = vCross(a, b), cosPlusOne = vDot(a, b) + 1, q;
      if (cosPlusOne < 1e-8) {
        // opposite: half a turn about any axis that lies across `a`
        var axis = vUnit(vCross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]));
        q = [axis[0], axis[1], axis[2], 0];
      } else {
        q = [across[0], across[1], across[2], cosPlusOne];
      }
      var l = Math.sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]) || 1;
      return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
    }
    /* `v` turned by the unit quaternion `q`: v + w t + u x t, where u is the quaternion's axis part and t is twice u x v */
    function qRotate(q, v) {
      var u = [q[0], q[1], q[2]];
      var t = vMul(vCross(u, v), 2);
      return vAdd(vAdd(v, vMul(t, q[3])), vCross(u, t));
    }

    /* a place, a turn and a size, as a matrix: the turn's rotation matrix with each column made as long as its size */
    function mFrom(p, q, s) {
      var x = q[0], y = q[1], z = q[2], w = q[3];
      var xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
      return [
        (1 - 2 * (yy + zz)) * s[0], 2 * (xy + wz) * s[0], 2 * (xz - wy) * s[0], 0,
        2 * (xy - wz) * s[1], (1 - 2 * (xx + zz)) * s[1], 2 * (yz + wx) * s[1], 0,
        2 * (xz + wy) * s[2], 2 * (yz - wx) * s[2], (1 - 2 * (xx + yy)) * s[2], 0,
        p[0], p[1], p[2], 1
      ];
    }
    function mMul(a, b) {
      var out = new Array(16), c, r, k, sum;
      for (c = 0; c < 4; c++) {
        for (r = 0; r < 4; r++) {
          sum = 0;
          for (k = 0; k < 4; k++) { sum += a[k * 4 + r] * b[c * 4 + k]; }
          out[c * 4 + r] = sum;
        }
      }
      return out;
    }
    /* the inverse of a matrix that is only a turn and a move, as the camera's */
    function mInverseRigid(m) {
      var t = [m[12], m[13], m[14]];
      return [
        m[0], m[4], m[8], 0,
        m[1], m[5], m[9], 0,
        m[2], m[6], m[10], 0,
        -(m[0] * t[0] + m[1] * t[1] + m[2] * t[2]), -(m[4] * t[0] + m[5] * t[1] + m[6] * t[2]), -(m[8] * t[0] + m[9] * t[1] + m[10] * t[2]), 1
      ];
    }
    /* the camera's place in the world, looking from `eye` at `target` with `up` as its up: its axes are
       sideways, up and back (from the target to the eye), and it stands at `eye` */
    function mLookFrom(eye, target, up) {
      var back = vSub(eye, target);
      back = vDot(back, back) === 0 ? [0, 0, 1] : vUnit(back);
      var side = vCross(up, back);
      if (vDot(side, side) === 0) {
        // up lies along the way it looks: any sideways will do
        side = vCross(Math.abs(back[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], back);
      }
      side = vUnit(side);
      var over = vCross(back, side);
      return [side[0], side[1], side[2], 0, over[0], over[1], over[2], 0, back[0], back[1], back[2], 0, eye[0], eye[1], eye[2], 1];
    }
    /* the lens: `fov` degrees from the top of the picture to the bottom, `aspect` wide for its height */
    function mPerspective(fov, aspect, near, far) {
      var top = near * Math.tan(rad(fov) * 0.5), height = 2 * top, width = aspect * height, left = -0.5 * width;
      var scaleX = 2 * near / width, scaleY = 2 * near / height;
      var shiftX = (2 * left + width) / width, shiftY = (top + (top - height)) / height;
      var depthScale = -(far + near) / (far - near), depthShift = -2 * far * near / (far - near);
      return [scaleX, 0, 0, 0, 0, scaleY, 0, 0, shiftX, shiftY, depthScale, -1, 0, 0, depthShift, 0];
    }
    /* the point `v` taken through a matrix, and divided by its w */
    function mPoint(m, v) {
      var x = v[0], y = v[1], z = v[2];
      var hx = m[0] * x + m[4] * y + m[8] * z + m[12];
      var hy = m[1] * x + m[5] * y + m[9] * z + m[13];
      var hz = m[2] * x + m[6] * y + m[10] * z + m[14];
      var hw = m[3] * x + m[7] * y + m[11] * z + m[15];
      return [hx / hw, hy / hw, hz / hw];
    }
    /* a direction through the turn part of a matrix, made a unit again */
    function mDirection(m, v) {
      return vUnit([m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]]);
    }
    /* what turns a surface's normal into the view's: the inverse transpose of a matrix's upper 3 x 3, which is its
       cofactors over its determinant, laid out column by column */
    function mNormal(m) {
      var a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
      var c00 = e * i - f * h, c01 = f * g - d * i, c02 = d * h - e * g;
      var c10 = c * h - b * i, c11 = a * i - c * g, c12 = b * g - a * h;
      var c20 = b * f - c * e, c21 = c * d - a * f, c22 = a * e - b * d;
      var det = a * c00 + b * c01 + c * c02;
      var k = det === 0 ? 0 : 1 / det;
      return [c00 * k, c10 * k, c20 * k, c01 * k, c11 * k, c21 * k, c02 * k, c12 * k, c22 * k];
    }

    function geo(lat, lon, r) {
      var p = rad(lon + 180), t = rad(90 - lat);
      return [-r * Math.sin(t) * Math.cos(p), r * Math.cos(t), r * Math.sin(t) * Math.sin(p)];
    }
    function trackLatLon(s) {
      return [START[0] + (END[0] - START[0]) * s + Math.sin(s * Math.PI) * 1.4, START[1] + (END[1] - START[1]) * s];
    }
    function trackAt(s, r) { var ll = trackLatLon(s); return geo(ll[0], ll[1], r); }
    // The storm's progress along its track at time t: faster as it goes
    function progress(t) { var u = clamp((t - T_DIVE) / (T_LAND - T_DIVE), 0, 1); return Math.pow(u, 1.6); }

    /* A colour given as the station's tokens give them (#rgb or #rrggbb, or
       rgb(r, g, b)), as [r, g, b] from 0 to 1; the fallback when it is
       none of those. */
    function parseColor(value) {
      var text = String(value || '').trim(), m;
      m = /^#([0-9a-f]{6})$/i.exec(text);
      if (m) {
        var n = parseInt(m[1], 16);
        return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
      }
      m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(text);
      if (m) { return [parseInt(m[1] + m[1], 16) / 255, parseInt(m[2] + m[2], 16) / 255, parseInt(m[3] + m[3], 16) / 255]; }
      m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(text);
      if (m) { return [Math.min(255, +m[1]) / 255, Math.min(255, +m[2]) / 255, Math.min(255, +m[3]) / 255]; }
      return null;
    }
    function colorOf(value, fallback) { return parseColor(value) || parseColor(fallback) || [1, 0, 1]; }
    function tokens(el) {
      var cs = getComputedStyle(el);
      function c(n, f) { return colorOf(cs.getPropertyValue('--' + n), f); }
      return {
        breaking: c('breaking', '#c4170e'), breakingHi: c('breaking-hi', '#ff5a4f'), gold: c('gold', '#f2b630'),
        goldHi: c('gold-hi', '#ffe08a'), ready: c('ready', '#2fb44a'), readyHi: c('ready-hi', '#8af59b'),
        glow: c('row-hi', '#5b8be8'), edge: c('bar-edge', '#8fb0ff'), deep: c('studio-deep', '#061233'), white: c('chrome-hi', '#ffffff')
      };
    }

    /* The camera: from orbit down to a low look north over the Gulf, then
       tightening on the storm and its landfall as it comes in. A pure
       function of the time: where it is, which way is up, and what it
       looks at. */
    function trackPose(s) {
      var ll = trackLatLon(s);
      var lookLat = ll[0] + (END[0] - ll[0]) * 0.45 + 1.0, lookLon = ll[1] + (END[1] - ll[1]) * 0.45;
      return { eye: geo(lookLat - 8.0 + 1.6 * s, lookLon - 0.3, 1.125 - 0.012 * s), look: geo(lookLat, lookLon, 1.0) };
    }
    var ORBIT = geo(24, -89, 3.25);
    var SETTLED = trackPose(0);
    var UP0 = [0, 1, 0];
    function cameraPose(t) {
      var pose = trackPose(progress(t)), eye = pose.eye, look = pose.look, up;
      if (t < T_DIVE) {
        // the dive: straight down onto the Gulf, slowing as it nears
        var f = smooth(t / T_DIVE);
        var dir = vUnit(vLerp(vUnit(ORBIT), vUnit(SETTLED.eye), f));
        var r = 3.25 + (vLen(SETTLED.eye) - 3.25) * (1 - Math.pow(1 - f, 2.6));
        eye = vMul(dir, r);
        look = vLerp([0, 0, 0], SETTLED.look, smooth(t / (T_DIVE * 0.7)));
        up = vUnit(vLerp(UP0, vUnit(SETTLED.eye), f));
      } else {
        up = vUnit(eye);
      }
      return { eye: eye, look: look, up: up };
    }
    /* The camera as matrices for a canvas `aspect` wide for its height: where it stands, its inverse and its lens */
    function viewOf(pose, aspect) {
      var world = mLookFrom(pose.eye, pose.look, pose.up);
      return { eye: pose.eye, world: world, inverse: mInverseRigid(world), projection: mPerspective(FOV, aspect, NEAR, FAR) };
    }
    /* Where a point of the world falls in a W x H canvas, in pixels from its top left, and whether the camera sees that side of the globe */
    function screenPoint(v, view, W, H) {
      var p = mPoint(view.projection, mPoint(view.inverse, v));
      var facing = vDot(vUnit(v), vUnit(vSub(view.eye, v))) > 0;
      return { x: (p[0] + 1) / 2 * W, y: (1 - p[1]) / 2 * H, on: p[2] < 1 && facing };
    }

    // Light from the south-east, the afternoon sun over the Atlantic
    var SUN = vUnit(vAdd(vUnit(geo(14, -70, 1)), [0, 0.25, 0]));

    /* Where the storm is and how it looks at time t: also pure. */
    function stormPose(t) {
      var s = progress(t);
      var k = 0.026 + 0.042 * Math.pow(s, 0.85);
      var n = vUnit(trackAt(s, 1.0));
      var turn = qBetween([0, 0, 1], n);
      var formed = smooth((t - T_DIVE + 0.5) / 1.0);
      // the shadow falls away from the sun across the sea
      var away = vMul(vUnit(vAcross(SUN, n)), -0.42);
      var shadow = qRotate(qConjugate(turn), away);
      shadow[2] = 0.0005;
      // landfall: lightning
      var lt = t - T_LAND;
      var flash = lt > 0 ? Math.max(0, Math.sin(lt * 23) * Math.sin(lt * 7.3)) * (lt < 1.8 ? 1 : 0) : 0;
      return {
        s: s, scale: k, position: vMul(n, 1.0008), turn: turn, spin: t * 0.5, formed: formed,
        shadow: shadow, flash: flash, landfall: lt
      };
    }

    /* The storm seen from above: spiral bands round a clear eye, drawn once */
    function spiralCanvas(size) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d');
      var cx = size / 2, rnd = seeded(41), S = size / 512;
      function blob(x, y, s, a) {
        var gr = g.createRadialGradient(x, y, 0, x, y, s);
        gr.addColorStop(0, 'rgba(255,255,255,' + a + ')');
        gr.addColorStop(0.6, 'rgba(255,255,255,' + (a * 0.5) + ')');
        gr.addColorStop(1, 'rgba(255,255,255,0)');
        g.fillStyle = gr;
        g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      }
      g.globalCompositeOperation = 'lighter';
      // the central dense overcast round the eye
      var i, k;
      for (i = 0; i < 260; i++) {
        var a0 = rnd() * Math.PI * 2, r0 = (0.07 + Math.pow(rnd(), 1.5) * 0.13) * size;
        blob(cx + Math.cos(a0) * r0, cx + Math.sin(a0) * r0, (14 + rnd() * 16) * S, 0.22);
      }
      // a thin veil of cloud between the bands
      for (i = 0; i < 160; i++) {
        var a1 = rnd() * Math.PI * 2, r1 = (0.16 + rnd() * 0.3) * size;
        blob(cx + Math.cos(a1) * r1, cx + Math.sin(a1) * r1, (22 + rnd() * 26) * S, 0.05);
      }
      // four rain bands, each leaving the core and curling out a little over
      // half a turn, wide where they leave and breaking up at their ends
      for (k = 0; k < 4; k++) {
        var off = k * Math.PI / 2 + 0.3;
        for (i = 0; i < 520; i++) {
          var t = i / 520;
          if (rnd() < Math.pow(t, 1.6) * 0.7) { continue; }
          var ang = off + t * 1.25 * Math.PI;
          var r = (0.17 + t * 0.32) * size;
          var w = (1 - t * 0.55) * 34 * S;
          var jit = (rnd() - 0.5) * w;
          blob(cx + Math.cos(ang) * (r + jit), cx + Math.sin(ang) * (r + jit), (8 + rnd() * 14) * S * (1 - t * 0.45), 0.13);
        }
      }
      // the eye, clear
      g.globalCompositeOperation = 'destination-out';
      var eg = g.createRadialGradient(cx, cx, 0, cx, cx, size * 0.055);
      eg.addColorStop(0, 'rgba(0,0,0,1)'); eg.addColorStop(0.7, 'rgba(0,0,0,0.9)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = eg; g.fillRect(0, 0, size, size);
      return c;
    }
    function dotCanvas(size, ring) {
      var c = document.createElement('canvas');
      c.width = c.height = size;
      var g = c.getContext('2d'), h = size / 2;
      g.fillStyle = '#ffffff';
      g.strokeStyle = ring ? '#ffffff' : '#061233';
      g.lineWidth = size * (ring ? 0.16 : 0.12);
      g.beginPath(); g.arc(h, h, h * 0.55, 0, Math.PI * 2);
      if (ring) { g.stroke(); } else { g.fill(); g.stroke(); }
      return c;
    }

    /* ---------------- The shapes ---------------- */

    /* A globe of `radius`: `down` bands of `across` quads each, from the north pole to the south. A point is
       [x, y, z] with its normal and the picture's [u, v], and the points are numbered ring by ring, a ring's
       first and last at the seam. The picture runs once round (u) and from the south pole up (v); at a pole,
       where the ring is a single point, its points are moved half a quad along so the picture does not pinch.
       Each quad is two triangles, counter-clockwise from outside, and the bands at the poles have only the
       triangle that is not flat. */
    function sphereShape(radius, across, down) {
      var columns = across + 1, rows = down + 1;
      // the angle round the axis for each column, the angle down from the north pole for each ring
      var round = [], polar = [], c, r;
      for (c = 0; c < columns; c++) { round.push({ cos: Math.cos(2 * Math.PI * c / across), sin: Math.sin(2 * Math.PI * c / across) }); }
      for (r = 0; r < rows; r++) { polar.push({ cos: Math.cos(Math.PI * r / down), sin: Math.sin(Math.PI * r / down) }); }
      var pos = [], nor = [], uvs = [], idx = [];
      for (r = 0; r < rows; r++) {
        var pole = r === 0 ? 0.5 : (r === down ? -0.5 : 0);
        for (c = 0; c < columns; c++) {
          // x runs against the angle's cosine, so the seam is at +x and the picture reads west to east
          var nx = -polar[r].sin * round[c].cos, ny = polar[r].cos, nz = polar[r].sin * round[c].sin;
          pos.push(radius * nx, radius * ny, radius * nz);
          nor.push(nx, ny, nz);
          uvs.push((c + pole) / across, 1 - r / down);
        }
      }
      for (r = 0; r < down; r++) {
        for (c = 0; c < across; c++) {
          var nw = r * columns + c, ne = nw + 1, sw = nw + columns, se = sw + 1;
          if (r > 0) { idx.push(nw, se, ne); }
          if (r < down - 1) { idx.push(sw, se, nw); }
        }
      }
      return { position: pos, normal: nor, uv: uvs, index: idx };
    }
    /* A flat sheet `w` x `h` about the origin facing +z, in across x down quads, its picture's top at +y */
    function sheetShape(w, h, across, down) {
      var pos = [], nor = [], uvs = [], idx = [], stride = across + 1, ix, iy;
      for (iy = 0; iy <= down; iy++) {
        for (ix = 0; ix <= across; ix++) {
          pos.push(ix * (w / across) - w / 2, h / 2 - iy * (h / down), 0);
          nor.push(0, 0, 1);
          uvs.push(ix / across, 1 - iy / down);
        }
      }
      for (iy = 0; iy < down; iy++) {
        for (ix = 0; ix < across; ix++) {
          var nw = ix + stride * iy, sw = nw + stride, ne = nw + 1, se = sw + 1;
          idx.push(nw, sw, ne, sw, se, ne);
        }
      }
      return { position: pos, normal: nor, uv: uvs, index: idx };
    }

    /* ---------------- The shaders (GLSL ES 3.00) ---------------- */

    var HEAD = '#version 300 es\nprecision highp float;\nprecision highp int;\nprecision highp sampler2D;\n';

    /* The colour on its way to the screen: linear light to sRGB, channel by channel, as IEC 61966-2-1 gives
       it: a straight line near black and a power of 1/2.4 above. */
    var TO_SCREEN = [
      'float encodeChannel(float c) {',
      '  return c <= 0.0031308 ? 12.92 * c : 1.055 * pow(c, 1.0 / 2.4) - 0.055;',
      '}',
      'vec3 toScreen(vec3 c) {',
      '  return vec3(encodeChannel(c.r), encodeChannel(c.g), encodeChannel(c.b));',
      '}'
    ].join('\n');

    /* Lit surfaces: the sun, the lightning's bolt (which reaches only so far
       and fades to nothing at its edge) and the ambient light, all with their
       colours already scaled by pi, which the 1/pi of a surface's diffuse
       cancels. */
    var LIGHTS = [
      'uniform vec3 ambientColor;',
      'uniform vec3 sunDirection;',
      'uniform vec3 sunColor;',
      'uniform vec3 boltPosition;',
      'uniform vec3 boltColor;',
      'const float PI = 3.141592653589793;',
      '// The bolt lights what is within 0.4 of it, less and less to nothing at that distance.',
      'const float BOLT_REACH = 0.4;',
      'const float BOLT_FADE = 2.0;',
      '// The highlight light from `toLight` makes, seen along `toEye`, off a surface facing `n` that reflects',
      '// `f0` of it head on: Cook and Torrance\'s DFG / (4 (n.l)(n.v)) with the half vector h = (l + v) / |l + v|',
      '// and the geometry term taken as (n.l)(n.v), which leaves D F / 4. D is Blinn\'s (n.h)^s, with the',
      '// (s + 2) / 2pi that keeps its energy whatever s is; F is Schlick\'s f0 + (1 - f0)(1 - v.h)^5, in the',
      '// form Epic gave at SIGGRAPH 2013 (2 to the power of a quadratic in v.h in place of the fifth power).',
      'vec3 highlight(vec3 toLight, vec3 toEye, vec3 n, vec3 f0, float shininess) {',
      '  vec3 h = normalize(toLight + toEye);',
      '  float vh = clamp(dot(toEye, h), 0.0, 1.0);',
      '  vec3 fresnel = f0 + (1.0 - f0) * exp2((-5.55473 * vh - 6.98316) * vh);',
      '  float spread = (shininess + 2.0) / (2.0 * PI) * pow(clamp(dot(n, h), 0.0, 1.0), shininess);',
      '  return fresnel * (0.25 * spread);',
      '}',
      '// The light on a surface at `pos` (in the view) facing `n`: what the sun and the bolt give it, then the ambient.',
      '// The colours of the lights are already multiplied by pi, which the 1/pi of the surface\'s diffuse cancels.',
      'vec3 lit(vec3 albedo, vec3 n, vec3 pos, float shininess, vec3 specular, float glossy) {',
      '  vec3 toEye = normalize(-pos);',
      '  vec3 diffuse = vec3(0.0);',
      '  vec3 shine = vec3(0.0);',
      '  vec3 toBolt = boltPosition - pos;',
      '  vec3 boltDir = normalize(toBolt);',
      '  float near = pow(max(1.0 - length(toBolt) / BOLT_REACH, 0.0), BOLT_FADE);',
      '  vec3 incoming = max(dot(n, boltDir), 0.0) * (boltColor * near);',
      '  diffuse += incoming * albedo / PI;',
      '  if (glossy > 0.0) { shine += incoming * highlight(boltDir, toEye, n, specular, shininess) * glossy; }',
      '  incoming = max(dot(n, sunDirection), 0.0) * sunColor;',
      '  diffuse += incoming * albedo / PI;',
      '  if (glossy > 0.0) { shine += incoming * highlight(sunDirection, toEye, n, specular, shininess) * glossy; }',
      '  return diffuse + ambientColor * albedo / PI + shine;',
      '}'
    ].join('\n');

    /* The earth (glossy, with bumps) and the clouds (matte): one vertex shader, two fragment ones */
    var LIT_VERTEX = HEAD + [
      'layout(location = 0) in vec3 position;',
      'layout(location = 1) in vec3 normal;',
      'layout(location = 2) in vec2 uv;',
      'uniform mat4 modelViewMatrix;',
      'uniform mat4 projectionMatrix;',
      'uniform mat3 normalMatrix;',
      'out vec2 vUv;',
      'out vec3 vNormal;',
      'out vec3 vViewPosition;',
      'void main() {',
      '  vUv = uv;',
      '  vNormal = normalize(normalMatrix * normal);',
      '  vec4 inView = modelViewMatrix * vec4(position, 1.0);',
      '  vViewPosition = -inView.xyz;',
      '  gl_Position = projectionMatrix * inView;',
      '}'
    ].join('\n');

    var EARTH_FRAGMENT = HEAD + [
      'uniform sampler2D map;',
      'uniform sampler2D bumpMap;',
      'uniform sampler2D specularMap;',
      'uniform float bumpScale;',
      'uniform vec3 specularColor;',
      'uniform float shininess;',
      LIGHTS,
      TO_SCREEN,
      'in vec2 vUv;',
      'in vec3 vNormal;',
      'in vec3 vViewPosition;',
      'out vec4 outColor;',
      '// Bump mapping from the screen\'s derivatives, after Morten Mikkelsen, "Bump Mapping Unparametrized',
      '// Surfaces on the GPU" (2010). The surface is taken as parametrized by the screen\'s x and y: px and py',
      '// are how the position changes one pixel along each, so a height h(x, y) on it has the surface',
      '// gradient (dh/dx (py x n) + dh/dy (n x px)) / (px . (py x n)), and the bumped normal leans against it.',
      'float heightAt(vec2 at) { return bumpScale * texture(bumpMap, at).x; }',
      'vec3 bumpedNormal(vec3 n, vec3 pos) {',
      '  // dh/dx and dh/dy by forward differences, one pixel over along each screen axis in the map',
      '  float h = heightAt(vUv);',
      '  float dhdx = heightAt(vUv + dFdx(vUv)) - h;',
      '  float dhdy = heightAt(vUv + dFdy(vUv)) - h;',
      '  vec3 px = dFdx(pos);',
      '  vec3 py = dFdy(pos);',
      '  vec3 ex = cross(py, n);',
      '  vec3 ey = cross(n, px);',
      '  vec3 gradient = (dhdx * ex + dhdy * ey) / dot(px, ex);',
      '  return normalize(n - gradient);',
      '}',
      'void main() {',
      '  vec4 surface = texture(map, vUv);',
      '  float glossy = texture(specularMap, vUv).r;',
      '  vec3 n = bumpedNormal(normalize(vNormal), -vViewPosition);',
      '  vec3 colour = lit(surface.rgb, n, -vViewPosition, shininess, specularColor, glossy);',
      '  outColor = vec4(toScreen(colour), 1.0);',
      '}'
    ].join('\n');

    var CLOUD_FRAGMENT = HEAD + [
      'uniform sampler2D alphaMap;',
      'uniform float opacity;',
      LIGHTS,
      TO_SCREEN,
      'in vec2 vUv;',
      'in vec3 vNormal;',
      'in vec3 vViewPosition;',
      'out vec4 outColor;',
      'void main() {',
      '  float alpha = opacity * texture(alphaMap, vUv).g;',
      '  vec3 colour = lit(vec3(1.0), normalize(vNormal), -vViewPosition, 1.0, vec3(0.0), 0.0);',
      '  outColor = vec4(toScreen(colour), alpha);',
      '}'
    ].join('\n');

    /* A flat colour: with a picture's green channel for its opacity (the
       clouds' shadow, the storm's shadow), or with a colour for each point of
       a strip (the rain). */
    function flatVertex(withColor) {
      return HEAD + [
        'layout(location = 0) in vec3 position;',
        'layout(location = 2) in vec2 uv;',
        withColor ? 'layout(location = 3) in vec3 color;' : '',
        'uniform mat4 modelViewMatrix;',
        'uniform mat4 projectionMatrix;',
        'out vec2 vUv;',
        withColor ? 'out vec3 vColor;' : '',
        'void main() {',
        '  vUv = uv;',
        withColor ? '  vColor = color;' : '',
        '  gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0));',
        '}'
      ].join('\n');
    }
    function flatFragment(withPicture, withColor) {
      return HEAD + [
        'uniform vec3 diffuse;',
        'uniform float opacity;',
        withPicture ? 'uniform sampler2D alphaMap;' : '',
        TO_SCREEN,
        'in vec2 vUv;',
        withColor ? 'in vec3 vColor;' : '',
        'out vec4 outColor;',
        'void main() {',
        '  vec3 colour = diffuse;',
        withColor ? '  colour *= vColor;' : '',
        '  float alpha = opacity;',
        withPicture ? '  alpha *= texture(alphaMap, vUv).g;' : '',
        '  outColor = vec4(toScreen(colour), alpha);',
        '}'
      ].join('\n');
    }

    /* The air's glow: brightest where the surface turns away, seen from inside the shell */
    var ATMOS_VERTEX = HEAD + [
      'layout(location = 0) in vec3 position;',
      'layout(location = 1) in vec3 normal;',
      'uniform mat4 modelViewMatrix;',
      'uniform mat4 projectionMatrix;',
      'uniform mat3 normalMatrix;',
      'out vec3 vN;',
      'out vec3 vV;',
      'void main(){',
      '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
      '  vN = normalize(normalMatrix * normal);',
      '  vV = normalize(-mv.xyz);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n');
    var ATMOS_FRAGMENT = HEAD + [
      'uniform vec3 glow;',
      'uniform vec3 edge;',
      'in vec3 vN;',
      'in vec3 vV;',
      'out vec4 outColor;',
      'void main(){',
      '  float f = pow(1.0 - abs(dot(vN, vV)), 3.0);',
      '  outColor = vec4(mix(glow, edge, f) * f * 1.6, f);',
      '}'
    ].join('\n');

    /* The storm: a flat sheet whose points are lifted by the spiral's own opacity and a drifting detail of cloud, so the tops stand up; shaded by the slope of what it finds */
    var DISC_VERTEX = HEAD + [
      'layout(location = 0) in vec3 position;',
      'layout(location = 2) in vec2 uv;',
      'uniform mat4 modelMatrix;',
      'uniform mat4 modelViewMatrix;',
      'uniform mat4 projectionMatrix;',
      'uniform sampler2D map;',
      'uniform sampler2D detail;',
      'uniform float uH;',
      'out vec2 vUv;',
      'out float vD;',
      'out vec3 vPos;',
      'void main(){',
      '  vUv = uv;',
      '  float d = clamp(texture(map, uv).a * 1.25, 0.0, 1.0);',
      '  float det = texture(detail, uv * 1.6 + vec2(0.31, 0.17)).r;',
      '  float h = (pow(d, 0.9) * 0.85 + det * 0.25 * d) * uH;',
      '  vD = d;',
      '  vec3 p = position + vec3(0.0, 0.0, h);',
      '  vPos = (modelMatrix * vec4(p, 1.0)).xyz;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
      '}'
    ].join('\n');
    var DISC_FRAGMENT = HEAD + [
      'uniform vec3 uSun;',
      'uniform float uFlash;',
      'uniform float uAlpha;',
      'uniform vec3 cLit;',
      'uniform vec3 cShade;',
      'in vec2 vUv;',
      'in float vD;',
      'in vec3 vPos;',
      'out vec4 outColor;',
      'void main(){',
      '  vec3 n = normalize(cross(dFdx(vPos), dFdy(vPos)));',
      '  if (dot(n, normalize(vPos)) < 0.0) { n = -n; }',
      '  float lam = clamp(dot(n, normalize(uSun)), 0.0, 1.0);',
      '  vec3 col = mix(cShade, cLit, 0.25 + 0.75 * lam);',
      '  col = mix(col, vec3(1.0), uFlash * vD);',
      '  outColor = vec4(col, smoothstep(0.05, 0.4, vD) * uAlpha);',
      '}'
    ].join('\n');

    /* The stars: square points of a fixed size in pixels */
    var STAR_VERTEX = HEAD + [
      'layout(location = 0) in vec3 position;',
      'uniform mat4 modelViewMatrix;',
      'uniform mat4 projectionMatrix;',
      'uniform float size;',
      'void main() {',
      '  gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0));',
      '  gl_PointSize = size;',
      '}'
    ].join('\n');
    var PLAIN_FRAGMENT = HEAD + [
      'uniform vec3 diffuse;',
      'uniform float opacity;',
      TO_SCREEN,
      'out vec4 outColor;',
      'void main() {',
      '  outColor = vec4(toScreen(diffuse), opacity);',
      '}'
    ].join('\n');

    /* The track: a line, dashed by the distance along it (the dashes ahead of the storm) or whole (the gold behind) */
    function lineVertex(dashed) {
      return HEAD + [
        'layout(location = 0) in vec3 position;',
        dashed ? 'layout(location = 4) in float lineDistance;' : '',
        'uniform mat4 modelViewMatrix;',
        'uniform mat4 projectionMatrix;',
        dashed ? 'out float vAlong;' : '',
        'void main() {',
        dashed ? '  vAlong = lineDistance;' : '',
        '  gl_Position = projectionMatrix * (modelViewMatrix * vec4(position, 1.0));',
        '}'
      ].join('\n');
    }
    function lineFragment(dashed) {
      return HEAD + [
        'uniform vec3 diffuse;',
        'uniform float opacity;',
        dashed ? 'uniform float dashSize;' : '',
        dashed ? 'uniform float cycle;' : '',
        dashed ? 'in float vAlong;' : '',
        TO_SCREEN,
        'out vec4 outColor;',
        'void main() {',
        dashed ? '  if (mod(vAlong, cycle) > dashSize) { discard; }' : '',
        '  outColor = vec4(toScreen(diffuse), opacity);',
        '}'
      ].join('\n');
    }

    /* The dots and the target: a square that always faces the camera, `size` across in the world. Its four
       corners are put out from its middle, which is given in the view, sideways and up in the view, so the
       square lies across the way the camera looks. */
    var SPRITE_VERTEX = HEAD + [
      'layout(location = 0) in vec3 position;',
      'layout(location = 2) in vec2 uv;',
      'uniform mat4 projectionMatrix;',
      'uniform vec3 centre;',
      'uniform float size;',
      'out vec2 vUv;',
      'void main() {',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * vec4(centre + vec3(position.xy * size, 0.0), 1.0);',
      '}'
    ].join('\n');
    var SPRITE_FRAGMENT = HEAD + [
      'uniform vec3 diffuse;',
      'uniform float opacity;',
      'uniform sampler2D map;',
      TO_SCREEN,
      'in vec2 vUv;',
      'out vec4 outColor;',
      'void main() {',
      '  vec4 picture = texture(map, vUv);',
      '  outColor = vec4(toScreen(diffuse * picture.rgb), opacity * picture.a);',
      '}'
    ].join('\n');

    function stormScene(root, options) {
      var canvas = root.querySelector('canvas');
      if (!canvas) { return null; }
      var W = root.offsetWidth || 840, H = root.offsetHeight || 306;
      var hold = typeof options.hold === 'number' ? options.hold : null;
      var marks = options.marks || [];
      var base = options.textures || 'textures/';
      var gl;
      try {
        // An opaque canvas, with the depth and stencil buffers
        gl = canvas.getContext('webgl2', { antialias: true, alpha: false, depth: true, stencil: true, premultipliedAlpha: true, preserveDrawingBuffer: hold !== null });
      } catch (e) {
        return null;
      }
      if (!gl || (gl.isContextLost && gl.isContextLost())) { return null; }
      // A held picture is drawn as it stands: its labels and list are not brought in by a transition,
      // which a page with no frames to run it, such as the station's snapshot, never plays
      if (hold !== null) { root.classList.add('pn-wx-st3-held'); }
      var K = tokens(root);
      var cw = Math.floor(W * RATIO), ch = Math.floor(H * RATIO);
      function sizeCanvas() {
        canvas.width = cw;
        canvas.height = ch;
      }
      sizeCanvas();

      var running = true;
      var drawn = false;
      var settle = null;
      var finished = new Promise(function (resolve) { settle = resolve; });
      var made = { buffers: [], arrays: [], textures: [], programs: [] };
      var pending = 4;
      /* A still has no frames to wait for: it draws its moment once the pictures have come, or failed to */
      function loaded() {
        pending -= 1;
        if (hold !== null && pending <= 0 && running && drawSafely(hold)) {
          drawn = true;
          settle();
        }
      }
      /* A picture WebKit refuses to upload (it does, with "The operation is insecure", where the page may not read
         other files), or any other failure to draw: the scene is given up, once, and the caller told, so the labels
         and list can fall back to the plain form. Nothing is tried again, and nothing throws every frame. */
      function broke() {
        if (!running) { return; }
        dispose();
        Object.keys(labels).forEach(function (key) {
          labels[key].classList.remove('pn-wx-on');
          labels[key].style.transform = '';
        });
        root.classList.remove('pn-wx-st3-tracking', 'pn-wx-st3-held');
        if (options.onFail) { options.onFail(); }
      }
      function drawSafely(t) {
        try {
          draw(t);
          return true;
        } catch (e) {
          broke();
          return false;
        }
      }

      /* ---- Programs and shapes ---- */
      function shader(type, source) {
        var s = gl.createShader(type);
        gl.shaderSource(s, source);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          var log = gl.getShaderInfoLog(s);
          gl.deleteShader(s);
          throw new Error('shader: ' + log);
        }
        return s;
      }
      function program(vertex, fragment) {
        var v = shader(gl.VERTEX_SHADER, vertex), f;
        try {
          f = shader(gl.FRAGMENT_SHADER, fragment);
        } catch (e) {
          gl.deleteShader(v);
          throw e;
        }
        var p = gl.createProgram();
        made.programs.push(p);
        gl.attachShader(p, v);
        gl.attachShader(p, f);
        gl.linkProgram(p);
        gl.deleteShader(v);
        gl.deleteShader(f);
        if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { throw new Error('program: ' + gl.getProgramInfoLog(p)); }
        var found = { handle: p, spots: {} };
        found.at = function (name) {
          if (!(name in found.spots)) { found.spots[name] = gl.getUniformLocation(p, name); }
          return found.spots[name];
        };
        return found;
      }
      function buffer(target, data) {
        var b = gl.createBuffer();
        made.buffers.push(b);
        gl.bindBuffer(target, b);
        gl.bufferData(target, data, gl.STATIC_DRAW);
        return b;
      }
      /* A shape's points go to the card once, under a vertex array that remembers where each kind sits:
         0 position, 1 normal, 2 uv, 3 colour, 4 distance along a line */
      function shape(parts) {
        var vao = gl.createVertexArray();
        made.arrays.push(vao);
        gl.bindVertexArray(vao);
        [['position', 0, 3], ['normal', 1, 3], ['uv', 2, 2], ['color', 3, 3], ['distance', 4, 1]].forEach(function (kind) {
          var data = parts[kind[0]];
          if (!data) { return; }
          buffer(gl.ARRAY_BUFFER, new Float32Array(data));
          gl.enableVertexAttribArray(kind[1]);
          gl.vertexAttribPointer(kind[1], kind[2], gl.FLOAT, false, 0, 0);
        });
        var out = { vao: vao, count: 0, type: 0, mode: parts.mode === undefined ? gl.TRIANGLES : parts.mode };
        if (parts.index) {
          var big = parts.position.length / 3 > 65535;
          buffer(gl.ELEMENT_ARRAY_BUFFER, big ? new Uint32Array(parts.index) : new Uint16Array(parts.index));
          out.type = big ? gl.UNSIGNED_INT : gl.UNSIGNED_SHORT;
          out.count = parts.index.length;
        } else {
          out.count = parts.position.length / 3;
        }
        out.all = out.count;
        return out;
      }

      var earthProgram, cloudProgram, atmosProgram, discProgram, starProgram, spriteProgram, rainProgram, flatProgram, dashProgram, lineProgram;
      try {
        earthProgram = program(LIT_VERTEX, EARTH_FRAGMENT);
        cloudProgram = program(LIT_VERTEX, CLOUD_FRAGMENT);
        flatProgram = program(flatVertex(false), flatFragment(true, false));
        rainProgram = program(flatVertex(true), flatFragment(false, true));
        atmosProgram = program(ATMOS_VERTEX, ATMOS_FRAGMENT);
        discProgram = program(DISC_VERTEX, DISC_FRAGMENT);
        starProgram = program(STAR_VERTEX, PLAIN_FRAGMENT);
        spriteProgram = program(SPRITE_VERTEX, SPRITE_FRAGMENT);
        dashProgram = program(lineVertex(true), lineFragment(true));
        lineProgram = program(lineVertex(false), lineFragment(false));
      } catch (e) {
        // Not a scene to draw: told as no graphics context is
        running = false;
        free();
        settle();
        return null;
      }

      /* ---- Pictures: what is uploaded, and how ---- */
      var anisotropy = gl.getExtension('EXT_texture_filter_anisotropic');
      var maxAnisotropy = anisotropy ? gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 1;
      /* A picture goes up the way a picture does for a lit surface: flipped, never premultiplied, four bytes to a
         pixel, with a full chain of smaller ones and the trilinear filter; a colour picture (`srgb`) is stored as sRGB,
         which the graphics card turns to linear as it reads, before it blends the pixels together. */
      function texture(image, options2) {
        var tex = { image: image, handle: null, srgb: !!options2.srgb, repeat: !!options2.repeat, aniso: options2.aniso || 1 };
        tex.bind = function (unit) {
          gl.activeTexture(gl.TEXTURE0 + unit);
          if (tex.handle === null && tex.image) { upload(tex); }
          gl.bindTexture(gl.TEXTURE_2D, tex.handle);
        };
        return tex;
      }
      function upload(tex) {
        var image = tex.image, handle = gl.createTexture();
        made.textures.push(handle);
        gl.bindTexture(gl.TEXTURE_2D, handle);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
        gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, tex.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, tex.repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        if (anisotropy && tex.aniso > 1) {
          gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(tex.aniso, maxAnisotropy));
        }
        var levels = Math.floor(Math.log(Math.max(image.width, image.height)) / Math.LN2) + 1;
        gl.texStorage2D(gl.TEXTURE_2D, levels, tex.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, image.width, image.height);
        // WebKit refuses here, with "The operation is insecure", where the page may not read the file the picture came from
        gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, image);
        gl.generateMipmap(gl.TEXTURE_2D);
        tex.handle = handle;
      }
      function picture(url, srgb, repeat) {
        var img = new Image();
        img.crossOrigin = 'anonymous';
        var tex = texture(null, { srgb: srgb, repeat: repeat, aniso: 8 });
        img.onload = function () { tex.image = img; loaded(); };
        img.onerror = loaded;
        img.src = url;
        return tex;
      }
      var earthMap = picture(base + 'earth.jpg', true, false);
      var cloudMap = picture(base + 'clouds.jpg', false, true);
      var topoMap = picture(base + 'topo.jpg', false, false);
      var waterMap = picture(base + 'water.jpg', false, false);
      var spiralTex = texture(spiralCanvas(512), {});
      var dotTex = texture(dotCanvas(64, false), {});
      var ringTex = texture(dotCanvas(64, true), {});

      /* ---- The scene: things in a tree of places, each drawn by its own function ---- */
      var nextId = 0, nodes = [];
      function place(parent) {
        var node = { id: ++nextId, parent: parent || null, p: [0, 0, 0], q: [0, 0, 0, 1], s: [1, 1, 1], world: mFrom([0, 0, 0], [0, 0, 0, 1], [1, 1, 1]) };
        nodes.push(node);
        return node;
      }
      function settleWorld(node) {
        var local = mFrom(node.p, node.q, node.s);
        node.world = node.parent === null ? local : mMul(node.parent.world, local);
      }
      var things = [];
      /* How a thing is blended and where it writes: `blend` none, normal or additive; `side` front, back or both;
         lower `order` is drawn first, and among the see-through things the farther comes first. */
      function thing(node, how) {
        how.node = node;
        how.id = node.id;
        how.material = ++nextId;
        how.order = how.order || 0;
        things.push(how);
        return how;
      }

      // Stars
      var starAt = [], rs = seeded(9), i;
      for (i = 0; i < 1800; i++) {
        var v = vMul(vUnit([rs() * 2 - 1, rs() * 2 - 1, rs() * 2 - 1]), 80);
        starAt.push(v[0], v[1], v[2]);
      }
      var starShape = shape({ position: starAt, mode: gl.POINTS });
      var starNode = place();
      thing(starNode, {
        shape: starShape, transparent: false, blend: 'none', depthWrite: true, side: 'front',
        show: function (frame) {
          gl.useProgram(starProgram.handle);
          matrices(starProgram, this.node, frame, false);
          gl.uniform3f(starProgram.at('diffuse'), 0xc9 / 255, 0xd3 / 255, 0xe3 / 255);
          gl.uniform1f(starProgram.at('opacity'), 1);
          gl.uniform1f(starProgram.at('size'), 1.3 * RATIO);
        }
      });

      // The earth, its satellite clouds with their shadows, and the air's glow
      var earthShape = shape(sphereShape(1, 160, 120));
      thing(place(), {
        shape: earthShape, transparent: false, blend: 'none', depthWrite: true, side: 'front',
        show: function (frame) {
          gl.useProgram(earthProgram.handle);
          matrices(earthProgram, this.node, frame, true);
          lights(earthProgram, frame);
          earthMap.bind(0); gl.uniform1i(earthProgram.at('map'), 0);
          topoMap.bind(1); gl.uniform1i(earthProgram.at('bumpMap'), 1);
          waterMap.bind(2); gl.uniform1i(earthProgram.at('specularMap'), 2);
          gl.uniform1f(earthProgram.at('bumpScale'), 0.012);
          gl.uniform3f(earthProgram.at('specularColor'), 0x18 / 255, 0x20 / 255, 0x2e / 255);
          gl.uniform1f(earthProgram.at('shininess'), 40);
        }
      });
      var cloudShadowNode = place();
      thing(cloudShadowNode, {
        shape: shape(sphereShape(1.0015, 160, 120)), transparent: true, blend: 'normal', depthWrite: false, side: 'front',
        show: function (frame) {
          gl.useProgram(flatProgram.handle);
          matrices(flatProgram, this.node, frame, false);
          gl.uniform3fv(flatProgram.at('diffuse'), K.deep);
          gl.uniform1f(flatProgram.at('opacity'), 0.42);
          cloudMap.bind(0); gl.uniform1i(flatProgram.at('alphaMap'), 0);
        }
      });
      var cloudsNode = place();
      thing(cloudsNode, {
        shape: shape(sphereShape(1.007, 160, 120)), transparent: true, blend: 'normal', depthWrite: false, side: 'front',
        show: function (frame) {
          gl.useProgram(cloudProgram.handle);
          matrices(cloudProgram, this.node, frame, true);
          lights(cloudProgram, frame);
          gl.uniform1f(cloudProgram.at('opacity'), 0.92);
          cloudMap.bind(0); gl.uniform1i(cloudProgram.at('alphaMap'), 0);
        }
      });
      thing(place(), {
        shape: shape(sphereShape(1.045, 96, 72)), transparent: true, blend: 'additive', depthWrite: false, side: 'back',
        show: function (frame) {
          gl.useProgram(atmosProgram.handle);
          matrices(atmosProgram, this.node, frame, true);
          gl.uniform3fv(atmosProgram.at('glow'), K.glow);
          gl.uniform3fv(atmosProgram.at('edge'), K.edge);
        }
      });

      // The track: dashed ahead, the station's gold behind the storm
      var N = 160, trackAtPoints = [], along = [], last = null, run = 0;
      for (i = 0; i <= N; i++) {
        var p = trackAt(i / N, 1.0022);
        // Float32 here, as the card holds them, so the distances add up as the card's points do
        p = [Math.fround(p[0]), Math.fround(p[1]), Math.fround(p[2])];
        if (last !== null) { run += vLen(vSub(p, last)); }
        along.push(run);
        trackAtPoints.push(p[0], p[1], p[2]);
        last = p;
      }
      thing(place(), {
        shape: shape({ position: trackAtPoints, distance: along, mode: gl.LINE_STRIP }), transparent: true, blend: 'normal', depthWrite: true, side: 'front',
        show: function (frame) {
          gl.useProgram(dashProgram.handle);
          matrices(dashProgram, this.node, frame, false);
          gl.uniform3f(dashProgram.at('diffuse'), 1, 1, 1);
          gl.uniform1f(dashProgram.at('opacity'), 0.9);
          gl.uniform1f(dashProgram.at('dashSize'), 0.006);
          gl.uniform1f(dashProgram.at('cycle'), 0.006 + 0.004);
        }
      });
      var behind = thing(place(), {
        shape: shape({ position: trackAtPoints, mode: gl.LINE_STRIP }), transparent: false, blend: 'none', depthWrite: true, side: 'front',
        show: function (frame) {
          gl.useProgram(lineProgram.handle);
          matrices(lineProgram, this.node, frame, false);
          gl.uniform3fv(lineProgram.at('diffuse'), K.goldHi);
          gl.uniform1f(lineProgram.at('opacity'), 1);
        }
      });

      // The dots and the target
      var quad = shape({
        position: [-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], uv: [0, 0, 1, 0, 1, 1, 0, 1], index: [0, 1, 2, 0, 2, 3]
      });
      function sprite(tex, size, at, tint, order) {
        var node = place();
        node.p = at;
        node.s = [size, size, 1];
        var one = thing(node, {
          shape: quad, transparent: true, blend: 'normal', depthWrite: false, side: 'front', order: order || 0,
          show: function (frame) {
            gl.useProgram(spriteProgram.handle);
            var world = this.node.world, middle = mPoint(frame.view.inverse, [world[12], world[13], world[14]]);
            gl.uniformMatrix4fv(spriteProgram.at('projectionMatrix'), false, frame.view.projection);
            gl.uniform3f(spriteProgram.at('centre'), middle[0], middle[1], middle[2]);
            gl.uniform1f(spriteProgram.at('size'), this.node.s[0]);
            gl.uniform3fv(spriteProgram.at('diffuse'), tint);
            gl.uniform1f(spriteProgram.at('opacity'), 1);
            tex.bind(0); gl.uniform1i(spriteProgram.at('map'), 0);
          }
        });
        return one;
      }
      [0].concat(marks.map(function (m) { return m.at; })).forEach(function (m) { sprite(dotTex, 0.016, trackAt(m, 1.003), [1, 1, 1]); });
      var target = sprite(ringTex, 0.03, trackAt(1, 1.003), K.breakingHi, -1);

      // The rain the storm leaves behind it: a swath along the track
      var SW = 120, swPos = [], swCol = [], swIdx = [];
      for (i = 0; i <= SW; i++) {
        var s0 = i / SW, a = trackAt(Math.max(0, s0 - 0.004), 1.0012), b = trackAt(Math.min(1, s0 + 0.004), 1.0012);
        var c0 = trackAt(s0, 1.0012), n0 = vUnit(c0);
        var side = vMul(vUnit(vCross(vSub(b, a), n0)), 0.012 + 0.05 * s0);
        swPos.push(c0[0] + side[0], c0[1] + side[1], c0[2] + side[2], c0[0] - side[0], c0[1] - side[1], c0[2] - side[2]);
        var col = vLerp(K.ready, K.goldHi, s0 * 0.7);
        swCol.push(col[0], col[1], col[2], col[0], col[1], col[2]);
        if (i < SW) { var k = i * 2; swIdx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      var swathLook = { opacity: 0.38 };
      var swath = thing(place(), {
        shape: shape({ position: swPos, color: swCol, index: swIdx }), transparent: true, blend: 'normal', depthWrite: false, side: 'both',
        show: function (frame) {
          gl.useProgram(rainProgram.handle);
          matrices(rainProgram, this.node, frame, false);
          gl.uniform3f(rainProgram.at('diffuse'), 1, 1, 1);
          gl.uniform1f(rainProgram.at('opacity'), swathLook.opacity);
        }
      });

      // The storm: the spiral from above, its tops coloured as it strengthens, puffs of cloud standing up from it, its shadow on the sea
      var stormNode = place();
      var spinNode = place(stormNode);
      var discNode = place(spinNode);
      discNode.p = [0, 0, 0.004];
      var shadowNode = place(stormNode);
      var boltNode = place(stormNode);
      boltNode.p = [0, 0, 0.08];
      var storm = { alpha: 1, flash: 0, shadowOpacity: 0.55, bolt: 0 };
      thing(discNode, {
        shape: shape(sheetShape(2, 2, 220, 220)), transparent: true, blend: 'normal', depthWrite: true, side: 'front', order: 2,
        show: function (frame) {
          gl.useProgram(discProgram.handle);
          matrices(discProgram, this.node, frame, false);
          spiralTex.bind(0); gl.uniform1i(discProgram.at('map'), 0);
          cloudMap.bind(1); gl.uniform1i(discProgram.at('detail'), 1);
          gl.uniform1f(discProgram.at('uH'), 0.09);
          gl.uniform1f(discProgram.at('uFlash'), storm.flash);
          gl.uniform1f(discProgram.at('uAlpha'), storm.alpha);
          gl.uniform3fv(discProgram.at('uSun'), SUN);
          gl.uniform3fv(discProgram.at('cLit'), K.white);
          gl.uniform3f(discProgram.at('cShade'), 0x8f / 255, 0x9b / 255, 0xb6 / 255);
        }
      });
      thing(shadowNode, {
        shape: shape(sheetShape(2, 2, 1, 1)), transparent: true, blend: 'normal', depthWrite: false, side: 'front',
        show: function (frame) {
          gl.useProgram(flatProgram.handle);
          matrices(flatProgram, this.node, frame, false);
          gl.uniform3fv(flatProgram.at('diffuse'), K.deep);
          gl.uniform1f(flatProgram.at('opacity'), storm.shadowOpacity);
          spiralTex.bind(0); gl.uniform1i(flatProgram.at('alphaMap'), 0);
        }
      });

      var labels = {};
      Array.prototype.forEach.call(root.querySelectorAll('[data-at]'), function (el) { labels[el.getAttribute('data-at')] = el; });
      var rows = root.querySelectorAll('[data-row]');
      var END_LABEL = geo(END[0] + 2.2, END[1] + 4.6, 1.004);

      /* ---- A frame ---- */
      var view = viewOf(cameraPose(0), W / H);
      function matrices(prog, node, frame, withNormal) {
        var modelView = mMul(frame.view.inverse, node.world);
        gl.uniformMatrix4fv(prog.at('modelViewMatrix'), false, modelView);
        gl.uniformMatrix4fv(prog.at('projectionMatrix'), false, frame.view.projection);
        if (withNormal) { gl.uniformMatrix3fv(prog.at('normalMatrix'), false, mNormal(modelView)); }
        if (prog.at('modelMatrix')) { gl.uniformMatrix4fv(prog.at('modelMatrix'), false, node.world); }
      }
      /* The lights, in the view: the sun, the ambient, and the bolt where the storm is */
      function lights(prog, frame) {
        var pi = Math.PI;
        gl.uniform3f(prog.at('ambientColor'), 0x3a / 255 * 0.6 * pi, 0x44 / 255 * 0.6 * pi, 0x66 / 255 * 0.6 * pi);
        gl.uniform3fv(prog.at('sunDirection'), mDirection(frame.view.inverse, vMul(SUN, 10)));
        gl.uniform3f(prog.at('sunColor'), 1.35 * pi, 1.35 * pi, 1.35 * pi);
        var at = [boltNode.world[12], boltNode.world[13], boltNode.world[14]];
        gl.uniform3fv(prog.at('boltPosition'), mPoint(frame.view.inverse, at));
        var power = storm.bolt * pi;
        gl.uniform3f(prog.at('boltColor'), power, power, power);
      }
      function blending(kind) {
        if (kind === 'none') { gl.disable(gl.BLEND); return; }
        gl.enable(gl.BLEND);
        gl.blendEquation(gl.FUNC_ADD);
        if (kind === 'additive') { gl.blendFunc(gl.SRC_ALPHA, gl.ONE); } else { gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA); }
      }
      function paint(one, side, frame) {
        // The back faces draw by turning which winding counts as the front
        if (side === 'both') { gl.disable(gl.CULL_FACE); } else {
          gl.enable(gl.CULL_FACE);
          gl.cullFace(gl.BACK);
          gl.frontFace(side === 'back' ? gl.CW : gl.CCW);
        }
        blending(one.blend);
        gl.depthMask(one.depthWrite);
        one.show(frame);
        gl.bindVertexArray(one.shape.vao);
        if (one.shape.type === 0) {
          gl.drawArrays(one.shape.mode, 0, one.shape.count);
        } else {
          gl.drawElements(one.shape.mode, one.shape.count, one.shape.type, 0);
        }
      }
      /* The things in the order a frame draws them: the solid ones first, in the order they were made; then the
         see-through ones, by `order` and then from the farthest to the nearest, where a thing's distance is how far
         its middle falls in the depth the camera gives. Things whose middles coincide keep the order they were made in. */
      function ordered(frame) {
        var screen = mMul(frame.view.projection, frame.view.inverse), solid = [], clear = [];
        things.forEach(function (one) {
          var z = mPoint(screen, [one.node.world[12], one.node.world[13], one.node.world[14]])[2];
          (one.transparent ? clear : solid).push({ one: one, z: z });
        });
        // each key breaks the tie of the one before it
        solid.sort(function (a, b) {
          return (a.one.order - b.one.order) || (a.one.material - b.one.material) || (a.z - b.z) || (a.one.id - b.one.id);
        });
        clear.sort(function (a, b) {
          return (a.one.order - b.one.order) || (b.z - a.z) || (a.one.id - b.one.id);
        });
        return solid.concat(clear).map(function (entry) { return entry.one; });
      }
      function render() {
        var frame = { view: view };
        // a place is made after the one it hangs from, so they settle in the order they were made
        nodes.forEach(settleWorld);
        var list = ordered(frame);
        gl.viewport(0, 0, cw, ch);
        gl.disable(gl.SCISSOR_TEST);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.colorMask(true, true, true, true);
        gl.depthMask(true);
        gl.clearColor(CLEAR[0], CLEAR[1], CLEAR[2], 1);
        gl.clearDepth(1);
        gl.clearStencil(0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT | gl.STENCIL_BUFFER_BIT);
        list.forEach(function (one) {
          if (one.shape.count === 0) { return; }
          if (one.transparent && one.side === 'both') {
            paint(one, 'back', frame);
            paint(one, 'front', frame);
          } else {
            paint(one, one.side, frame);
          }
        });
        gl.depthMask(true);
      }

      function label(name, at, show) {
        var el = labels[name];
        if (!el) { return; }
        var sc = screenPoint(at, view, W, H);
        el.style.transform = 'translate(' + sc.x.toFixed(1) + 'px,' + sc.y.toFixed(1) + 'px)';
        el.classList.toggle('pn-wx-on', !!(show && sc.on));
      }
      function draw(t) {
        view = viewOf(cameraPose(t), W / H);
        cloudsNode.q = qAboutY(t * 0.006);
        cloudShadowNode.q = qAboutY(t * 0.006 - 0.003);
        var pose = stormPose(t);
        stormNode.p = pose.position;
        stormNode.q = pose.turn;
        stormNode.s = [pose.scale, pose.scale, pose.scale];
        spinNode.q = qAboutZ(pose.spin);
        shadowNode.p = pose.shadow;
        shadowNode.q = qAboutZ(pose.spin);
        storm.alpha = pose.formed;
        storm.shadowOpacity = 0.55 * pose.formed;
        storm.flash = pose.flash * 0.8;
        storm.bolt = pose.flash * 3;
        var s = pose.s;
        // the swath and the gold track behind it
        swath.shape.count = Math.floor(s * SW) * 6;
        swathLook.opacity = 0.24 * pose.formed;
        behind.shape.count = Math.floor(s * N) + 1;
        var grow = 0.03 * (1 + (pose.landfall > 0 ? 0.25 * Math.abs(Math.sin(pose.landfall * 5)) : 0));
        target.node.s = [grow, grow, grow];
        var ready = t > T_DIVE + 0.3;
        label('now', trackAt(0, 1.006), ready);
        marks.forEach(function (m, i) {
          label('m' + i, trackAt(m.at, 1.006), ready && s >= m.at);
          if (rows[i]) { rows[i].classList.toggle('pn-wx-on', s >= m.at); }
        });
        label('end', END_LABEL, t >= T_LAND + 0.15);
        if (rows[marks.length]) { rows[marks.length].classList.toggle('pn-wx-on', t >= T_LAND); }
        root.classList.toggle('pn-wx-st3-tracking', ready);
        render();
      }
      var start = performance.now();
      function frame() {
        if (!running) { return; }
        if (!root.isConnected) { dispose(); return; }
        // the page may reset the canvas's size attributes when it redraws its markup
        if (canvas.width !== cw || canvas.height !== ch) { sizeCanvas(); }
        // one run from mount, then the last picture stays
        if (!drawSafely(Math.min(DUR, (performance.now() - start) / 1000))) { return; }
        requestAnimationFrame(frame);
      }
      /* Gives back everything the scene holds on the graphics card: the pictures
         are large, and a new scene comes with each warning and report */
      function free() {
        made.programs.forEach(function (p) { gl.deleteProgram(p); });
        made.textures.forEach(function (t) { gl.deleteTexture(t); });
        made.arrays.forEach(function (a) { gl.deleteVertexArray(a); });
        made.buffers.forEach(function (b) { gl.deleteBuffer(b); });
        made.programs = []; made.textures = []; made.arrays = []; made.buffers = [];
        var lose = gl.getExtension('WEBGL_lose_context');
        if (lose) { lose.loseContext(); }
      }
      function dispose() {
        if (!running) { return; }
        running = false;
        free();
        // a still waiting for this scene's picture waits no longer
        settle();
      }
      if (hold === null) { requestAnimationFrame(frame); }
      // `ready` comes once a held moment has been drawn, so a still can wait for it
      return { dispose: dispose, ready: hold === null ? Promise.resolve() : finished, drawn: function () { return drawn; } };
    }
    stormScene.cameraPose = cameraPose;
    stormScene.viewOf = viewOf;
    stormScene.screenPoint = screenPoint;
    stormScene.stormPose = stormPose;
    stormScene.trackAt = trackAt;
    return stormScene;
  })();

  /* The held pictures not yet drawn: a still waits for them (PipNews.drawn) */
  var HELD = [];
  function holdUntilDrawn(promise) {
    HELD.push(promise);
    promise.then(function () { HELD.splice(HELD.indexOf(promise), 1); });
  }
  function drawn() { return Promise.all(HELD.slice()); }
  function hasWebGL() { return !!window.WebGL2RenderingContext; }

  /* STORMTRACKER: the globe on the weather wall in BREAKING's red, with its
     labels over it and TIME OF ARRIVAL listing the marks and the hour the
     week runs out. Drawn only where WebGL 2 is: without it the globe stays
     dark, and the list and the OUT tag show at their resting places with
     every row lit. With `animate` it runs 13 s;
     without it, or with reduced motion, it holds the last moment. */
  function Stormtracker(props) {
    var wx = props.weather || SAMPLES.stormtracker.weather;
    var track = wx.track || { marks: [], out: '' };
    var marks = track.marks || [];
    var animate = bool(props.animate, false);
    var hold = animate && !reducedMotion() ? null : 10.4;
    var ref = useRef(null);
    var failed = useState(false);
    var plain = failed[0] || !hasWebGL();
    var marksKey = JSON.stringify(marks);
    useEffect(function () {
      var root = ref.current;
      if (!root || !hasWebGL()) { return undefined; }
      var scene = null;
      try {
        scene = stormScene(root, { textures: props.textures, marks: marks, hold: hold, onFail: function () { failed[1](true); } });
      } catch (e) {
        scene = null;
      }
      if (!scene) { failed[1](true); return undefined; }
      if (hold !== null) { holdUntilDrawn(scene.ready); }
      return function () { scene.dispose(); };
    }, [hold, marksKey, props.textures]);
    var said = marks.map(function (m) { return m.share + ' by ' + m.when + ', '; }).join('');
    return weatherWall('pn-k-breaking', WEATHER.tracker, wx.until, [
      h('div', { key: 'box', className: 'pn-wx-st3-box' },
        h('div', {
          ref: ref,
          className: cx('pn-wx-st3', plain && 'pn-wx-st3-plain'),
          role: 'img',
          'aria-label': 'STORMTRACKER: a storm forms at now and grows as it crosses the Gulf, ' + said + 'and the week runs out at ' + track.out
        },
        h('canvas', { width: 1680, height: 612 }),
        h('i', { className: 'pn-wx-st3-flare', 'aria-hidden': 'true' }),
        h('div', { className: 'pn-wx-st3-label pn-wx-st3-now', 'data-at': 'now' }, h('span', null, WEATHER.start)),
        marks.map(function (m, i) {
          return h('div', { key: 'm' + i, className: 'pn-wx-st3-label pn-wx-st3-mark', 'data-at': 'm' + i }, h('span', null, m.share));
        }),
        h('div', { className: 'pn-wx-st3-label pn-wx-st3-out', 'data-at': 'end' }, h('span', null, WEATHER.out + ' · ' + track.out)),
        h('div', { className: 'pn-wx-st3-toa' },
          h('b', null, WEATHER.arrival),
          marks.map(function (m, i) { return h('span', { key: 'r' + i, 'data-row': i }, m.when + '   ' + m.share); }),
          h('span', { 'data-row': 'end', className: 'pn-wx-st3-hit' }, track.out + '   ' + WEATHER.out))))
    ]);
  }

  /* WEATHER ALERT, the open of STORM WARNING. Built as ON THE HOUR is: the
     station clock's bezel and glossy face on the left holding the storm,
     the words in chrome on the right, on BREAKING NEWS's glass wall in red.
     Its motion is the stylesheet's (the bolt flashes, WEATHER and ALERT
     slam in, the frame flashes white as the thunder breaks), under
     `.pn-anim`; `progress` is the glass wall's. `outro` runs it out over
     1.4 s, as the hour's outro runs out the ident: no flash, and the open
     fades to the board underneath. */
  function AlertOpen(props) {
    var outro = bool(props.outro, false);
    function line(word) { return chromeStill(word, 'pn-stinger-line pn-ident-line pn-wx-alert-line'); }
    return h('div', {
      className: cx('pn-wx-alert', outro && 'pn-wx-alert-out', 'pn-k-breaking'),
      style: { position: 'absolute', left: 0, top: 0, width: STAGE_W + 'px', height: STAGE_H + 'px' }
    },
      h(Stinger, { words: [], outro: outro, progress: props.progress, animate: bool(props.animate, false) }),
      h('div', { className: 'pn-wx-alert-dial' },
        h('div', { className: 'pn-dial' }, h('div', { className: 'pn-dial-face' }, h(WeatherIcon, { sky: 'storm', bolt: 'pn-wx-alert-bolt' })))),
      h('div', { className: 'pn-ident-words pn-wx-alert-words' }, WEATHER.alert.map(line)),
      outro ? null : h('i', { className: 'pn-wx-flash', 'aria-hidden': 'true' }));
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

  /* The backdrop: the ring at the top right and the signal it sends out,
     behind every picture that stands on the studio's ground: the board,
     THE HOUR IN REVIEW and an outro's board underneath. They are one
     part, so a picture that stands on the ring sends out its signal too.
     The signal is three waves 3 s apart, each leaving the ring and
     spreading to two and a half times its size as it fades, 9 s from the
     ring to gone. A wave's delay is read from the clock when it is drawn,
     so every backdrop sends the same waves at the same moment, and they
     never restart as one picture hands over to the next. Drawn only while
     the picture animates: a still shows the ring alone, as reduced motion
     does. */
  var SIGNAL = { period: 9000, waves: 3 };
  function Signal() {
    var at = useState(function () { return Date.now(); })[0];
    var waves = [];
    for (var i = 0; i < SIGNAL.waves; i++) {
      var lead = (at + i * SIGNAL.period / SIGNAL.waves) % SIGNAL.period;
      waves.push(h('i', { key: i, style: { animationDelay: -lead + 'ms' } }));
    }
    return h('div', { className: 'pn-signal' }, waves);
  }
  function Backdrop(props) {
    return h('div', { className: 'pn-backdrop', 'aria-hidden': 'true' },
      h('i', { className: 'pn-backdrop-ring' }),
      bool(props.animate, false) ? h(Signal) : null);
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
      /* the board it hands back to waits underneath, backdrop, ticker and
         all, in a layer of its own so the ticker's tab and clock stay
         under the open */
      var back = scene.board || {};
      parts.push(h('div', { key: 'under', className: 'pn-board-under', style: { position: 'absolute', left: 0, top: 0, width: STAGE_W + 'px', height: STAGE_H + 'px', zIndex: 0 } },
        h(Backdrop, { animate: animate }),
        h(SessionBoard, { sessions: back.sessions, limits: back.limits }),
        h(Ticker, { items: back.ticker, time: back.clock, label: back.tickerLabel, animate: animate })));
      if (scene.open === 'hour') {
        parts.push(h(Ident, { key: 'id-out', outro: true, hour: scene.hour, progress: scene.progress, animate: animate }));
      } else if (scene.open === 'alert') {
        parts.push(h(AlertOpen, { key: 'alert-out', outro: true, progress: scene.progress, animate: animate }));
      } else {
        parts.push(h(Stinger, { key: 'st', outro: true, progress: scene.progress, animate: animate }));
      }
    } else if (mode === 'ident') {
      parts.push(h(Ident, { key: 'id', hour: scene.hour, progress: scene.progress, animate: animate }));
    } else if (mode === 'review') {
      parts.push(h(Backdrop, { key: 'backdrop', animate: animate }));
      parts.push(h(HourReview, { key: 'rv', rows: scene.rows, span: scene.span, label: scene.label, animate: animate }));
    } else if (mode === 'weather-now' || mode === 'weather-days' || mode === 'stormtracker') {
      parts.push(h(Backdrop, { key: 'backdrop', animate: animate }));
      parts.push(mode === 'weather-now' ? h(WeatherNow, { key: 'wx', weather: scene.weather })
        : mode === 'weather-days' ? h(WeatherDays, { key: 'wx', weather: scene.weather })
        : h(Stormtracker, { key: 'wx', weather: scene.weather, animate: animate }));
    } else if (mode === 'alert') {
      parts.push(h(AlertOpen, { key: 'alert', progress: scene.progress, animate: animate }));
    } else {
      parts.push(h(Backdrop, { key: 'backdrop', animate: animate }));
      parts.push(h(SessionBoard, { key: 'board', sessions: scene.sessions, limits: scene.limits, animate: animate }));
    }
    parts.push(h(TopBand, { key: 'top' }));
    if (mode !== 'stinger' && mode !== 'outro' && mode !== 'ident' && mode !== 'alert') {
      parts.push(h(Ticker, { key: 'tick', items: scene.ticker, time: scene.clock, label: scene.tickerLabel, offset: scene.tickerOffset, animate: animate }));
    }
    return h('div', {
      key: live ? 'scene-' + live.step : 'scene',
      className: cx('pn-broadcast', 'pn-mode-' + mode, (mode === 'stinger' || mode === 'alert' || (mode === 'outro' && scene.open !== 'hour')) && 'pn-k-breaking'),
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
    var nw = Math.round(full.width * pct(minScale, 0.5));
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
        { id: 'auth', project: 'api-server', name: S.auth.name, state: 'working', detail: '+1,204 −310' },
        { id: 'checkout', project: 'web-shop', name: S.checkout.name, state: 'needs-input', detail: 'Waiting 27 min' },
        { id: 'notes', project: 'docs-site', name: S.notes.name, state: 'ready', detail: '+182 −40' },
        { id: 'sqlite', project: 'desktop-app', name: S.sqlite.name, state: 'working', detail: '+64 −12' }
      ],
      ticker: TICK_HOUR
    },
    'review-seven': {
      mode: 'review',
      clock: '15:00',
      span: '14:00–15:00',
      rows: [
        { id: 'checkout', project: 'web-shop', name: S.checkout.name, state: 'needs-input', detail: 'Waiting 27 min' },
        { id: 'notes', project: 'docs-site', name: S.notes.name, state: 'ready', detail: '+182 −40' },
        { id: 'auth', project: 'api-server', name: S.auth.name, state: 'working', detail: '+1,204 −310' },
        { id: 'sqlite', project: 'desktop-app', name: S.sqlite.name, state: 'working', detail: '+64 −12' },
        { id: 'crash', project: 'mobile-app', name: S.crash.name, state: 'working', detail: '+18 −3' },
        { id: 'search', project: 'search-api', name: S.search.name, state: 'working', detail: '+240 −88' },
        { id: 'runners', project: 'ci-config', name: S.runners.name, state: 'working', detail: '+31 −9' }
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

  /* KLWD WEATHER: the week on Friday at four, 94 hours in, forecast from its
     pace so far. At 48% used the clouds gather and it ends near 86%; at 72%
     it is a storm, which runs out on Sunday at 05:00, passing Friday's close
     at 78% and Saturday's at 96%. */
  var WX_SESSIONS = [
    { id: 'forecast', name: 'Weekly limit forecast (#143)', project: 'pipcast', state: 'working' },
    { id: 'changelog', name: 'Changelog for 1.3.0', project: 'pipcast', state: 'ready' },
    { id: 'sync', name: 'Calendar sync retries', project: 'mamatime', state: 'needs-input' }
  ];
  var WX_ACTIVITY = 'pipcast: editing packages/director/src/forecast.ts';
  var WX_HOUR = { lead: 'ON THE HOUR', text: '2 stories since 15:00' };
  var WX_CLOUDS = {
    outlook: 'clouds',
    used: '48%',
    sky: 'partly',
    word: 'CLOUDS GATHERING',
    strap: 'The week ends near 86%',
    until: 'TO MON 18:00',
    days: [
      { name: 'FRI', sky: 'sun', high: '52%', low: '48%' },
      { name: 'SAT', sky: 'sun', high: '64%', low: '52%' },
      { name: 'SUN', sky: 'partly', high: '77%', low: '64%' },
      { name: 'MON', sky: 'partly', high: '86%', low: '77%' }
    ]
  };
  var WX_STORM = {
    outlook: 'storm',
    used: '72%',
    sky: 'storm',
    word: 'STORM WARNING',
    strap: 'The week runs out Sun around 05:00',
    until: 'TO MON 18:00',
    days: [
      { name: 'FRI', sky: 'partly', high: '78%', low: '72%' },
      { name: 'SAT', sky: 'overcast', high: '97%', low: '78%' },
      { name: 'SUN', sky: 'storm', high: 'OUT', low: '97%', out: true },
      { name: 'MON', sky: 'storm', high: 'OUT', low: '\u2014', out: true }
    ],
    track: { marks: [{ when: 'SAT 00:00', share: '78%', at: 0.23 }, { when: 'SUN 00:00', share: '96%', at: 0.86 }], out: 'SUN 05:00' }
  };
  var WX_CLOUDS_LINE = { lead: 'FORECAST', text: 'Clouds gathering: the week ends near 86%, resets Mon 18:00' };
  var WX_STORM_LINE = { lead: 'FORECAST', text: 'Storm warning: the week runs out Sun around 05:00, resets Mon 18:00' };
  var WX_WARNING_LINE = { lead: 'STORM WARNING', text: 'in effect until Mon 18:00: at this pace the week runs out Sun around 05:00' };
  SAMPLES['weather-now'] = { mode: 'weather-now', clock: '16:00', weather: WX_CLOUDS, ticker: [WX_HOUR, WX_CLOUDS_LINE] };
  SAMPLES['weather-now-storm'] = { mode: 'weather-now', clock: '16:00', weather: WX_STORM, ticker: [WX_HOUR, WX_STORM_LINE] };
  SAMPLES['weather-days'] = { mode: 'weather-days', clock: '16:00', weather: WX_CLOUDS, ticker: [WX_HOUR, WX_CLOUDS_LINE] };
  SAMPLES['weather-days-storm'] = { mode: 'weather-days', clock: '16:00', weather: WX_STORM, ticker: [WX_HOUR, WX_STORM_LINE] };
  /* STORMTRACKER and the board while the warning holds: the crawl's tab reads WARNING and the warning leads it */
  SAMPLES.stormtracker = { mode: 'stormtracker', clock: '15:12', tickerLabel: 'WARNING', weather: WX_STORM, ticker: [WX_WARNING_LINE, WX_ACTIVITY] };
  SAMPLES.alert = { mode: 'alert', clock: '15:12', progress: 1 };
  SAMPLES['board-warning'] = {
    mode: 'board',
    clock: '15:31',
    tickerLabel: 'WARNING',
    sessions: WX_SESSIONS,
    limits: [{ kind: 'session', percent: 58 }, { kind: 'week', percent: 72 }],
    ticker: [WX_WARNING_LINE, WX_ACTIVITY]
  };
  SAMPLES['alert-outro-1'] = outroOf(SAMPLES['board-warning'], 0.4, 'alert');
  /* KLWD WEATHER's pages as the report on the hour airs them, at 15:00 */
  function inReport(scene) {
    return Object.assign({}, scene, { clock: '15:00', ticker: TICK_HOUR.slice(0, 1) });
  }

  /* The account's usage limits under the listing: well inside both on the
     board of every state; past each step on the board of two pages, beside
     its page tab; and on the board under an outro */
  SAMPLES['board-limits'] = Object.assign({}, SAMPLES['board-every-state'], { limits: [{ kind: 'session', percent: 42 }, { kind: 'week', percent: 61 }] });
  SAMPLES['board-limits-near'] = Object.assign({}, SAMPLES['board-seven'], { limits: [{ kind: 'session', percent: 74 }, { kind: 'week', percent: 92 }] });
  SAMPLES['limits-outro'] = outroOf(SAMPLES['board-limits'], 0.8);

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
    /* The same report with a storm in the forecast: KLWD WEATHER follows the review, CURRENT CONDITIONS, EXTENDED FORECAST and STORMTRACKER */
    'hour-weather': [
      { scene: SAMPLES['hour-board'], dur: 2 },
      { scene: SAMPLES['hour-ident-2'], dur: 7.5 },
      { scene: SAMPLES['hour-desk'], dur: 10 },
      { scene: SAMPLES['hour-review'], dur: 10 },
      { scene: inReport(SAMPLES['weather-now-storm']), dur: 10 },
      { scene: inReport(SAMPLES['weather-days-storm']), dur: 10 },
      { scene: inReport(SAMPLES.stormtracker), dur: 13 },
      { scene: outroOf(SAMPLES['hour-return'], 1, 'hour', '15:00'), dur: 1.6 },
      { scene: SAMPLES['hour-return'], dur: 5 }
    ],
    /* STORM WARNING as it airs: WEATHER ALERT, STORMTRACKER, the outro, and back to the board, where the warning holds */
    warning: [
      { scene: SAMPLES['board-warning'], dur: 2 },
      { scene: SAMPLES.alert, dur: 1.9 },
      { scene: SAMPLES.stormtracker, dur: 13 },
      { scene: outroOf(SAMPLES['board-warning'], 1, 'alert'), dur: 1.4 },
      { scene: SAMPLES['board-warning'], dur: 8 }
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
    D2: 73.42, F2: 87.31, G2: 98.0, A2: 110.0, D3: 146.83, F3: 174.61, Fs3: 185.0, G3: 196.0, A3: 220.0,
    Bb3: 233.08, C4: 261.63, Cs4: 277.18, D4: 293.66, E4: 329.63, F4: 349.23, Fs4: 369.99, A4: 440.0,
    C5: 523.25, D5: 587.33, A5: 880.0, D6: 1174.66
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
     lands, ringing on into the desk, where the beat comes in under it (The
     beat, below). */
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
  }

  /* BREAKING NEWS, the outro, 3.4 s. The logo brought back down: its four
     notes, A D A D, walk down on the bells over the brass, one on each of
     the outro's marks (1.2 s), each a little later and softer than the
     last. D minor as the glint crosses the words, G minor as BREAKING
     leaves, A major as NEWS leaves, and the low D, home to D major, as the
     open fades to the board, dying away under it. No riser, no roll, no
     boom and no crash: those say a story is coming. */
  function scoreBreakingOut(m, t0) {
    var steps = [
      { at: 0.1, logo: HZ.A5, chord: [HZ.D3, HZ.F3, HZ.A3, HZ.D4], bass: HZ.D2, drum: HZ.D2, vel: 0.15 },
      { at: 0.34, logo: HZ.D5, chord: [HZ.G3, HZ.Bb3, HZ.D4], bass: HZ.G2, drum: 0, vel: 0.13 },
      { at: 0.62, logo: HZ.A4, chord: [HZ.A3, HZ.Cs4, HZ.E4], bass: HZ.A2, drum: HZ.A2, vel: 0.12 }
    ];
    steps.forEach(function (x, i) {
      var t = t0 + x.at;
      x.chord.forEach(function (f) { brass(m, t, f, 0.18, 0.05 - 0.005 * i); });
      brass(m, t, x.bass, 0.18, 0.04);
      bell(m, t, x.logo, 0.8, x.vel);
      if (x.drum) { timpani(m, t, x.drum, 0.24 - 0.04 * i, 0.5); }
    });
    var end = t0 + 0.96;
    [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4].forEach(function (f) { brass(m, end, f, 0.3, 0.1, 1.4); });
    brass(m, end, HZ.D2, 0.3, 0.06, 1.4);
    timpani(m, end, HZ.D2, 0.45, 1.3);
    bell(m, end, HZ.D4, 1.8, 0.2);
    tremolo(m, end, HZ.A3, 1.8, 0.025);
    tremolo(m, end, HZ.D4, 1.8, 0.02);
  }

  /* More of the scale for the alert */
  HZ.Bb2 = 116.54; HZ.E3 = 164.81; HZ.Cs4 = 277.18; HZ.G4 = 392.0; HZ.E5 = 659.26; HZ.Cs5 = 554.37;

  /* An alert tone: a square tone, clipped short and bright, the way a 90s
     weather bulletin's attention tones cut through a broadcast */
  function alertTone(m, t, f, dur, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.2);
    var o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = f;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vel, t + 0.005);
    g.gain.setValueAtTime(vel, t + dur - 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp);
    lp.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  /* Thunder: a crack of bright noise, then the rumble, low noise that
     swells once more as it rolls away */
  function thunder(m, t, dur, vel) {
    var ctx = m.ctx;
    var out = voice(m, 1, 0.7);
    var crackSrc = ctx.createBufferSource();
    crackSrc.buffer = m.white;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    var cg = ctx.createGain();
    cg.gain.setValueAtTime(0.0001, t);
    cg.gain.exponentialRampToValueAtTime(vel * 0.7, t + 0.004);
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    crackSrc.connect(hp);
    hp.connect(cg);
    cg.connect(out);
    crackSrc.start(t);
    crackSrc.stop(t + 0.25);
    var rumbleSrc = ctx.createBufferSource();
    rumbleSrc.buffer = m.white;
    rumbleSrc.loop = true;
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.exponentialRampToValueAtTime(110, t + dur);
    var rg = ctx.createGain();
    rg.gain.setValueAtTime(0.0001, t);
    rg.gain.exponentialRampToValueAtTime(vel, t + 0.05);
    rg.gain.exponentialRampToValueAtTime(vel * 0.35, t + dur * 0.3);
    rg.gain.exponentialRampToValueAtTime(vel * 0.6, t + dur * 0.45);
    rg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    rumbleSrc.connect(lp);
    lp.connect(rg);
    rg.connect(out);
    rumbleSrc.start(t);
    rumbleSrc.stop(t + dur + 0.05);
  }

  /* WEATHER ALERT, 5.2 s, cut to the open's marks (1.6 s). Three pairs of
     alert tones, high and low on the logo's top notes (D6, A5), as the bolt
     flashes (0, 0.3, 0.6 s); a timpani roll and a riser (0.6-0.95 s); the
     logo's four notes on four hits, as BREAKING NEWS has them, but walking
     into the storm: D minor as WEATHER slams in, B flat as ALERT does, G
     minor, and the last on A, the dominant, with its seventh: the chord
     that doesn't come home, as the warning holds until it lifts. Thunder
     breaks on it with the boom and the crash and rolls away into the map,
     where the beat comes in under it. */
  function scoreWeatherAlert(m, t0) {
    [0, 0.3, 0.6].forEach(function (x) {
      alertTone(m, t0 + x, HZ.D6, 0.12, 0.09);
      alertTone(m, t0 + x + 0.14, HZ.A5, 0.12, 0.09);
    });
    var roll = [0.6, 0.66, 0.71, 0.755, 0.795, 0.83, 0.86, 0.885, 0.91, 0.93];
    riser(m, t0 + 0.6, 0.35, 0.12);
    roll.forEach(function (x, i) { timpani(m, t0 + x, HZ.D2, 0.06 + 0.24 * i / (roll.length - 1), 0.3); });
    var hits = [
      { at: 0.95, logo: HZ.A4, chord: [HZ.D3, HZ.F3, HZ.A3, HZ.D4], drum: HZ.D2, dur: 0.12 },
      { at: 1.15, logo: HZ.D5, chord: [HZ.F3, HZ.Bb3, HZ.D4], drum: HZ.Bb2, dur: 0.12 },
      { at: 1.35, logo: HZ.A5, chord: [HZ.G3, HZ.Bb3, HZ.D4, HZ.G4], drum: HZ.G2, dur: 0.14 },
      { at: 1.6, logo: HZ.D6, chord: [HZ.A2, HZ.E3, HZ.A3, HZ.Cs4, HZ.G4], drum: HZ.A2, dur: 1.3 }
    ];
    hits.forEach(function (x, i) {
      var last = i === hits.length - 1;
      x.chord.forEach(function (f) { brass(m, t0 + x.at, f, x.dur, last ? 0.15 : 0.065, last ? 1.2 : 0.28); });
      timpani(m, t0 + x.at, x.drum, last ? 1 : 0.35, last ? 1.4 : 0.6);
      bell(m, t0 + x.at, x.logo, last ? 1.8 : 0.55, last ? 0.28 : 0.17);
    });
    boom(m, t0 + 0.95, 0.2);
    boom(m, t0 + 1.6, 1);
    crash(m, t0 + 1.6, 0.45);
    thunder(m, t0 + 1.6, 3.4, 0.5);
    brass(m, t0 + 1.6, HZ.A2, 1.3, 0.1, 1.2);
    tremolo(m, t0 + 1.6, HZ.Cs5, 2.2, 0.045);
    tremolo(m, t0 + 1.6, HZ.E5, 2.2, 0.035);
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

  /* The beat: the newsroom pulse under the desks, sixteenths on the logo's
     notes and a soft drum on every beat, about 132 to the minute. It comes in
     with a desk and plays on under the review, for as long as they run, and
     goes when the outro comes: it mixes in over `fadeIn` seconds on the last
     notes of its line, rising evenly from silence, so that its first downbeat
     lands at full, and phases out over `fadeOut`, falling as the square of
     what is left, so it carries into the outro's first chord and is gone
     before its second. The station loops one turn of it, its line of eight
     notes: 43,648 frames at 48 kHz, a whole number of frames and of Web
     Audio's 128-frame blocks, so every turn renders the same and the loop
     comes round to the frame. `third` is the line's one note that sets the
     key: F in D minor under BREAKING NEWS, F sharp in D major under the hour. */
  var BEAT = { turn: 43648 / 48000, warm: 6, fadeIn: 0.3, fadeOut: 0.5 };
  var BEDS = { 'beat-minor': HZ.F4, 'beat-major': HZ.Fs4 };
  /* `turns` of the line from `t0`, leaving out what falls before `from` */
  function beat(m, t0, turns, third, from) {
    var step = BEAT.turn / 8;
    var line = [HZ.D4, HZ.D4, HZ.A4, HZ.D4, third, HZ.D4, HZ.A4, HZ.D4];
    for (var k = 0; k < turns * 8; k++) {
      var t = t0 + k * step;
      if (from !== undefined && t < from - 1e-6) { continue; }
      tick(m, t, line[k % 8], 0.133);
      if (k % 4 === 0) { timpani(m, t, HZ.D2, 0.36, 0.5); }
    }
  }
  /* The beat live, from `at` until `until`, through gains of its own that mix
     it in and phase it out as the station does, its first downbeat as it
     reaches full; the hall rings on after it */
  function playBed(m, name, at, until) {
    var ctx = m.ctx;
    var dry = ctx.createGain();
    var send = ctx.createGain();
    dry.connect(m.dry);
    send.connect(m.send);
    var end = Math.max(until, at + BEAT.fadeIn);
    var out = new Float32Array(32);
    for (var i = 0; i < out.length; i++) { out[i] = Math.pow(1 - i / (out.length - 1), 2); }
    [dry.gain, send.gain].forEach(function (g) {
      g.setValueAtTime(0, at);
      g.linearRampToValueAtTime(1, at + BEAT.fadeIn);
      g.setValueCurveAtTime(out, end, BEAT.fadeOut);
    });
    var from = at + BEAT.fadeIn - BEAT.turn;
    beat({ ctx: ctx, dry: dry, send: send, white: m.white }, from, Math.ceil((end + BEAT.fadeOut - from) / BEAT.turn), BEDS[name], at);
  }

  var JINGLES = {
    breaking: { duration: 5.8, score: scoreBreaking },
    'breaking-out': { duration: 3.4, score: scoreBreakingOut },
    hour: { duration: 9.6, score: scoreHour },
    'hour-out': { duration: 3.6, score: scoreHourOut },
    'weather-alert': { duration: 5.2, score: scoreWeatherAlert }
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
     clock): a segment's intro and outro. An entry with `bed` plays the beat
     from `at`, mixing in, and phases it out from `until`. Returns a function
     that fades all. */
  function playJingles(list) {
    var ctx = audioContext();
    if (!ctx) { return function () {}; }
    if (PLAYING) { PLAYING(); }
    var out = ctx.createGain();
    out.connect(ctx.destination);
    var m = mixer(ctx, out);
    list.forEach(function (x) {
      var at = Math.max(ctx.currentTime + 0.02, num(x.at, 0));
      if (x.bed && BEDS[x.bed]) {
        playBed(m, x.bed, at, Math.max(at, num(x.until, at)));
        return;
      }
      var j = JINGLES[x.name];
      if (j) { j.score(m, at); }
    });
    PLAYING = function () {
      var now = ctx.currentTime;
      out.gain.setValueAtTime(out.gain.value, now);
      out.gain.linearRampToValueAtTime(0, now + 0.08);
      window.setTimeout(function () { out.disconnect(); }, 200);
    };
    return PLAYING;
  }
  /* Renders a jingle offline, for files and tests: resolves to an AudioBuffer.
     A bed's name renders its loop (renderBed). */
  function renderJingle(name, sampleRate) {
    if (BEDS[name]) { return renderBed(name); }
    var j = JINGLES[name];
    var C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!j || !C) { return Promise.reject(new Error('no jingle or no offline audio')); }
    var sr = num(sampleRate, 44100);
    var ctx = new C(2, Math.ceil(sr * j.duration), sr);
    var m = mixer(ctx, ctx.destination);
    j.score(m, 0.02);
    return ctx.startRendering();
  }

  /* A bed's loop: one turn of the beat at 48 kHz, the last of a run of
     `warm` + 1 turns, so the hall and the mix have settled and the turn
     carries the ring of the ones before it, as it does when it comes round
     again. */
  function renderBed(name) {
    var C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    var third = BEDS[name];
    if (!third || !C) { return Promise.reject(new Error('no bed or no offline audio')); }
    var rate = 48000;
    var turn = Math.round(BEAT.turn * rate);
    var ctx = new C(2, (BEAT.warm + 1) * turn, rate);
    var m = mixer(ctx, ctx.destination);
    beat(m, 0, BEAT.warm + 1, third);
    return ctx.startRendering().then(function (all) {
      var part = ctx.createBuffer(2, turn, rate);
      for (var ch = 0; ch < 2; ch++) {
        part.getChannelData(ch).set(all.getChannelData(ch).subarray(BEAT.warm * turn, (BEAT.warm + 1) * turn));
      }
      return part;
    });
  }

  /* Review-board furniture, never part of the window: the window playing a
     run, and under it a button that plays the run again from the start with
     its sound, as the station plays it: BREAKING NEWS as each intro starts,
     the hour's jingle as its ident starts, the beat mixing in as their desk
     starts, in D minor or D major, and phasing out as the outro starts with
     its own jingle. A run with none of them plays `jingle` at `cue`. */
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
      var key = null;
      var bed = null;
      (RUNS[props.sample] || []).forEach(function (step) {
        var mode = step.scene.mode;
        var t = ctx.currentTime + at;
        if (mode === 'stinger') { list.push({ name: 'breaking', at: t }); key = 'beat-minor'; }
        if (mode === 'ident') { list.push({ name: 'hour', at: t }); key = 'beat-major'; }
        if (mode === 'alert') { list.push({ name: 'weather-alert', at: t }); key = 'beat-minor'; }
        if ((mode === 'desk' || mode === 'review' || mode === 'weather-now' || mode === 'weather-days' || mode === 'stormtracker') && key && !bed) { bed = { bed: key, at: t }; }
        if (mode === 'outro') {
          list.push({ name: step.scene.open === 'hour' ? 'hour-out' : 'breaking-out', at: t });
          if (bed) { bed.until = t; list.push(bed); }
          key = null;
          bed = null;
        }
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
    Backdrop: Backdrop,
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
    WeatherIcon: WeatherIcon,
    WeatherNow: WeatherNow,
    WeatherDays: WeatherDays,
    Stormtracker: Stormtracker,
    AlertOpen: AlertOpen,
    Clawd: Clawd,
    Mark: Mark,
    Stage: Stage,
    crawlStep: crawlStep,
    crawlRun: crawlRun,
    crawlSpeed: CRAWL_SPEED,
    weatherIconMarkup: weatherIconMarkup,
    drawn: drawn,
    stormScene: stormScene,
    WEATHER: WEATHER,
    OUTLOOKS: OUTLOOKS,
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
    jingles: Object.keys(JINGLES),
    beds: Object.keys(BEDS),
    beat: BEAT
  };
})();
