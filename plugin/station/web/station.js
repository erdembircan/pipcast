(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __commonJS = (cb, mod) => function __require() {
    try {
      return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
    } catch (e) {
      throw mod = 0, e;
    }
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));

  // react-global:React
  var require_React = __commonJS({
    "react-global:React"(exports, module) {
      module.exports = window.React;
    }
  });

  // react-global:ReactDOM
  var require_ReactDOM = __commonJS({
    "react-global:ReactDOM"(exports, module) {
      module.exports = window.ReactDOM;
    }
  });

  // packages/renderer/src/react-global.ts
  var React2 = __toESM(require_React(), 1);
  var ReactDOM = __toESM(require_ReactDOM(), 1);
  var host = window;
  host.React = React2;
  host.ReactDOM = ReactDOM;

  // packages/renderer/src/main.tsx
  var import_client = __toESM(require_ReactDOM(), 1);

  // packages/renderer/src/App.tsx
  var import_react = __toESM(require_React(), 1);

  // packages/contract/src/constants.ts
  var STORY_FRESH_MS = 12e4;
  var WEATHER_MAX_POINTS = 200;

  // packages/contract/src/format.ts
  var MINUS = "\u2212";
  function plural(n, one, many) {
    return n === 1 ? one : many;
  }
  function thousands(n) {
    const digits = String(Math.round(Math.abs(n)));
    let out = "";
    for (let i = 0; i < digits.length; i += 1) {
      const left = digits.length - i;
      out += digits.charAt(i);
      if (left > 1 && left % 3 === 1) {
        out += ",";
      }
    }
    return out;
  }
  function figure(added, removed) {
    return `+${thousands(added)} ${MINUS}${thousands(removed)}`;
  }
  function pad2(n) {
    return n < 10 ? `0${n}` : String(n);
  }
  function clock(ms) {
    const d = new Date(ms);
    return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  }
  function hourStart(ms) {
    const d = new Date(ms);
    d.setMinutes(0, 0, 0);
    return d.getTime();
  }
  function hourLabel(ms) {
    return `${pad2(new Date(ms).getHours())}:00`;
  }
  function hourKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}`;
  }
  function wholeMinutes(ms) {
    return Math.max(0, Math.floor(ms / 6e4));
  }
  function duration(ms) {
    const seconds = Math.max(1, Math.round(ms / 1e3));
    if (seconds < 60) {
      return `${seconds} s`;
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  function waited(ms) {
    const seconds = Math.max(0, Math.floor(ms / 1e3));
    if (seconds < 3600) {
      return `${Math.floor(seconds / 60)}:${pad2(seconds % 60)}`;
    }
    const minutes = Math.floor(seconds / 60);
    const rest = minutes % 60;
    const hours = Math.floor(minutes / 60);
    return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
  }
  var DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  function dayTime(ms) {
    return `${DAYS[new Date(ms).getDay()]} ${clock(ms)}`;
  }
  function aroundTime(ms) {
    const hour = hourStart(ms + 30 * 6e4);
    return `${DAYS[new Date(hour).getDay()]} around ${hourLabel(hour)}`;
  }
  function dayName(ms) {
    return (DAYS[new Date(ms).getDay()] ?? "").toUpperCase();
  }

  // packages/contract/src/copy.ts
  var OPTION_WORDS = {
    auto: {
      title: "Tune in every new session",
      on: "Each new session in the desktop app tunes in to KLWD as it opens.",
      off: "A new session waits for TUNE IN."
    },
    transparency: {
      title: "Transparent window",
      on: "KLWD fades to 40% while the pointer is elsewhere, so what is under it shows through.",
      off: "KLWD stays solid."
    }
  };
  var COMMAND_ARGUMENT_HINT = `[${Object.keys(OPTION_WORDS).join("|")} on|off]`;
  var LEAD = {
    comingUp: "COMING UP",
    breaking: "BREAKING",
    stillWaiting: "STILL WAITING",
    ready: "READY",
    onTheHour: "ON THE HOUR",
    onTheDesk: "ON THE DESK",
    forecast: "FORECAST",
    stormWarning: "STORM WARNING"
  };
  function storyLine(kind, title) {
    switch (kind) {
      case "needs-input":
        return `${title} needs your input`;
      case "ready":
        return `${title} ready for review`;
      case "complete":
        return `${title}: work complete`;
      case "error":
        return `${title} stopped on an error`;
    }
  }
  function stillWaitingLine(kind, title, minutes) {
    const line = storyLine(kind, title);
    return minutes >= 1 ? `${line} \xB7 ${minutes} min` : line;
  }
  function waitingForReviewLine(title) {
    return `${title} waiting for review`;
  }
  function reportComingUp(hour) {
    return `The ${hour} report`;
  }
  function afterReportLine(stories, hour, nextHour) {
    if (stories === 0) {
      return `A quiet hour \xB7 next report ${nextHour}`;
    }
    return `${stories} ${plural(stories, "story", "stories")} at ${hour} \xB7 next report ${nextHour}`;
  }
  function hourSoFarLine(stories, from, working, onAir) {
    if (stories === 0) {
      return `A quiet hour: ${deskLine(working, onAir)}`;
    }
    return `${stories} ${plural(stories, "story", "stories")} since ${from}`;
  }
  function deskLine(working, onAir) {
    if (working > 0) {
      return `${working} ${plural(working, "session", "sessions")} working`;
    }
    return `${onAir} ${plural(onAir, "session", "sessions")} on KLWD`;
  }
  function activityLine(project, text) {
    return `${project}: ${text}`;
  }
  function waitingFoot(waited2) {
    return `Waiting ${waited2}`;
  }
  function finishedFoot(took2) {
    return `Finished in ${took2}`;
  }
  function stoppedFoot(took2) {
    return `Stopped after ${took2}`;
  }
  var FINISHED = "Finished";
  function filesChanged(n) {
    return `${n} ${plural(n, "file", "files")} changed`;
  }
  var ERROR_WORDS = {
    authentication_failed: "Claude is signed out. Sign in again to carry on.",
    oauth_org_not_allowed: "This organization cannot use Claude Code here.",
    account_on_hold: "The account is on hold.",
    verification_required: "The account needs verifying before Claude can carry on.",
    billing_error: "There is a billing problem with the account.",
    rate_limit: "Claude hit its usage limit. It can carry on once the limit resets.",
    overloaded: "Claude is overloaded right now. Try again in a moment.",
    invalid_request: "Claude sent a request the API could not accept.",
    model_not_found: "The model this session uses is not available.",
    server_error: "Claude ran into a server error. Try again in a moment.",
    unknown: "Claude stopped on an error.",
    max_output_tokens: "Claude\u2019s reply ran too long and was cut off.",
    cloud_credential_error: "The cloud credentials for Claude are not working."
  };
  function errorWords(kind) {
    return ERROR_WORDS[kind] ?? ERROR_WORDS.unknown;
  }
  function hourHeadline(stories) {
    if (stories === 0) {
      return "A QUIET HOUR";
    }
    return stories === 1 ? "1 STORY" : `${stories} STORIES`;
  }
  function hourStrap(counts) {
    const parts = [];
    if (counts.needsInput > 0) {
      parts.push(`${counts.needsInput} ${plural(counts.needsInput, "needs", "need")} you`);
    }
    if (counts.ready > 0) {
      parts.push(`${counts.ready} ready for review`);
    }
    if (counts.complete > 0) {
      parts.push(`${counts.complete} finished`);
    }
    if (counts.error > 0) {
      parts.push(`${counts.error} stopped on an error`);
    }
    return parts.join(" \xB7 ");
  }
  function quietStrap(working) {
    if (working > 0) {
      return `${working} ${plural(working, "session", "sessions")} working, nothing needs you`;
    }
    return "Nothing needs you";
  }
  function acrossSessions(n) {
    return `Across ${n} ${plural(n, "session", "sessions")}`;
  }
  function hourFoot(from, to) {
    return `${from} to ${to}`;
  }
  function reviewSpan(from, to) {
    return `${from}\u2013${to}`;
  }
  function reviewDetail(row) {
    switch (row.kind) {
      case "waiting":
        return row.minutes >= 1 ? `Waiting ${row.minutes} min` : "Waiting";
      case "error":
        return "Stopped on an error";
      case "lines":
        return row.added + row.removed > 0 ? figure(row.added, row.removed) : "No changes this hour";
    }
  }
  var OUTLOOK_WORDS = {
    clear: "CLEAR SKIES",
    clouds: "CLOUDS GATHERING",
    storm: "STORM WARNING"
  };
  var WEATHER = {
    // KLWD WEATHER's pages
    now: "CURRENT CONDITIONS",
    days: "EXTENDED FORECAST",
    tracker: "STORMTRACKER",
    // Over CURRENT CONDITIONS's figure
    week: "THE WEEK",
    // STORMTRACKER's list, and the pin where the storm forms
    arrival: "TIME OF ARRIVAL",
    start: "NOW",
    // A day the week has run out by, and a low on a day after it
    out: "OUT",
    none: "\u2014",
    // WEATHER ALERT's open
    alert: ["WEATHER", "ALERT"]
  };
  function forecastLine(outlook, end, resets) {
    const sky = outlook === "clear" ? "Clear skies" : "Clouds gathering";
    return `${sky}: the week ends near ${end}%, resets ${resets}`;
  }
  function forecastStartsLine(starts) {
    return `The week\u2019s outlook starts ${starts}`;
  }
  function forecastOutLine(resets) {
    return `The week is used up until it resets ${resets}`;
  }
  function warningLine(runsOut, resets) {
    return `in effect until ${resets}: at this pace the week runs out ${runsOut}`;
  }
  function weatherStrap(outlook, end, runsOut) {
    return outlook === "storm" ? `The week runs out ${runsOut}` : `The week ends near ${end}%`;
  }
  function untilTab(resets) {
    return `TO ${resets.toUpperCase()}`;
  }

  // packages/contract/src/validate.ts
  var LIMIT_KINDS = ["session", "week"];
  function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
  function isNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }
  function isLimitKind(value) {
    return typeof value === "string" && LIMIT_KINDS.includes(value);
  }
  function parseLimit(value) {
    if (!isObject(value)) {
      return null;
    }
    const { kind, percentUsed, resetsAt, at: at2 } = value;
    if (!isLimitKind(kind) || !isNumber(percentUsed) || !isNumber(at2)) {
      return null;
    }
    return { kind, percentUsed, resetsAt: isNumber(resetsAt) ? resetsAt : null, at: at2 };
  }
  function parseList(value, parseItem) {
    if (!Array.isArray(value)) {
      return [];
    }
    const out = [];
    for (const item of value) {
      const parsed = parseItem(item);
      if (parsed !== null) {
        out.push(parsed);
      }
    }
    return out;
  }
  function parseLimits(value) {
    return parseList(value, parseLimit);
  }
  function parseWeather(value) {
    if (!isObject(value) || value.v !== 1) {
      return null;
    }
    const points = [];
    if (Array.isArray(value.points)) {
      for (const entry of value.points) {
        if (!Array.isArray(entry) || entry.length !== 2) {
          continue;
        }
        const [at2, percent] = entry;
        if (!isNumber(at2) || !isNumber(percent)) {
          continue;
        }
        const last = points[points.length - 1];
        if (last !== void 0 && at2 <= last[0]) {
          continue;
        }
        points.push([at2, Math.min(100, Math.max(0, percent))]);
      }
    }
    return {
      v: 1,
      resetsAt: isNumber(value.resetsAt) ? value.resetsAt : null,
      points: points.slice(-WEATHER_MAX_POINTS),
      warnedAt: isNumber(value.warnedAt) ? value.warnedAt : null
    };
  }

  // packages/director/src/timing.ts
  var STINGER_MS = 1900;
  var DESK_MS = 1e4;
  var STORY_OUTRO_MS = 1400;
  var IDENT_MS = 7500;
  var REVIEW_MS = 1e4;
  var REVIEW_ROWS = 4;
  var HOUR_OUTRO_MS = 1600;
  var WEATHER_PAGE_MS = 1e4;
  var STORMTRACKER_MS = 13e3;
  var ALERT_MS = 1900;
  var ALERT_OUTRO_MS = 1400;
  var REDUCED_OPENER_MS = 1e3;
  var GAP_MS = 2e3;
  var IDENT_LEAD_MS = 5e3;
  var BREAKING_MS = 4e4;
  var AFTER_REPORT_MS = 10 * 6e4;
  var LAST_REPORT_KEEP_MS = 24 * 60 * 6e4;
  var HOUR_MS = 60 * 6e4;
  var WARNING_EVERY_MS = 60 * 6e4;

  // packages/director/src/story.ts
  function newest(stories, kind) {
    let found;
    for (const story of stories) {
      if (story.kind === kind && (found === void 0 || story.at >= found.at)) {
        found = story;
      }
    }
    return found;
  }
  function findSession(snapshot, sessionId) {
    return snapshot?.sessions.find((session) => session.id === sessionId);
  }
  function movedOn(snapshot, sessionId, story) {
    const session = findSession(snapshot, sessionId);
    if (session === void 0) {
      return true;
    }
    switch (story.kind) {
      case "needs-input":
      case "error":
        return session.state !== story.kind || newest(session.stories, story.kind)?.id !== story.id;
      case "ready":
      case "complete": {
        const index = session.stories.findIndex((other) => other.id === story.id);
        if (index < 0) {
          return true;
        }
        const newer = session.stories.some((other, i) => i > index || other.at > story.at);
        return newer || session.state === "working" && session.stateAt > story.at;
      }
    }
  }
  var ACT = {
    "needs-input": "urgent",
    ready: "cheer",
    complete: "talk",
    error: "glance"
  };
  function took(story) {
    return story.durationMs === void 0 ? void 0 : duration(story.durationMs);
  }
  function deskEvent(now, story, title, project) {
    const event = { kind: story.kind, session: title, project };
    switch (story.kind) {
      case "needs-input":
        if (story.command !== void 0) {
          event.command = story.command;
        }
        if (story.quote !== void 0) {
          event.quote = story.quote;
        }
        event.foot = waitingFoot(waited(now - story.at));
        break;
      case "ready": {
        event.figure = figure(story.added ?? 0, story.removed ?? 0);
        event.sub = filesChanged(story.files ?? 0);
        const length = took(story);
        if (length !== void 0) {
          event.foot = finishedFoot(length);
        }
        break;
      }
      case "complete": {
        event.quote = story.quote || FINISHED;
        const length = took(story);
        if (length !== void 0) {
          event.foot = finishedFoot(length);
        }
        break;
      }
      case "error": {
        event.quote = story.quote || errorWords("unknown");
        const length = took(story);
        if (length !== void 0) {
          event.foot = stoppedFoot(length);
        }
        break;
      }
    }
    return event;
  }
  function storySegment(sessionId, story, snapshot, reducedMotion) {
    const session = findSession(snapshot, sessionId);
    const title = session?.title ?? "";
    const project = session?.project ?? "";
    const opener = {
      role: "opener",
      length: reducedMotion ? REDUCED_OPENER_MS : STINGER_MS,
      cue: "breaking",
      scene: ({ now }) => ({ mode: "stinger", clock: clock(now), progress: 1, event: { kind: story.kind } })
    };
    const desk = {
      role: "desk",
      length: DESK_MS,
      // The beat comes in with the desk, under BREAKING NEWS's ring
      bed: "beat-minor",
      scene: ({ now, ticker: ticker2 }) => ({
        mode: "desk",
        clock: clock(now),
        act: ACT[story.kind],
        event: deskEvent(now, story, title, project),
        ticker: ticker2
      })
    };
    const outro = {
      role: "outro",
      length: STORY_OUTRO_MS,
      cue: "breaking-out",
      scene: ({ now, board }) => ({ mode: "outro", clock: clock(now), progress: 1, board })
    };
    const id = `story:${story.id}`;
    const ticker = () => ({
      lead: { lead: LEAD.breaking, text: storyLine(story.kind, title), key: `on-air:${story.id}` },
      skipWaitingFor: sessionId
    });
    if (reducedMotion) {
      return { id, steps: [opener, desk], endCue: "breaking-out", ticker };
    }
    return { id, steps: [opener, desk, outro], ticker };
  }

  // packages/director/src/forecast.ts
  var WEEK_MS = 7 * 24 * HOUR_MS;
  var DAY_MS = 24 * HOUR_MS;
  var SHORT_GAP_MS = 2 * HOUR_MS;
  var HALF_LIFE_MS = 72 * HOUR_MS;
  var PROFILE_PRIOR_HOURS = 1;
  var PRIOR_CV = 0.6;
  var PRIOR_WEIGHT = 2;
  var MIN_ELAPSED_MS = 24 * HOUR_MS;
  var MIN_SHORT_HOURS = 6;
  var MAX_POINTS = 200;
  var RESET_TOLERANCE_MS = 10 * 6e4;
  var STORM_CHANCE = 0.5;
  var CLOUDS_END = 70;
  function clamp(value, low, high) {
    return Math.min(high, Math.max(low, value));
  }
  function at(array, index) {
    return array[index] ?? 0;
  }
  function recordReading(history, reading) {
    if (reading.at < reading.resetsAt - WEEK_MS || reading.at > reading.resetsAt) {
      return history;
    }
    const percent = clamp(reading.percent, 0, 100);
    const last = history === null ? void 0 : history.points[history.points.length - 1];
    if (history === null || Math.abs(reading.resetsAt - history.resetsAt) > RESET_TOLERANCE_MS) {
      return { resetsAt: reading.resetsAt, points: [[reading.at, percent]] };
    }
    let points = history.points;
    if (last !== void 0) {
      if (reading.at <= last[0]) {
        return history;
      }
      if (percent < last[1]) {
        return history;
      }
      if (hourStart(reading.at) === hourStart(last[0])) {
        points = points.slice(0, -1);
      }
    }
    points = [...points, [reading.at, percent]];
    return { resetsAt: history.resetsAt, points: points.slice(-MAX_POINTS) };
  }
  function hourlyPoints(points) {
    const out = [];
    for (const [at2, percent] of points) {
      const last = out[out.length - 1];
      if (last !== void 0 && hourStart(last[0]) === hourStart(at2)) {
        out[out.length - 1] = [at2, percent];
      } else {
        out.push([at2, percent]);
      }
    }
    return out;
  }
  function lnGamma(z) {
    const c = [
      0.9999999999998099,
      676.5203681218851,
      -1259.1392167224028,
      771.3234287776531,
      -176.6150291621406,
      12.507343278686905,
      -0.13857109526572012,
      9984369578019572e-21,
      15056327351493116e-23
    ];
    if (z < 0.5) {
      return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    }
    const x0 = z - 1;
    let sum = at(c, 0);
    for (let i = 1; i < 9; i += 1) {
      sum += at(c, i) / (x0 + i);
    }
    const t = x0 + 7.5;
    return 0.5 * Math.log(2 * Math.PI) + (x0 + 0.5) * Math.log(t) - t + Math.log(sum);
  }
  function gammaP(a, x) {
    if (x <= 0) {
      return 0;
    }
    if (x < a + 1) {
      let sum = 1 / a;
      let term = sum;
      let ap = a;
      for (let n = 0; n < 500; n += 1) {
        ap += 1;
        term *= x / ap;
        sum += term;
        if (Math.abs(term) < Math.abs(sum) * 1e-12) {
          break;
        }
      }
      return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a));
    }
    let b = x + 1 - a;
    let c = 1 / 1e-300;
    let d = 1 / b;
    let h = d;
    for (let i = 1; i < 500; i += 1) {
      const an = -i * (i - a);
      b += 2;
      d = an * d + b;
      if (Math.abs(d) < 1e-300) {
        d = 1e-300;
      }
      c = b + an / c;
      if (Math.abs(c) < 1e-300) {
        c = 1e-300;
      }
      d = 1 / d;
      const delta = d * c;
      h *= delta;
      if (Math.abs(delta - 1) < 1e-12) {
        break;
      }
    }
    return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h;
  }
  function gammaMedian(shape, scale) {
    const mean = shape * scale;
    let low = 0;
    let high = mean + 12 * Math.sqrt(shape) * scale;
    for (let step = 0; step < 60; step += 1) {
      const middle = (low + high) / 2;
      if (gammaP(shape, middle / scale) < 0.5) {
        low = middle;
      } else {
        high = middle;
      }
    }
    return (low + high) / 2;
  }
  function closesBetween(now, resetsAt) {
    const closes = [];
    for (let date = new Date(now); ; ) {
      date = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      if (date.getTime() >= resetsAt) {
        break;
      }
      closes.push(date.getTime());
    }
    closes.push(resetsAt);
    return closes.slice(0, 7);
  }
  function profile(x, e, hods, binStarts, now, weighted) {
    const sums = new Array(24).fill(0);
    const exposures = new Array(24).fill(0);
    let total = 0;
    let observed = 0;
    for (let j = 0; j < x.length; j += 1) {
      const exposure = at(e, j);
      if (!(exposure > 0)) {
        continue;
      }
      const k = at(hods, j);
      const weight = weighted ? Math.pow(0.5, (now - (at(binStarts, j) + HOUR_MS / 2)) / HALF_LIFE_MS) : 1;
      sums[k] = at(sums, k) + weight * at(x, j);
      exposures[k] = at(exposures, k) + weight * exposure;
      total += weight * at(x, j);
      observed += weight * exposure;
    }
    const overall = observed > 0 ? total / observed : 0;
    const rates = sums.map((sum, k) => (sum + PROFILE_PRIOR_HOURS * overall) / (at(exposures, k) + PROFILE_PRIOR_HOURS));
    return rates.map((rate, k) => 0.25 * at(rates, (k + 23) % 24) + 0.5 * rate + 0.25 * at(rates, (k + 1) % 24));
  }
  function forecastWeek(history, usedNow, now) {
    const reset = history.resetsAt;
    const start = reset - WEEK_MS;
    if (now >= reset) {
      return null;
    }
    const used = clamp(usedNow, 0, 100);
    const base = { computedAt: now, resetsAt: reset, used };
    if (used >= 100) {
      return { ...base, outlook: "out", startsAt: null, end: used, chance: 1, runsOutAt: null, days: [] };
    }
    if (now - start < MIN_ELAPSED_MS) {
      return { ...base, outlook: "early", startsAt: start + MIN_ELAPSED_MS, end: used, chance: 0, runsOutAt: null, days: [] };
    }
    const closes = closesBetween(now, reset);
    const points = history.points.filter(([when]) => when >= start && when <= now);
    const lastAt = points.length > 0 ? points[points.length - 1][0] : now;
    const origin = hourStart(start);
    const bins = Math.max(0, Math.ceil((lastAt - origin) / HOUR_MS));
    const binStarts = [];
    const hods = [];
    const exposure = [];
    for (let j = 0; j < bins; j += 1) {
      const binStart = origin + j * HOUR_MS;
      binStarts.push(binStart);
      hods.push(new Date(binStart).getHours());
      exposure.push(Math.max(0, (Math.min(lastAt, binStart + HOUR_MS) - Math.max(start, binStart)) / HOUR_MS));
    }
    function spread(into, from, to, amount, weightOf) {
      if (amount <= 0 || to <= from) {
        return;
      }
      const first2 = Math.floor((from - origin) / HOUR_MS);
      const last = Math.ceil((to - origin) / HOUR_MS) - 1;
      const parts = [];
      let total = 0;
      for (let j = first2; j <= last; j += 1) {
        const overlap = (Math.min(to, at(binStarts, j) + HOUR_MS) - Math.max(from, at(binStarts, j))) / HOUR_MS;
        if (overlap > 0) {
          const weight = overlap * weightOf(at(hods, j));
          parts.push([j, weight]);
          total += weight;
        }
      }
      if (total <= 0) {
        total = 0;
        for (const part of parts) {
          const j = part[0];
          part[1] = (Math.min(to, at(binStarts, j) + HOUR_MS) - Math.max(from, at(binStarts, j))) / HOUR_MS;
          total += part[1];
        }
      }
      for (const [j, weight] of parts) {
        into[j] = at(into, j) + amount * weight / total;
      }
    }
    const intervals = [];
    let previous = [start, 0];
    for (const point of points) {
      intervals.push([previous[0], point[0], Math.max(0, point[1] - previous[1])]);
      previous = point;
    }
    const short = new Array(bins).fill(0);
    const shortExposure = new Array(bins).fill(0);
    for (const [from, to, amount] of intervals) {
      if (to - from > SHORT_GAP_MS) {
        continue;
      }
      spread(short, from, to, amount, () => 1);
      for (let j = Math.floor((from - origin) / HOUR_MS); j <= Math.ceil((to - origin) / HOUR_MS) - 1; j += 1) {
        const overlap = (Math.min(to, at(binStarts, j) + HOUR_MS) - Math.max(from, at(binStarts, j))) / HOUR_MS;
        if (overlap > 0) {
          shortExposure[j] = at(shortExposure, j) + overlap;
        }
      }
    }
    const covered = shortExposure.reduce((sum, hours) => sum + hours, 0);
    const first = covered >= MIN_SHORT_HOURS ? profile(short, shortExposure, hods, binStarts, now, false) : null;
    const hourly = new Array(bins).fill(0);
    for (const [from, to, amount] of intervals) {
      const byProfile = to - from > SHORT_GAP_MS && first !== null;
      spread(hourly, from, to, amount, byProfile ? (hod) => at(first, hod) : () => 1);
    }
    const rates = profile(hourly, exposure, hods, binStarts, now, true);
    const daily = rates.reduce((sum, rate) => sum + rate, 0);
    const expected = [];
    let cum = used;
    let closeIndex = 0;
    for (let t = hourStart(now); t < reset; t += HOUR_MS) {
      const lo = Math.max(now, t);
      const hi = Math.min(reset, t + HOUR_MS);
      if (hi <= lo) {
        continue;
      }
      const rate = at(rates, new Date(t).getHours());
      while (closeIndex < closes.length && at(closes, closeIndex) <= hi) {
        expected.push(cum + rate * (at(closes, closeIndex) - lo) / HOUR_MS);
        closeIndex += 1;
      }
      cum += rate * (hi - lo) / HOUR_MS;
    }
    const remaining = cum - used;
    const wholeDays = Math.floor((lastAt - start) / DAY_MS);
    const totals = [];
    for (let i = 0; i < wholeDays; i += 1) {
      let total = 0;
      for (let j = 0; j < bins; j += 1) {
        const middle = at(binStarts, j) + HOUR_MS / 2;
        if (middle > lastAt - (i + 1) * DAY_MS && middle <= lastAt - i * DAY_MS) {
          total += at(hourly, j);
        }
      }
      totals.push(total);
    }
    const dayMean = totals.length > 0 ? totals.reduce((sum, value) => sum + value, 0) / totals.length : daily;
    const dayVariance = totals.length >= 2 ? totals.reduce((sum, value) => sum + (value - dayMean) ** 2, 0) / (totals.length - 1) : 0;
    const prior = (PRIOR_CV * Math.max(daily, dayMean)) ** 2;
    const degrees = Math.max(0, wholeDays - 1);
    const variance = (degrees * dayVariance + PRIOR_WEIGHT * prior) / (degrees + PRIOR_WEIGHT);
    const daysLeft = (reset - now) / DAY_MS;
    const spreadOfRemaining = daysLeft * variance + daysLeft * daysLeft * variance / Math.max(1, wholeDays);
    const need = 100 - used;
    let chance;
    let median;
    if (remaining <= 0) {
      chance = 0;
      median = 0;
    } else if (spreadOfRemaining <= 0) {
      chance = remaining >= need ? 1 : 0;
      median = remaining;
    } else {
      const shape = remaining * remaining / spreadOfRemaining;
      const scale2 = spreadOfRemaining / remaining;
      chance = 1 - gammaP(shape, need / scale2);
      median = gammaMedian(shape, scale2);
    }
    const scale = remaining > 0 ? median / remaining : 0;
    const days = [];
    let low = used;
    closes.forEach((closesAt, i) => {
      const high = used + (at(expected, i) - used) * scale;
      days.push({ closesAt, low, high });
      low = high;
    });
    const end = used + median;
    let runsOutAt = null;
    let central = used;
    for (let t = hourStart(now); t < reset && runsOutAt === null; t += HOUR_MS) {
      const lo = Math.max(now, t);
      const hi = Math.min(reset, t + HOUR_MS);
      if (hi <= lo) {
        continue;
      }
      const rate = at(rates, new Date(t).getHours()) * scale;
      const add = rate * (hi - lo) / HOUR_MS;
      if (central < 100 && central + add >= 100) {
        runsOutAt = lo + (100 - central) / rate * HOUR_MS;
      }
      central += add;
    }
    const outlook = chance >= STORM_CHANCE ? "storm" : end >= CLOUDS_END ? "clouds" : "clear";
    if (outlook !== "storm") {
      runsOutAt = null;
    } else if (runsOutAt === null) {
      runsOutAt = reset;
    }
    return { ...base, outlook, startsAt: null, end, chance, runsOutAt, days };
  }

  // packages/director/src/limits.ts
  var KINDS = ["session", "week"];
  function limitPercent(limit, now) {
    if (limit.resetsAt !== null && limit.resetsAt <= now) {
      return 0;
    }
    return Math.min(100, Math.max(0, Math.round(limit.percentUsed)));
  }
  function limitMeters(sessions, now) {
    const newest2 = /* @__PURE__ */ new Map();
    for (const session of sessions) {
      for (const limit of parseLimits(session.limits)) {
        const held = newest2.get(limit.kind);
        if (held === void 0 || limit.at > held.at) {
          newest2.set(limit.kind, limit);
        }
      }
    }
    const meters = [];
    for (const kind of KINDS) {
      const limit = newest2.get(kind);
      if (limit !== void 0) {
        meters.push({ kind, percent: limitPercent(limit, now) });
      }
    }
    return meters;
  }
  function newestWeekReading(sessions, now) {
    const weeks = [];
    let latest = -Infinity;
    for (const session of sessions) {
      for (const limit of parseLimits(session.limits)) {
        if (limit.kind === "week" && limit.resetsAt !== null) {
          weeks.push({ limit, resetsAt: limit.resetsAt, percent: Math.min(100, Math.max(0, limit.percentUsed)) });
          latest = Math.max(latest, limit.resetsAt);
        }
      }
    }
    if (weeks.length === 0 || latest <= now) {
      return null;
    }
    let best;
    for (const week of weeks) {
      if (latest - week.resetsAt > RESET_TOLERANCE_MS) {
        continue;
      }
      if (best === void 0 || week.percent > best.percent || week.percent === best.percent && week.limit.at > best.limit.at) {
        best = week;
      }
    }
    return best === void 0 ? null : { percent: best.percent, resetsAt: best.resetsAt, at: best.limit.at };
  }

  // packages/director/src/listing.ts
  var STATE_ORDER = {
    "needs-input": 0,
    error: 1,
    ready: 2,
    working: 3
  };
  function waitingSince(session) {
    let at2;
    for (const story of session.stories) {
      if (story.kind === session.state && (at2 === void 0 || story.at >= at2)) {
        at2 = story.at;
      }
    }
    return at2 ?? session.stateAt;
  }
  function inListingOrder(sessions) {
    return [...sessions].sort((a, b) => {
      if (a.state !== b.state) {
        return STATE_ORDER[a.state] - STATE_ORDER[b.state];
      }
      if (a.state === "needs-input" || a.state === "error") {
        return waitingSince(a) - waitingSince(b);
      }
      return b.stateAt - a.stateAt;
    });
  }

  // packages/director/src/weather.ts
  function createWeatherDesk(options = {}) {
    const forecastFn = options.forecastWeek ?? forecastWeek;
    const readingFn = options.weekReading ?? newestWeekReading;
    let loaded = false;
    let history = null;
    let warnedAt = null;
    let posted = { hour: null, resetsAt: null, last: null, warnedAt: null };
    let scanned = null;
    let reading = null;
    let cached = null;
    let changed = false;
    function stand() {
      const last = history === null ? void 0 : history.points[history.points.length - 1];
      return {
        hour: last === void 0 ? null : hourStart(last[0]),
        resetsAt: history === null ? null : history.resetsAt,
        last: last === void 0 ? null : last[1],
        warnedAt
      };
    }
    function load(memory) {
      loaded = true;
      if (memory !== null) {
        history = memory.resetsAt === null ? null : { resetsAt: memory.resetsAt, points: hourlyPoints(memory.points).slice(-MAX_POINTS) };
        warnedAt = memory.warnedAt;
      }
      posted = stand();
    }
    if (options.memory !== void 0) {
      load(options.memory);
    }
    function compute(now) {
      if (reading === null || history === null || now >= history.resetsAt) {
        cached = null;
        return;
      }
      const lastPoint = history.points[history.points.length - 1];
      cached = forecastFn(history, lastPoint === void 0 ? reading.percent : Math.max(reading.percent, lastPoint[1]), now);
    }
    function stormy() {
      return cached !== null && cached.outlook === "storm";
    }
    function clock2(now) {
      if (cached === null) {
        return;
      }
      if (now >= cached.resetsAt) {
        cached = null;
      } else if (cached.outlook === "early" && cached.startsAt !== null && now >= cached.startsAt) {
        compute(now);
      }
    }
    function scan(found, now) {
      if (found === null) {
        reading = null;
        cached = null;
        return;
      }
      const first = reading === null;
      const moved = reading !== null && Math.abs(found.resetsAt - reading.resetsAt) > RESET_TOLERANCE_MS;
      if (reading !== null && !moved && found.at <= reading.at) {
        return;
      }
      const lastPoint = history === null ? void 0 : history.points[history.points.length - 1];
      if (history !== null && lastPoint !== void 0 && Math.abs(found.resetsAt - history.resetsAt) <= RESET_TOLERANCE_MS && found.percent < lastPoint[1]) {
        if (reading === null) {
          reading = { percent: lastPoint[1], resetsAt: history.resetsAt, at: lastPoint[0] };
          compute(now);
        }
        return;
      }
      reading = found;
      const before = history;
      history = recordReading(history, found);
      if (history !== before) {
        changed = true;
      }
      if (history === null) {
        cached = null;
        return;
      }
      if (first || moved || cached === null || found.percent - cached.used >= 1) {
        compute(now);
      }
    }
    function behind() {
      const now = stand();
      if (now.hour !== posted.hour || now.resetsAt !== posted.resetsAt || now.warnedAt !== posted.warnedAt) {
        return true;
      }
      return now.last !== null && posted.last !== null && now.last - posted.last >= 1;
    }
    return {
      tick(snapshot, now) {
        if (!loaded) {
          if (snapshot.weather === void 0) {
            return;
          }
          load(parseWeather(snapshot.weather));
        }
        clock2(now);
        if (snapshot.limits !== void 0 && snapshot.limits === scanned) {
          return;
        }
        scanned = snapshot.limits;
        scan(readingFn(snapshot.sessions, now), now);
      },
      forecast: () => cached,
      refresh(now) {
        compute(now);
        return cached;
      },
      due(now, busy) {
        if (busy || warnedAt !== null && now - warnedAt < WARNING_EVERY_MS || cached === null || cached.resetsAt <= now || !stormy()) {
          return false;
        }
        if (warnedAt !== null && cached.computedAt < warnedAt + WARNING_EVERY_MS) {
          compute(now);
          return stormy();
        }
        return true;
      },
      markDue(now) {
        warnedAt = now;
        changed = true;
      },
      memory() {
        if (!loaded || !changed) {
          return null;
        }
        changed = false;
        if (!behind()) {
          return null;
        }
        posted = stand();
        return { v: 1, resetsAt: history?.resetsAt ?? null, points: history?.points ?? [], warnedAt };
      }
    };
  }
  function skyFor(share2) {
    if (share2 >= 100) {
      return "storm";
    }
    if (share2 >= 90) {
      return "overcast";
    }
    return share2 >= 70 ? "partly" : "sun";
  }
  function hasOutlook(forecast) {
    return forecast !== null && forecast.outlook !== "early" && forecast.outlook !== "out";
  }
  function share(value) {
    return `${Math.min(99, Math.round(value))}%`;
  }
  function weatherScene(forecast, now) {
    const { outlook, end, runsOutAt } = forecast;
    const runsOut = runsOutAt === null ? "" : aroundTime(runsOutAt);
    const scene = {
      outlook,
      used: share(forecast.used),
      sky: outlook === "storm" ? "storm" : skyFor(end),
      word: OUTLOOK_WORDS[outlook],
      strap: weatherStrap(outlook, Math.min(99, Math.round(end)), runsOut),
      until: untilTab(dayTime(forecast.resetsAt)),
      days: forecast.days.map((day) => {
        const out = day.high >= 100;
        return {
          // The day that closes, which for the reset's own day is the day before the reset
          name: dayName(day.closesAt - 1),
          sky: skyFor(day.high),
          high: out ? WEATHER.out : share(day.high),
          low: day.low >= 100 ? WEATHER.none : share(day.low),
          ...out ? { out } : {}
        };
      })
    };
    if (outlook === "storm" && runsOutAt !== null) {
      const marks = forecast.days.filter((day) => day.closesAt > now && day.closesAt < runsOutAt).slice(-2).map((day) => ({
        when: dayTime(day.closesAt).toUpperCase(),
        share: share(day.high),
        at: (day.closesAt - now) / (runsOutAt - now)
      }));
      scene.track = { marks, out: dayTime(hourStart(runsOutAt + 30 * 6e4)).toUpperCase() };
    }
    return scene;
  }
  function warningSegment(forecast, now, reducedMotion) {
    const weather = weatherScene(forecast, now);
    const opener = {
      role: "opener",
      length: reducedMotion ? REDUCED_OPENER_MS : ALERT_MS,
      cue: "weather-alert",
      scene: ({ now: at2 }) => ({ mode: "alert", clock: clock(at2), progress: 1 })
    };
    const tracker = {
      role: "weather",
      length: STORMTRACKER_MS,
      bed: "beat-minor",
      scene: ({ now: at2, ticker }) => ({ mode: "stormtracker", clock: clock(at2), ticker, weather })
    };
    const outro = {
      role: "outro",
      length: ALERT_OUTRO_MS,
      cue: "breaking-out",
      scene: ({ now: at2, board }) => ({ mode: "outro", open: "alert", clock: clock(at2), progress: 1, board })
    };
    const id = `warning:${now}`;
    if (reducedMotion) {
      return { id, steps: [opener, tracker], endCue: "breaking-out" };
    }
    return { id, steps: [opener, tracker, outro] };
  }

  // packages/director/src/board.ts
  var MAX_TICKER = 6;
  var MAX_COMING_UP = 2;
  var MAX_BREAKING = 2;
  function newestOfKind(session, kind) {
    let found;
    for (const story of session.stories) {
      if (story.kind === kind && (found === void 0 || story.at >= found.at)) {
        found = story;
      }
    }
    return found;
  }
  function newestStory(session) {
    let found;
    for (const story of session.stories) {
      if (found === void 0 || story.at >= found.at) {
        found = story;
      }
    }
    return found;
  }
  function titleOf(snapshot, sessionId) {
    return snapshot.sessions.find((session) => session.id === sessionId)?.title;
  }
  function forecastItem(forecast) {
    if (forecast.outlook === "early") {
      return forecast.startsAt === null ? void 0 : { lead: LEAD.forecast, text: forecastStartsLine(dayTime(forecast.startsAt)), key: "forecast" };
    }
    if (forecast.outlook === "out") {
      return { lead: LEAD.forecast, text: forecastOutLine(dayTime(forecast.resetsAt)), key: "forecast", sky: "storm" };
    }
    if (!hasOutlook(forecast) || forecast.outlook === "storm") {
      return void 0;
    }
    return {
      lead: LEAD.forecast,
      text: forecastLine(forecast.outlook, Math.min(99, Math.round(forecast.end)), dayTime(forecast.resetsAt)),
      key: "forecast",
      sky: skyFor(forecast.end)
    };
  }
  var linesOf = /* @__PURE__ */ new WeakMap();
  function forecastLines(forecast) {
    let lines = linesOf.get(forecast);
    if (lines === void 0) {
      lines = {
        forecast: forecastItem(forecast),
        warning: forecast.outlook === "storm" && forecast.runsOutAt !== null ? { lead: LEAD.stormWarning, text: warningLine(aroundTime(forecast.runsOutAt), dayTime(forecast.resetsAt)), key: "warning" } : void 0
      };
      linesOf.set(forecast, lines);
    }
    return lines;
  }
  function boardTicker(now, snapshot, state, extra = {}) {
    const leads = extra.lead === void 0 ? [] : [extra.lead];
    let comingUp = 0;
    for (const item of state.queue) {
      if (comingUp >= MAX_COMING_UP) {
        break;
      }
      if (item.kind === "hour") {
        leads.push({ lead: LEAD.comingUp, text: reportComingUp(hourLabel(item.hour)), key: `coming:hour:${item.hour}` });
        comingUp += 1;
      } else if (item.kind === "story" && !movedOn(snapshot, item.sessionId, item.story)) {
        const title = titleOf(snapshot, item.sessionId);
        if (title !== void 0) {
          leads.push({ lead: LEAD.comingUp, text: storyLine(item.story.kind, title), key: `coming:${item.story.id}` });
          comingUp += 1;
        }
      }
    }
    const breaking = [...state.carried.entries()].filter(([, carried]) => now - carried.endedAt < BREAKING_MS).sort(([, a], [, b]) => b.endedAt - a.endedAt);
    let shown = 0;
    for (const [storyId, carried] of breaking) {
      if (shown >= MAX_BREAKING) {
        break;
      }
      const title = titleOf(snapshot, carried.sessionId);
      if (title !== void 0) {
        leads.push({ lead: LEAD.breaking, text: storyLine(carried.kind, title), key: `breaking:${storyId}` });
        shown += 1;
      }
    }
    const waiting = [];
    for (const session of snapshot.sessions) {
      if (session.id !== extra.skipWaitingFor && (session.state === "needs-input" || session.state === "error")) {
        const newest2 = newestOfKind(session, session.state);
        const at2 = waitingSince(session);
        waiting.push({
          at: at2,
          item: {
            lead: LEAD.stillWaiting,
            text: stillWaitingLine(session.state, session.title, wholeMinutes(now - at2)),
            key: `waiting:${newest2?.id ?? session.id}`
          }
        });
      }
    }
    waiting.sort((a, b) => a.at - b.at);
    for (const entry of waiting) {
      leads.push(entry.item);
    }
    const queuedIds = /* @__PURE__ */ new Set();
    for (const item of state.queue) {
      if (item.kind === "story") {
        queuedIds.add(item.story.id);
      }
    }
    for (const session of snapshot.sessions) {
      if (session.state !== "ready") {
        continue;
      }
      const story = newestStory(session);
      if (story === void 0 || story.kind !== "ready") {
        continue;
      }
      if (queuedIds.has(story.id) || state.onAirStoryId === story.id) {
        continue;
      }
      const carried = state.carried.get(story.id);
      if (carried !== void 0 && now - carried.endedAt < BREAKING_MS) {
        continue;
      }
      leads.push({ lead: LEAD.ready, text: waitingForReviewLine(session.title), key: `ready:${story.id}` });
    }
    if (state.lastReport !== null && state.reportEndedAt !== null && now - state.reportEndedAt < AFTER_REPORT_MS) {
      const { hour, stories } = state.lastReport;
      leads.push({
        lead: LEAD.onTheHour,
        text: afterReportLine(stories, hourLabel(hour), hourLabel(hour + HOUR_MS)),
        key: `report:${hour}`
      });
    }
    const onAir = snapshot.sessions.length;
    const working = snapshot.sessions.filter((session) => session.state === "working");
    const lines = state.forecast === null ? void 0 : forecastLines(state.forecast);
    const outlook = lines?.forecast;
    if (lines?.warning !== void 0) {
      leads.unshift(lines.warning);
    }
    const items = leads.slice(0, MAX_TICKER - (outlook === void 0 ? 1 : 2));
    items.push({ lead: LEAD.onTheDesk, text: deskLine(working.length, onAir), key: "desk" });
    if (outlook !== void 0) {
      items.push(outlook);
    }
    const activity = working.flatMap((session) => {
      const latest = session.activity[session.activity.length - 1];
      return latest === void 0 ? [] : [
        {
          at: latest.at,
          item: { text: activityLine(session.project, latest.text), key: `activity:${session.id}` }
        }
      ];
    }).sort((a, b) => b.at - a.at);
    for (const entry of activity) {
      if (items.length >= MAX_TICKER) {
        break;
      }
      items.push(entry.item);
    }
    return items;
  }
  function boardScene(now, snapshot, state) {
    if (snapshot === null) {
      return { mode: "board", clock: clock(now), sessions: [], ticker: [] };
    }
    const sessions = inListingOrder(snapshot.sessions).map((session) => ({
      id: session.id,
      name: session.title,
      project: session.project,
      state: session.state
    }));
    const scene = { mode: "board", clock: clock(now), sessions, ticker: boardTicker(now, snapshot, state) };
    const limits = limitMeters(snapshot.sessions, now);
    return limits.length === 0 ? scene : { ...scene, limits };
  }

  // packages/director/src/hour.ts
  function inWindow(at2, from, hour) {
    return at2 >= from && at2 < hour;
  }
  function newestKindIn(session, from, hour) {
    let found;
    for (const story of session.stories) {
      if (inWindow(story.at, from, hour) && (found === void 0 || story.at >= found.at)) {
        found = story;
      }
    }
    switch (found?.kind) {
      case "needs-input":
        return "needsInput";
      case "ready":
        return "ready";
      case "complete":
        return "complete";
      case "error":
        return "error";
      default:
        return void 0;
    }
  }
  function linesIn(session, from, hour) {
    const first = hourKey(from);
    const last = hourKey(hour);
    const sum = { added: 0, removed: 0, files: 0 };
    for (const entry of session.hours) {
      if (entry.hour >= first && entry.hour < last) {
        sum.added += entry.added;
        sum.removed += entry.removed;
        sum.files += entry.files;
      }
    }
    return sum;
  }
  function rowFor(session, from, hour, now) {
    const row = { id: session.id, project: session.project, name: session.title, state: session.state };
    switch (session.state) {
      case "needs-input":
        row.detail = reviewDetail({ kind: "waiting", minutes: wholeMinutes(now - waitingSince(session)) });
        break;
      case "error":
        row.detail = reviewDetail({ kind: "error" });
        break;
      default: {
        const { added, removed } = linesIn(session, from, hour);
        row.detail = reviewDetail({ kind: "lines", added, removed });
      }
    }
    return row;
  }
  function hourReport(hour, from, snapshot, now, reducedMotion, forecast = null) {
    const sessions = snapshot.sessions;
    const counts = { needsInput: 0, ready: 0, complete: 0, error: 0 };
    let stories = 0;
    let added = 0;
    let removed = 0;
    for (const session of sessions) {
      const kind = newestKindIn(session, from, hour);
      if (kind !== void 0) {
        counts[kind] += 1;
        stories += 1;
      }
      const lines = linesIn(session, from, hour);
      added += lines.added;
      removed += lines.removed;
    }
    const working = sessions.filter((session) => session.state === "working").length;
    const rows = inListingOrder(sessions).map((session) => rowFor(session, from, hour, now));
    const label = hourLabel(hour);
    const ident = {
      role: "opener",
      length: reducedMotion ? REDUCED_OPENER_MS : IDENT_MS,
      cue: "hour",
      scene: ({ now: at2 }) => ({ mode: "ident", clock: clock(at2), hour: label, progress: 1 })
    };
    const desk = {
      role: "desk",
      length: DESK_MS,
      // The beat, in D major, comes in with the desk and plays on under the review
      bed: "beat-major",
      scene: ({ now: at2, ticker: ticker2 }) => ({
        mode: "desk",
        clock: clock(at2),
        act: "talk",
        event: {
          kind: "hourly",
          figure: figure(added, removed),
          sub: acrossSessions(sessions.length),
          foot: hourFoot(clock(from), label)
        },
        headline: hourHeadline(stories),
        strap: stories > 0 ? hourStrap(counts) : quietStrap(working),
        ticker: ticker2
      })
    };
    const review = {
      role: "review",
      // A desk's 10 s for each page of four rows
      length: REVIEW_MS * Math.max(1, Math.ceil(rows.length / REVIEW_ROWS)),
      bed: "beat-major",
      scene: ({ now: at2, ticker: ticker2 }) => ({
        mode: "review",
        clock: clock(at2),
        span: reviewSpan(clock(from), label),
        rows,
        ticker: ticker2
      })
    };
    const weatherSteps = [];
    if (hasOutlook(forecast)) {
      const weather = weatherScene(forecast, now);
      const page = (mode, length) => ({
        role: "weather",
        length,
        bed: "beat-major",
        scene: ({ now: at2, ticker: ticker2 }) => ({ mode, clock: clock(at2), ticker: ticker2, weather })
      });
      weatherSteps.push(page("weather-now", WEATHER_PAGE_MS), page("weather-days", WEATHER_PAGE_MS));
      if (forecast.outlook === "storm") {
        weatherSteps.push(page("stormtracker", STORMTRACKER_MS));
      }
    }
    const outro = {
      role: "outro",
      length: HOUR_OUTRO_MS,
      cue: "hour-out",
      scene: ({ now: at2, board }) => ({
        mode: "outro",
        open: "hour",
        hour: label,
        clock: clock(at2),
        progress: 1,
        board
      })
    };
    const id = `hour:${hour}`;
    const shown = [...stories > 0 ? [ident, desk, review] : [ident, desk], ...weatherSteps];
    const ticker = (live) => ({
      lead: {
        lead: LEAD.onTheHour,
        key: `on-air:hour:${hour}`,
        text: hourSoFarLine(
          stories,
          clock(from),
          live.sessions.filter((session) => session.state === "working").length,
          live.sessions.length
        )
      }
    });
    if (reducedMotion) {
      return { segment: { id, steps: shown, endCue: "hour-out", ticker }, stories };
    }
    return { segment: { id, steps: [...shown, outro], ticker }, stories };
  }

  // packages/director/src/director.ts
  function createDirector(options = {}) {
    const reducedMotion = options.reducedMotion === true;
    const desk = createWeatherDesk({
      ...options.forecastWeek === void 0 ? {} : { forecastWeek: options.forecastWeek },
      ...options.weekReading === void 0 ? {} : { weekReading: options.weekReading },
      ...options.weather === void 0 ? {} : { memory: options.weather }
    });
    let initialized = false;
    const seen = /* @__PURE__ */ new Set();
    const queue = [];
    let onAir = null;
    let lastEnded = null;
    const carried = /* @__PURE__ */ new Map();
    let lastReport = null;
    let reportEndedAt = null;
    let scheduledHour = 0;
    function boardState() {
      const story = onAir?.item.kind === "story" ? onAir.item.story : null;
      return {
        queue,
        carried,
        onAirStoryId: story === null ? null : story.id,
        lastReport,
        reportEndedAt,
        forecast: desk.forecast()
      };
    }
    function dropWaitingStories() {
      let warning = false;
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const kind = queue[index]?.kind;
        if (kind === "story" || kind === "warning") {
          warning = warning || kind === "warning";
          queue.splice(index, 1);
        }
      }
      return warning;
    }
    function dropMovedOnStories(snapshot) {
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const item = queue[index];
        if (item?.kind === "story" && movedOn(snapshot, item.sessionId, item.story)) {
          queue.splice(index, 1);
        }
      }
    }
    function dropMissedReports(now) {
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        const item = queue[index];
        if (item?.kind === "hour" && now >= item.hour + HOUR_MS - IDENT_LEAD_MS) {
          queue.splice(index, 1);
        }
      }
    }
    function tick({ now, snapshot }) {
      const sounds = [];
      let reported = null;
      function end(at2, normally) {
        if (onAir === null) {
          return;
        }
        const { item, segment, bed } = onAir;
        if (item.kind === "story") {
          carried.set(item.story.id, { endedAt: at2, kind: item.story.kind, sessionId: item.sessionId });
        } else if (item.kind === "hour") {
          reportEndedAt = at2;
        }
        if (!normally) {
          sounds.push({ type: "hush" });
        } else {
          if (segment.endCue !== void 0) {
            sounds.push({ type: "cue", jingle: segment.endCue });
          }
          if (bed !== void 0) {
            sounds.push({ type: "bed-out" });
          }
        }
        onAir = null;
        lastEnded = at2;
      }
      function enter(index, at2) {
        if (onAir === null) {
          return;
        }
        onAir.index = index;
        onAir.stepStartedAt = at2;
        const step2 = onAir.segment.steps[index];
        if (step2?.cue !== void 0) {
          sounds.push({ type: "cue", jingle: step2.cue });
        }
        if (step2?.bed !== onAir.bed) {
          if (onAir.bed !== void 0) {
            sounds.push({ type: "bed-out" });
          }
          if (step2?.bed !== void 0) {
            sounds.push({ type: "bed", bed: step2.bed });
          }
          onAir.bed = step2?.bed;
        }
      }
      const visible = snapshot !== null && snapshot.visible;
      const windowOut = snapshot === null || snapshot.windowOut !== false;
      if (snapshot !== null) {
        if (!initialized) {
          initialized = true;
          for (const session of snapshot.sessions) {
            for (const story of session.stories) {
              if (story.at < now - STORY_FRESH_MS) {
                seen.add(story.id);
              }
            }
          }
          scheduledHour = hourStart(now);
          if (snapshot.lastReportAt !== null && now - snapshot.lastReportAt <= LAST_REPORT_KEEP_MS) {
            lastReport = { hour: snapshot.lastReportAt, stories: 0 };
          }
        }
        const landed = [];
        for (const session of snapshot.sessions) {
          for (const story of session.stories) {
            if (!seen.has(story.id)) {
              landed.push({ sessionId: session.id, story });
            }
          }
        }
        landed.sort((a, b) => a.story.at - b.story.at);
        for (const { sessionId, story } of landed) {
          seen.add(story.id);
          if (visible) {
            queue.push({ kind: "story", sessionId, story });
          }
        }
        dropMissedReports(now);
        const next = hourStart(now) + HOUR_MS;
        if (visible && now >= next - IDENT_LEAD_MS && next > scheduledHour) {
          queue.push({ kind: "hour", hour: next });
          scheduledHour = next;
        }
        desk.tick(snapshot, now);
        const warningWaits = queue.some((item) => item.kind === "warning") || onAir?.item.kind === "warning";
        if (desk.due(now, warningWaits)) {
          if (visible) {
            queue.push({ kind: "warning" });
          } else {
            desk.markDue(now);
          }
        }
      }
      if (!visible) {
        end(now, false);
        if (dropWaitingStories()) {
          desk.markDue(now);
        }
      } else if (!windowOut) {
        end(now, false);
        dropMovedOnStories(snapshot);
      } else {
        while (onAir !== null) {
          const { item, segment, index, stepStartedAt } = onAir;
          const step2 = segment.steps[index];
          if (step2 === void 0) {
            end(now, true);
            break;
          }
          if (step2.role === "desk" && item.kind === "story" && movedOn(snapshot, item.sessionId, item.story)) {
            const outro = segment.steps.findIndex((other) => other.role === "outro");
            if (outro < 0) {
              end(now, true);
            } else {
              enter(outro, now);
            }
            continue;
          }
          if (now - stepStartedAt < step2.length) {
            break;
          }
          const boundary = stepStartedAt + step2.length;
          if (index + 1 >= segment.steps.length) {
            end(boundary, true);
          } else {
            enter(index + 1, boundary);
          }
        }
        if (onAir === null && (lastEnded === null || now - lastEnded >= GAP_MS)) {
          while (queue.length > 0 && onAir === null) {
            const item = queue.shift();
            if (item === void 0) {
              break;
            }
            if (item.kind === "story") {
              if (movedOn(snapshot, item.sessionId, item.story)) {
                continue;
              }
              onAir = { item, segment: storySegment(item.sessionId, item.story, snapshot, reducedMotion), index: 0, stepStartedAt: now, bed: void 0 };
            } else if (item.kind === "warning") {
              const forecast = desk.forecast();
              if (!hasOutlook(forecast) || forecast.outlook !== "storm") {
                continue;
              }
              onAir = { item, segment: warningSegment(forecast, now, reducedMotion), index: 0, stepStartedAt: now, bed: void 0 };
              desk.markDue(now);
            } else {
              if (snapshot === null) {
                continue;
              }
              const from = lastReport !== null && lastReport.hour < item.hour ? lastReport.hour : item.hour - HOUR_MS;
              const report = hourReport(item.hour, from, snapshot, now, reducedMotion, desk.refresh(now));
              onAir = { item, segment: report.segment, index: 0, stepStartedAt: now, bed: void 0 };
              lastReport = { hour: item.hour, stories: report.stories };
              reportEndedAt = null;
              reported = item.hour;
            }
            enter(0, now);
          }
        }
      }
      const due = queue.length > 0 && (lastEnded === null || now - lastEnded >= GAP_MS);
      const wantsWindow = visible && (onAir !== null || due || windowOut && queue.length > 0);
      const weather = desk.memory();
      const board = boardScene(now, snapshot, boardState());
      const current = onAir;
      const step = current?.segment.steps[current.index];
      if (current === null || step === void 0) {
        return { scene: board, key: "board", sounds, reported, wantsWindow, weather };
      }
      const extra = current.segment.ticker;
      const atDesk = step.role === "desk" || step.role === "review" || step.role === "weather";
      const ticker = atDesk && snapshot !== null && extra !== void 0 ? boardTicker(now, snapshot, boardState(), extra(snapshot)) : board.ticker ?? [];
      const made = step.scene({ now, ticker, board });
      return { scene: made, key: `${current.segment.id}:${current.index}`, sounds, reported, wantsWindow, weather };
    }
    return { tick };
  }

  // packages/renderer/src/bridge.ts
  var listeners = /* @__PURE__ */ new Set();
  var readyPosted = false;
  function subscribe(listener) {
    listeners.add(listener);
    if (!readyPosted) {
      readyPosted = true;
      post({ type: "ready" });
    }
    return () => {
      listeners.delete(listener);
    };
  }
  function isObject2(value) {
    return typeof value === "object" && value !== null;
  }
  function receive(raw) {
    let message = raw;
    if (typeof raw === "string") {
      try {
        message = JSON.parse(raw);
      } catch {
        return;
      }
    }
    if (!isObject2(message)) {
      return;
    }
    if (message.type !== "snapshot" && message.type !== "still") {
      return;
    }
    for (const listener of [...listeners]) {
      listener(message);
    }
  }
  function installBridge() {
    ;
    window.pipcast = { receive };
  }
  function post(message) {
    const handler = window.webkit?.messageHandlers?.pipcast;
    if (handler !== void 0) {
      handler.postMessage(message);
    }
  }

  // packages/renderer/src/design.ts
  var PipNews = window.PipNews;
  if (PipNews === void 0) {
    throw new Error("the design system did not load: window.React was missing when its bundle ran");
  }
  var { Broadcast, Stage, Ticker, crawlStep, crawlRun, crawlSpeed, samples, drawn } = PipNews;

  // packages/renderer/src/App.tsx
  var TICK_MS = 250;
  function prefersReducedMotion() {
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  }
  function App({ reducedMotion = prefersReducedMotion(), createSource = createDirector }) {
    const memory = (0, import_react.useRef)({ taken: false, weather: null });
    const director = (0, import_react.useMemo)(
      () => createSource({ reducedMotion, ...memory.current.taken ? { weather: memory.current.weather } : {} }),
      [createSource, reducedMotion]
    );
    const snapshot = (0, import_react.useRef)(null);
    const [program, setProgram] = (0, import_react.useState)(null);
    const [width, setWidth] = (0, import_react.useState)(window.innerWidth);
    (0, import_react.useEffect)(() => {
      const onResize = () => setWidth(window.innerWidth);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }, []);
    (0, import_react.useEffect)(() => {
      let wanted = false;
      const tick = () => {
        const next = director.tick({ now: Date.now(), snapshot: snapshot.current });
        if (next.wantsWindow !== wanted) {
          wanted = next.wantsWindow;
          post({ type: "window", wanted: next.wantsWindow });
        }
        for (const sound of next.sounds) {
          post(sound);
        }
        if (next.reported !== null) {
          post({ type: "reported", at: next.reported });
        }
        if (next.weather !== null) {
          memory.current = { taken: true, weather: next.weather };
          post({ type: "weather", memory: next.weather });
        }
        if (snapshot.current !== null) {
          setProgram(next);
        }
      };
      const unsubscribe = subscribe((message) => {
        if (message.type === "snapshot") {
          if (message.weather !== void 0) {
            if (!memory.current.taken) {
              memory.current = { taken: true, weather: parseWeather(message.weather) };
            }
            post({ type: "weather-taken" });
          }
          snapshot.current = message;
          tick();
        }
      });
      tick();
      const timer = window.setInterval(tick, TICK_MS);
      return () => {
        unsubscribe();
        window.clearInterval(timer);
      };
    }, [director]);
    if (program === null) {
      return null;
    }
    return /* @__PURE__ */ React.createElement(Stage, { width, animate: true }, /* @__PURE__ */ React.createElement(Broadcast, { key: program.key, scene: program.scene, animate: true }));
  }

  // packages/renderer/src/demo.ts
  var CYCLE_MS = 15e4;
  var MINUTE = 6e4;
  function eventOf(name) {
    const event = samples[name]?.event;
    if (event === void 0) {
      throw new Error(`the design system has no sample ${name}`);
    }
    return event;
  }
  function find(sessions, id) {
    const found = sessions.find((session) => session.id === id);
    if (found === void 0) {
      throw new Error(`the demo has no session ${id}`);
    }
    return found;
  }
  function land(session, now, cycle, story) {
    const entry = { ...story, id: `${session.id}:${cycle}:${session.stories.length + 1}`, at: now };
    session.stories = [...session.stories, entry].slice(-10);
    session.stateAt = now;
    session.state = story.kind === "needs-input" ? "needs-input" : story.kind === "error" ? "error" : "ready";
  }
  function work(session, now) {
    session.state = "working";
    session.stateAt = now;
  }
  function newSessions(now) {
    const board = samples["run-board"];
    const ticker = (board?.ticker ?? []).filter((item) => typeof item === "string");
    return (board?.sessions ?? []).map((row, index) => {
      const project = row.project ?? "";
      const prefix = `${project}: `;
      const text = ticker.find((line) => line.startsWith(prefix));
      return {
        v: 1,
        id: row.id,
        title: row.name,
        project,
        state: "working",
        stateAt: now,
        tunedInAt: now - MINUTE + index,
        checkedInAt: now,
        stories: [],
        activity: text === void 0 ? [] : [{ at: now, text: text.slice(prefix.length) }],
        hours: [],
        // The first session read the account's usage limits a moment ago
        limits: index === 0 ? [
          { kind: "session", percentUsed: 42, resetsAt: now + 2 * 60 * MINUTE, at: now },
          { kind: "week", percentUsed: 61, resetsAt: now + 3 * 24 * 60 * MINUTE, at: now }
        ] : []
      };
    });
  }
  function plan() {
    const ask = eventOf("run-needs-input");
    const complete = eventOf("complete-desk");
    const error = eventOf("error-desk");
    return [
      {
        at: 6e3,
        run: (sessions, now, cycle) => {
          land(find(sessions, "checkout"), now, cycle, { kind: "needs-input", command: ask.command, quote: ask.quote });
        }
      },
      { at: 45e3, run: (sessions, now) => work(find(sessions, "checkout"), now) },
      {
        at: 5e4,
        run: (sessions, now, cycle) => {
          land(find(sessions, "notes"), now, cycle, {
            kind: "ready",
            added: 182,
            removed: 40,
            files: 4,
            durationMs: 9 * MINUTE
          });
        }
      },
      { at: 8e4, run: (sessions, now) => work(find(sessions, "notes"), now) },
      {
        at: 85e3,
        run: (sessions, now, cycle) => {
          land(find(sessions, "sqlite"), now, cycle, { kind: "error", quote: error.quote, durationMs: 31 * MINUTE });
        }
      },
      { at: 11e4, run: (sessions, now) => work(find(sessions, "sqlite"), now) },
      {
        at: 115e3,
        run: (sessions, now, cycle) => {
          land(find(sessions, "auth"), now, cycle, { kind: "complete", quote: complete.quote, durationMs: 6 * MINUTE });
        }
      },
      { at: 14e4, run: (sessions, now) => work(find(sessions, "auth"), now) }
    ];
  }
  function startDemo() {
    const started = Date.now();
    let cycle = 0;
    let cycleStart = started;
    let sessions = newSessions(started);
    let pending = plan();
    let limits = 0;
    function step() {
      const now = Date.now();
      if (now - cycleStart >= CYCLE_MS) {
        cycle += 1;
        cycleStart = now;
        sessions = newSessions(now);
        pending = plan();
        limits += 1;
      }
      const elapsed = now - cycleStart;
      while (pending[0] !== void 0 && pending[0].at <= elapsed) {
        pending.shift()?.run(sessions, now, cycle);
      }
      for (const session of sessions) {
        session.checkedInAt = now;
      }
      receive({ type: "snapshot", now, visible: true, sessions, lastReportAt: null, limits, weather: null });
    }
    step();
    const timer = window.setInterval(step, 1e3);
    return () => window.clearInterval(timer);
  }

  // packages/renderer/src/still.tsx
  var import_react2 = __toESM(require_React(), 1);
  var STEP_MS = 250;
  var SETTLE_MS = 100;
  function decodeStillInput(fragment) {
    const match = /^#still=([A-Za-z0-9_-]+)$/.exec(fragment);
    if (match === null || match[1] === void 0) {
      return null;
    }
    const base64 = match[1].replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }
  function stillScene(input) {
    if (input.scene !== void 0) {
      return input.scene;
    }
    const snapshot = input.snapshot;
    if (snapshot === void 0) {
      throw new Error("a still needs a scene or a snapshot");
    }
    const until = input.at ?? snapshot.now;
    const director = createDirector({ weather: null });
    let now = snapshot.now;
    let program = director.tick({ now, snapshot });
    while (now < until) {
      now = Math.min(now + STEP_MS, until);
      program = director.tick({ now, snapshot });
    }
    return program.scene;
  }
  function settled() {
    const fonts = document.fonts;
    const ready = fonts === void 0 ? Promise.resolve() : fonts.ready.then(() => void 0);
    return ready.then(drawn).then(() => new Promise((done) => window.setTimeout(done, SETTLE_MS)));
  }
  function Still({ input }) {
    const scene = (0, import_react2.useMemo)(() => input === null ? null : stillScene(input), [input]);
    (0, import_react2.useEffect)(() => {
      if (scene === null) {
        return void 0;
      }
      let live = true;
      void settled().then(() => {
        if (live) {
          post({ type: "rendered" });
        }
      });
      return () => {
        live = false;
      };
    }, [scene]);
    if (scene === null) {
      return null;
    }
    return /* @__PURE__ */ React.createElement(Stage, { width: window.innerWidth }, /* @__PURE__ */ React.createElement(Broadcast, { scene }));
  }
  function StillPage() {
    const [input, setInput] = (0, import_react2.useState)(() => decodeStillInput(window.location.hash));
    (0, import_react2.useEffect)(() => {
      return subscribe((message) => {
        if (message.type === "still") {
          setInput(message.input);
        }
      });
    }, []);
    return /* @__PURE__ */ React.createElement(Still, { input });
  }

  // packages/renderer/src/main.tsx
  function boot() {
    const container = document.getElementById("root");
    if (container === null) {
      return;
    }
    installBridge();
    window.addEventListener("error", (event) => {
      post({ type: "log", level: "error", text: event.message });
    });
    const hash = window.location.hash;
    const root = (0, import_client.createRoot)(container);
    if (hash.startsWith("#still")) {
      root.render(/* @__PURE__ */ React.createElement(StillPage, null));
    } else {
      root.render(/* @__PURE__ */ React.createElement(App, null));
      if (hash === "#demo") {
        startDemo();
      }
    }
  }
  boot();
})();
