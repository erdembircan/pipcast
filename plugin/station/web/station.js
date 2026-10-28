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
    onTheDesk: "ON THE DESK"
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
    const { kind, percentUsed, resetsAt, at } = value;
    if (!isLimitKind(kind) || !isNumber(percentUsed) || !isNumber(at)) {
      return null;
    }
    return { kind, percentUsed, resetsAt: isNumber(resetsAt) ? resetsAt : null, at };
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

  // packages/director/src/timing.ts
  var STINGER_MS = 1900;
  var DESK_MS = 1e4;
  var STORY_OUTRO_MS = 1400;
  var IDENT_MS = 7500;
  var REVIEW_MS = 1e4;
  var REVIEW_ROWS = 4;
  var HOUR_OUTRO_MS = 1600;
  var REDUCED_OPENER_MS = 1e3;
  var GAP_MS = 2e3;
  var IDENT_LEAD_MS = 5e3;
  var BREAKING_MS = 4e4;
  var AFTER_REPORT_MS = 10 * 6e4;
  var LAST_REPORT_KEEP_MS = 24 * 60 * 6e4;
  var HOUR_MS = 60 * 6e4;

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

  // packages/director/src/listing.ts
  var STATE_ORDER = {
    "needs-input": 0,
    error: 1,
    ready: 2,
    working: 3
  };
  function waitingSince(session) {
    let at;
    for (const story of session.stories) {
      if (story.kind === session.state && (at === void 0 || story.at >= at)) {
        at = story.at;
      }
    }
    return at ?? session.stateAt;
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
      } else if (!movedOn(snapshot, item.sessionId, item.story)) {
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
        const at = waitingSince(session);
        waiting.push({
          at,
          item: {
            lead: LEAD.stillWaiting,
            text: stillWaitingLine(session.state, session.title, wholeMinutes(now - at)),
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
    const items = leads.slice(0, MAX_TICKER - 1);
    items.push({ lead: LEAD.onTheDesk, text: deskLine(working.length, onAir), key: "desk" });
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
  function inWindow(at, from, hour) {
    return at >= from && at < hour;
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
  function hourReport(hour, from, snapshot, now, reducedMotion) {
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
      scene: ({ now: at }) => ({ mode: "ident", clock: clock(at), hour: label, progress: 1 })
    };
    const desk = {
      role: "desk",
      length: DESK_MS,
      // The beat, in D major, comes in with the desk and plays on under the review
      bed: "beat-major",
      scene: ({ now: at, ticker: ticker2 }) => ({
        mode: "desk",
        clock: clock(at),
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
      scene: ({ now: at, ticker: ticker2 }) => ({
        mode: "review",
        clock: clock(at),
        span: reviewSpan(clock(from), label),
        rows,
        ticker: ticker2
      })
    };
    const outro = {
      role: "outro",
      length: HOUR_OUTRO_MS,
      cue: "hour-out",
      scene: ({ now: at, board }) => ({
        mode: "outro",
        open: "hour",
        hour: label,
        clock: clock(at),
        progress: 1,
        board
      })
    };
    const id = `hour:${hour}`;
    const shown = stories > 0 ? [ident, desk, review] : [ident, desk];
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
        reportEndedAt
      };
    }
    function dropWaitingStories() {
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        if (queue[index]?.kind === "story") {
          queue.splice(index, 1);
        }
      }
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
      function end(at, normally) {
        if (onAir === null) {
          return;
        }
        const { item, segment, bed } = onAir;
        if (item.kind === "story") {
          carried.set(item.story.id, { endedAt: at, kind: item.story.kind, sessionId: item.sessionId });
        } else {
          reportEndedAt = at;
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
        lastEnded = at;
      }
      function enter(index, at) {
        if (onAir === null) {
          return;
        }
        onAir.index = index;
        onAir.stepStartedAt = at;
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
      }
      if (!visible) {
        end(now, false);
        dropWaitingStories();
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
            } else {
              if (snapshot === null) {
                continue;
              }
              const from = lastReport !== null && lastReport.hour < item.hour ? lastReport.hour : item.hour - HOUR_MS;
              const report = hourReport(item.hour, from, snapshot, now, reducedMotion);
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
      const board = boardScene(now, snapshot, boardState());
      const current = onAir;
      const step = current?.segment.steps[current.index];
      if (current === null || step === void 0) {
        return { scene: board, key: "board", sounds, reported, wantsWindow };
      }
      const extra = current.segment.ticker;
      const atDesk = step.role === "desk" || step.role === "review";
      const ticker = atDesk && snapshot !== null && extra !== void 0 ? boardTicker(now, snapshot, boardState(), extra(snapshot)) : board.ticker ?? [];
      const scene = step.scene({ now, ticker, board });
      return { scene, key: `${current.segment.id}:${current.index}`, sounds, reported, wantsWindow };
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

  // design/components/bundle.js
  (function() {
    "use strict";
    var React3 = window.React;
    if (!React3) {
      return;
    }
    var h = React3.createElement;
    var useState3 = React3.useState;
    var useEffect3 = React3.useEffect;
    var useRef2 = React3.useRef;
    var useLayoutEffect = React3.useLayoutEffect;
    var STAGE_W = 960;
    var STAGE_H = 540;
    function num(v, d) {
      var n = typeof v === "number" ? v : parseFloat(v);
      return isFinite(n) ? n : d;
    }
    function bool(v, d) {
      if (v === void 0 || v === null || v === "") {
        return d;
      }
      if (typeof v === "string") {
        return v !== "false" && v !== "0";
      }
      return !!v;
    }
    function cx() {
      return Array.prototype.filter.call(arguments, Boolean).join(" ");
    }
    function hasElements(children) {
      return React3.Children.toArray(children).some(function(c) {
        return c !== null && typeof c === "object";
      });
    }
    var CLAWD_SOURCE = {
      engine: "2.1.299",
      poses: {
        "default": { eyes: "open", arms: "down", feet: "both" },
        "arms-up": { eyes: "open", arms: "up", feet: "both" },
        "look-left": { eyes: "left", arms: "down", feet: "both" },
        "look-right": { eyes: "right", arms: "down", feet: "both" }
      },
      arms: {
        down: { r1L: " \u2590", r1R: "", r2L: "\u259D\u259C", r2R: "\u2588\u2580" },
        up: { r1L: "\u2597\u259F", r1R: "\u2584", r2L: " \u259C", r2R: "\u2588\u2598" },
        "one-up": { r1L: " \u2590", r1R: "\u2584", r2L: "\u259D\u259C", r2R: "\u2588\u2598" }
      },
      eyes: {
        open: [{ glyphs: "\u259B\u2588\u2588\u2588\u259B\u2588" }],
        left: [{ glyphs: "\u259F\u2588\u2588\u2588\u259F\u2588" }],
        right: [{ glyphs: "\u2588\u259F\u2588\u2588\u2588\u259F" }],
        closed: [{ glyphs: "\u2582", lid: true }, { glyphs: "\u2588\u2588\u2588" }, { glyphs: "\u2582", lid: true }, { glyphs: "\u2588" }],
        wink: [{ glyphs: "\u259B\u2588\u2588\u2588" }, { glyphs: "\u2582", lid: true }, { glyphs: "\u2588" }]
      },
      feet: {
        both: " \u259D\u259D   \u259D\u259D ",
        left: " \u259D\u259D      ",
        right: "      \u259D\u259D "
      },
      facing: {
        "right-12": [{ glyphs: " \u2590\u2588\u259C\u2588\u2588\u259B\u2588 ", from: 2, to: 8 }, { glyphs: "\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580", from: 2, to: 7 }, { glyphs: " \u259D\u259D   \u259D\u259D ", from: 0, to: 0 }],
        "right-30": [{ glyphs: "  \u2588\u259B\u2588\u2588\u259B\u258C ", from: 2, to: 7 }, { glyphs: " \u259D\u2588\u2588\u2588\u2588\u2588\u259B ", from: 2, to: 7 }, { glyphs: "  \u2598\u2598  \u2598\u2598 ", from: 0, to: 0 }],
        "right-55": [{ glyphs: "  \u2590\u2588\u259B\u2588\u259C  ", from: 3, to: 7 }, { glyphs: "  \u2590\u2588\u2588\u2588\u2588  ", from: 3, to: 7 }, { glyphs: "  \u259D\u259D \u259D\u259D  ", from: 0, to: 0 }],
        "right-75": [{ glyphs: "   \u2588\u2588\u259B\u258C  ", from: 3, to: 6 }, { glyphs: "   \u2588\u2588\u2588\u258C  ", from: 3, to: 6 }, { glyphs: "   \u2598  \u2598  ", from: 0, to: 0 }],
        edge: [{ glyphs: "   \u2590\u2588\u2588   ", from: 4, to: 6 }, { glyphs: "   \u2590\u2588\u2588   ", from: 4, to: 6 }, { glyphs: "   \u259D \u259D   ", from: 0, to: 0 }],
        "back-105": [{ glyphs: "   \u2588\u2588\u2588\u258C  ", from: 3, to: 6 }, { glyphs: "   \u2588\u2588\u2588\u258C  ", from: 3, to: 6 }, { glyphs: "   \u2598  \u2598  ", from: 0, to: 0 }],
        "back-125": [{ glyphs: "  \u2590\u2588\u2588\u2588\u2588  ", from: 3, to: 7 }, { glyphs: "  \u2590\u2588\u2588\u2588\u2588  ", from: 3, to: 7 }, { glyphs: "  \u259D\u259D \u259D\u259D  ", from: 0, to: 0 }],
        "back-150": [{ glyphs: "  \u2588\u2588\u2588\u2588\u2588\u258C ", from: 2, to: 7 }, { glyphs: " \u259D\u2588\u2588\u2588\u2588\u2588\u259B ", from: 2, to: 7 }, { glyphs: "  \u2598\u2598  \u2598\u2598 ", from: 0, to: 0 }],
        back: [{ glyphs: " \u2590\u2588\u2588\u2588\u2588\u2588\u2588 ", from: 2, to: 8 }, { glyphs: "\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580", from: 2, to: 7 }, { glyphs: " \u259D\u259D   \u259D\u259D ", from: 0, to: 0 }],
        "left-75": [{ glyphs: "   \u259B\u2588\u2588\u258C  ", from: 3, to: 6 }, { glyphs: "   \u2588\u2588\u2588\u258C  ", from: 3, to: 6 }, { glyphs: "   \u2598  \u2598  ", from: 0, to: 0 }],
        "left-55": [{ glyphs: "  \u2590\u259C\u259B\u2588\u2588  ", from: 3, to: 7 }, { glyphs: "  \u2590\u2588\u2588\u2588\u2588  ", from: 3, to: 7 }, { glyphs: "  \u259D\u259D \u259D\u259D  ", from: 0, to: 0 }],
        "left-30": [{ glyphs: "  \u259B\u2588\u2588\u259B\u2588\u258C ", from: 2, to: 7 }, { glyphs: " \u259D\u2588\u2588\u2588\u2588\u2588\u259B ", from: 2, to: 7 }, { glyphs: "  \u2598\u2598  \u2598\u2598 ", from: 0, to: 0 }],
        "left-12": [{ glyphs: " \u2590\u259B\u2588\u2588\u2588\u259C\u2588 ", from: 2, to: 8 }, { glyphs: "\u259D\u259C\u2588\u2588\u2588\u2588\u2588\u2588\u2580", from: 2, to: 7 }, { glyphs: " \u259D\u259D   \u259D\u259D ", from: 0, to: 0 }]
      }
    };
    var QUAD = {
      " ": 0,
      "\u2598": 1,
      "\u259D": 2,
      "\u2580": 3,
      "\u2596": 4,
      "\u258C": 5,
      "\u259E": 6,
      "\u259B": 7,
      "\u2597": 8,
      "\u259A": 9,
      "\u2590": 10,
      "\u259C": 11,
      "\u2584": 12,
      "\u2599": 13,
      "\u259F": 14,
      "\u2588": 15
    };
    var GRID_W = 18;
    var GRID_H = 10;
    function blankGrid() {
      var g = [];
      for (var r = 0; r < 12; r++) {
        var row = [];
        for (var c = 0; c < GRID_W; c++) {
          row.push(0);
        }
        g.push(row);
      }
      return g;
    }
    function paintChar(g, ch, col, row, mode) {
      var x0 = col * 2;
      var y0 = row * 4;
      var dx, dy, qx, qy;
      if (x0 > GRID_W - 2 || y0 > 8) {
        return;
      }
      if (mode === "lid") {
        for (dx = 0; dx < 2; dx++) {
          for (dy = 0; dy < 4; dy++) {
            g[y0 + dy][x0 + dx] = dy === 3 ? 2 : 1;
          }
        }
        return;
      }
      var bits = QUAD[ch] || 0;
      var masks = [[1, 2], [4, 8]];
      for (qy = 0; qy < 2; qy++) {
        for (qx = 0; qx < 2; qx++) {
          var on = (bits & masks[qy][qx]) !== 0;
          var v = on ? 1 : mode === "dark" ? 2 : 0;
          if (!v) {
            continue;
          }
          g[y0 + qy * 2][x0 + qx] = v;
          g[y0 + qy * 2 + 1][x0 + qx] = v;
        }
      }
    }
    function paintRun(g, glyphs, col, row, mode) {
      Array.from(glyphs).forEach(function(ch, i) {
        paintChar(g, ch, col + i, row, mode);
      });
    }
    function clawdGrid(f) {
      var g = blankGrid();
      var spec = f || {};
      var turn = spec.facing && CLAWD_SOURCE.facing[spec.facing];
      if (turn) {
        turn.forEach(function(row, r) {
          Array.from(row.glyphs).forEach(function(ch, i) {
            paintChar(g, ch, i, r, i >= row.from && i < row.to ? "dark" : "plain");
          });
        });
        return g.slice(0, GRID_H);
      }
      var arms = CLAWD_SOURCE.arms[spec.arms] || CLAWD_SOURCE.arms.down;
      var eyes = CLAWD_SOURCE.eyes[spec.eyes] || CLAWD_SOURCE.eyes.open;
      var feet = CLAWD_SOURCE.feet[spec.feet] || CLAWD_SOURCE.feet.both;
      var col = 2;
      paintRun(g, arms.r1L, 0, 0, "plain");
      eyes.forEach(function(span) {
        paintRun(g, span.glyphs, col, 0, span.lid ? "lid" : "dark");
        col += Array.from(span.glyphs).length;
      });
      paintRun(g, arms.r1R, 8, 0, "plain");
      paintRun(g, arms.r2L, 0, 1, "plain");
      paintRun(g, "\u2588\u2588\u2588\u2588\u2588", 2, 1, "dark");
      paintRun(g, arms.r2R, 7, 1, "plain");
      paintRun(g, feet, 0, 2, "plain");
      return g.slice(0, GRID_H);
    }
    function useClock(animate, fps) {
      var st = useState3(0);
      var t = st[0];
      var setT = st[1];
      useEffect3(function() {
        if (!animate) {
          return void 0;
        }
        var start = Date.now();
        var id = setInterval(function() {
          setT((Date.now() - start) / 1e3);
        }, 1e3 / (fps || 12));
        return function() {
          clearInterval(id);
        };
      }, [animate, fps]);
      return t;
    }
    var SWIVEL = ["edge", "right-75", "right-55", "right-30", "right-12"];
    function actFrame(act, t, animate) {
      var f = { eyes: "open", arms: "down", feet: "both", facing: null, bob: 0 };
      if (act === "urgent") {
        f.arms = "one-up";
      }
      if (act === "cheer") {
        f.arms = "up";
      }
      if (act === "glance") {
        f.eyes = "right";
      }
      if (!animate) {
        return f;
      }
      var blink = t % 3.8 < 0.14;
      if (act === "talk") {
        f.arms = ["down", "one-up", "down", "down"][Math.floor(t * 2.4) % 4];
        f.bob = Math.round(Math.sin(t * 8) * 2);
        if (blink) {
          f.eyes = "closed";
        }
      } else if (act === "urgent") {
        f.arms = Math.floor(t * 3) % 2 ? "up" : "one-up";
        f.bob = -Math.round(Math.abs(Math.sin(t * 9)) * 3);
        if (blink) {
          f.eyes = "closed";
        }
      } else if (act === "cheer") {
        f.arms = Math.floor(t * 3) % 2 ? "down" : "up";
        f.bob = -Math.round(Math.abs(Math.sin(t * 6)) * 6);
        if (blink) {
          f.eyes = "closed";
        }
      } else if (act === "swivel") {
        var i = Math.floor(t * 10);
        if (i < SWIVEL.length) {
          f.facing = SWIVEL[i];
        } else if (blink) {
          f.eyes = "closed";
        }
      } else if (act === "glance") {
        f.eyes = t % 5 < 2.5 ? "right" : "open";
      } else {
        if (blink) {
          f.eyes = "closed";
        }
        var c = t % 9;
        if (c > 6 && c < 6.9) {
          f.eyes = "left";
        }
      }
      return f;
    }
    function Clawd(props) {
      var cell = num(props.cell, 16);
      var animate = bool(props.animate, false) && !reducedMotion();
      var t = useClock(animate, 12);
      var f = actFrame(props.act || "idle", t, animate);
      var pose = props.pose && CLAWD_SOURCE.poses[props.pose];
      if (pose) {
        if (!animate) {
          f.eyes = pose.eyes;
        }
        f.arms = pose.arms;
        f.feet = pose.feet;
      }
      if (props.eyes) {
        f.eyes = props.eyes;
      }
      if (props.arms) {
        f.arms = props.arms;
      }
      if (props.feet) {
        f.feet = props.feet;
      }
      if (props.facing) {
        f.facing = props.facing;
      }
      var grid = clawdGrid(f);
      var body = "";
      var eye = "";
      for (var r = 0; r < GRID_H; r++) {
        var c = 0;
        while (c < GRID_W) {
          var v = grid[r][c];
          if (!v) {
            c++;
            continue;
          }
          var s = c;
          while (c < GRID_W && grid[r][c] === v) {
            c++;
          }
          var d = "M" + s + " " + r + "h" + (c - s) + "v1h-" + (c - s) + "z";
          if (v === 2) {
            eye += d;
          } else {
            body += d;
          }
        }
      }
      return h(
        "svg",
        {
          className: cx("pn-clawd", props.className),
          viewBox: "0 0 " + GRID_W + " " + GRID_H,
          width: GRID_W * cell,
          height: GRID_H * cell,
          shapeRendering: "crispEdges",
          role: "img",
          "aria-label": props.label || "Clawd, the Claude Code mascot",
          style: f.bob ? { transform: "translateY(" + f.bob + "px)" } : void 0
        },
        h("path", { className: "pn-clawd-body", d: body }),
        eye ? h("path", { className: "pn-clawd-eye", d: eye }) : null
      );
    }
    var EVENTS = {
      "needs-input": { tag: "BREAKING", headline: "NEEDS YOUR INPUT", ots: "CLAUDE ASKS", act: "urgent" },
      ready: { tag: "BREAKING", headline: "READY FOR REVIEW", ots: "CHANGES", act: "cheer" },
      complete: { tag: "BREAKING", headline: "WORK COMPLETE", ots: "CLAUDE SAYS", act: "talk" },
      error: { tag: "BREAKING", headline: "STOPPED ON AN ERROR", ots: "THE ERROR", act: "glance" },
      /* Scheduled, not a story; first come, first served like the stories: a
         story on air at the hour delays it, and one landing during it waits */
      hourly: { tag: "ON THE HOUR", headline: "THE HOUR", words: ["ON THE", "HOUR"], ots: "THIS HOUR", act: "talk", ident: 7.5, outro: 1.4 }
    };
    var STATES = {
      "needs-input": { pill: "INPUT", priority: 1 },
      error: { pill: "ERROR", priority: 2 },
      ready: { pill: "READY", priority: 3 },
      working: { pill: "LIVE", priority: 4 }
    };
    function reducedMotion() {
      try {
        return !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
      } catch (e) {
        return false;
      }
    }
    function clamp01(x) {
      return x < 0 ? 0 : x > 1 ? 1 : x;
    }
    function seg(p, a, b) {
      return clamp01((p - a) / (b - a));
    }
    function easeOut(x) {
      return 1 - Math.pow(1 - x, 3);
    }
    function easeInOut(x) {
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    }
    function StatePill(props) {
      var state = STATES[props.state] ? props.state : "working";
      return h("span", { className: cx("pn-pill", "pn-k-" + state) }, props.label || STATES[state].pill);
    }
    function Mark(props) {
      return h(
        "div",
        { className: cx("pn-mark", props.className), style: { fontSize: num(props.size, 40) + "px" } },
        h("span", { className: "pn-chrome pn-mark-letters" }, props.text || "KLWD")
      );
    }
    function TopBand(props) {
      return h(
        "div",
        { className: cx("pn-top", props.inline && "pn-inline") },
        h("div", { className: "pn-bug" }, h(Mark, { size: 40, text: props.mark }))
      );
    }
    var CRAWL_SPEED = 53;
    var CRAWL_LEAD_IN = 22;
    var CRAWL_AHEAD = 120;
    var CRAWL_MAX_STEP = 0.1;
    var CrawlContext = React3.createContext(null);
    function crawlKey(it) {
      if (typeof it === "string") {
        return "text:" + it;
      }
      if (!it) {
        return "none";
      }
      if (it.key) {
        return "key:" + it.key;
      }
      return "text:" + (it.lead ? it.lead + " " : "") + (it.text || "");
    }
    function crawlNext(items, done, last) {
      var waiting = null;
      for (var i = 0; i < items.length; i++) {
        var key = crawlKey(items[i]);
        if (done[key]) {
          continue;
        }
        if (key !== last) {
          return items[i];
        }
        waiting = items[i];
      }
      return waiting;
    }
    function crawlStep2(belt, input) {
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
        offset = started ? -input.view : -CRAWL_LEAD_IN;
      }
      var end = 0;
      for (var i = 0; i < units.length; i++) {
        end += units[i].width;
      }
      var items = input.items || [];
      var done = {};
      for (var key in belt.done) {
        done[key] = true;
      }
      var last = belt.last;
      var laid = [];
      while (items.length && end - offset < input.view + CRAWL_AHEAD && laid.length < 32) {
        var item = crawlNext(items, done, last);
        if (item === null) {
          done = {};
          item = crawlNext(items, done, last);
        }
        var width = num(input.measure(item), 0);
        if (!(width > 0)) {
          break;
        }
        last = crawlKey(item);
        done[last] = true;
        units.push({ key: last, item, width });
        laid.push(item);
        end += width;
        started = true;
      }
      return { belt: { offset, units, done, last, started }, dropped, laid };
    }
    function crawlUnit(it) {
      var unit = document.createElement("span");
      unit.className = "pn-ticker-unit";
      var body = document.createElement("span");
      body.className = "pn-ticker-item";
      var lead = typeof it === "string" ? null : it.lead;
      if (lead) {
        var tag = document.createElement("span");
        tag.className = "pn-ticker-lead";
        tag.textContent = lead + " ";
        body.appendChild(tag);
      }
      body.appendChild(document.createTextNode(typeof it === "string" ? it : it.text || ""));
      var sep = document.createElement("i");
      sep.className = "pn-ticker-sep";
      unit.appendChild(body);
      unit.appendChild(sep);
      return unit;
    }
    function crawlWidth(node) {
      return parseFloat(window.getComputedStyle(node).width) || 0;
    }
    function Belt(props) {
      var shared = React3.useContext(CrawlContext);
      var own = useState3(function() {
        return { belt: null };
      })[0];
      var store = shared || own;
      var ref = React3.useRef(null);
      var items = React3.useRef(props.items);
      items.current = props.items;
      React3.useLayoutEffect(function() {
        var el = ref.current;
        var view = el ? el.parentNode : null;
        if (!el || !view) {
          return void 0;
        }
        var clock2 = window.performance && window.performance.now ? function() {
          return window.performance.now();
        } : Date.now;
        var later = window.requestAnimationFrame ? function(f) {
          return window.requestAnimationFrame(f);
        } : function(f) {
          return window.setTimeout(function() {
            f(clock2());
          }, 16);
        };
        var cancel = window.cancelAnimationFrame ? function(id) {
          window.cancelAnimationFrame(id);
        } : function(id) {
          window.clearTimeout(id);
        };
        var belt = store.belt || { offset: -CRAWL_LEAD_IN, units: [], done: {}, last: null, started: false };
        belt.units.forEach(function(u) {
          el.appendChild(crawlUnit(u.item));
        });
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
          var dt = then === null ? 0 : (now - then) / 1e3;
          then = now;
          for (var i = 0; i < belt.units.length; i++) {
            var node = el.children[i];
            var w = node ? crawlWidth(node) : 0;
            if (w > 0) {
              belt.units[i].width = w;
            }
          }
          var next = crawlStep2(belt, { dt, speed: CRAWL_SPEED, view: view.clientWidth, items: items.current, measure });
          for (var d = 0; d < next.dropped; d++) {
            if (el.firstChild) {
              el.removeChild(el.firstChild);
            }
          }
          next.laid.forEach(function(item) {
            el.appendChild(crawlUnit(item));
          });
          belt = next.belt;
          store.belt = belt;
          el.style.transform = "translateX(" + -belt.offset + "px)";
        }
        function frame(now) {
          step(now);
          raf = later(frame);
        }
        step(clock2());
        raf = later(frame);
        return function() {
          cancel(raf);
          while (el.firstChild) {
            el.removeChild(el.firstChild);
          }
        };
      }, [store]);
      return h("div", { ref, className: "pn-ticker-belt" });
    }
    function Ticker2(props) {
      var scene = props.sample && SAMPLES[props.sample] || {};
      var items = props.items && props.items.length ? props.items : scene.ticker || [];
      var time = props.time || scene.clock;
      var crawl = bool(props.animate, false) && !reducedMotion();
      var offset = num(props.offset, 0);
      function half(prefix) {
        var out = [];
        items.forEach(function(it, i) {
          var lead = typeof it === "string" ? null : it.lead;
          var text = typeof it === "string" ? it : it.text;
          out.push(h(
            "span",
            { key: prefix + "i" + i, className: "pn-ticker-item" },
            lead ? h("span", { className: "pn-ticker-lead" }, lead + " ") : null,
            text
          ));
          out.push(h("i", { key: prefix + "s" + i, className: "pn-ticker-sep" }));
        });
        return out;
      }
      return h(
        "div",
        { className: cx("pn-ticker", props.inline && "pn-inline") },
        h("div", { className: "pn-ticker-label" }, h("span", null, props.label || "LATEST")),
        h(
          "div",
          { className: "pn-ticker-view" },
          crawl ? h(Belt, { items }) : h("div", {
            className: "pn-ticker-track",
            style: offset ? { transform: "translateX(" + -offset + "px)" } : void 0
          }, half("a"))
        ),
        time ? h("div", { className: "pn-ticker-clock" }, h("span", null, time)) : null
      );
    }
    var PAGE_ROWS = 4;
    var BOARD_PAGE_MS = 8e3;
    var REVIEW_PAGE_MS = 1e4;
    var TURN = { stagger: 110, leave: 420, enter: 460 };
    var TURN_MS = PAGE_ROWS * TURN.stagger + TURN.leave + TURN.enter;
    function pageCount(n) {
      return Math.max(1, Math.ceil(n / PAGE_ROWS));
    }
    function pageItems(items, page) {
      return items.slice(page * PAGE_ROWS, (page + 1) * PAGE_ROWS);
    }
    function usePages(items, pageMs, animate) {
      var latest = React3.useRef(items);
      latest.current = items;
      var shown = React3.useRef({ items, page: 0 });
      var turn = React3.useRef({ prev: null, n: 0 });
      var redraw = useState3(0)[1];
      if (items.length <= PAGE_ROWS && shown.current.items.length <= PAGE_ROWS) {
        shown.current = { items, page: 0 };
      }
      useEffect3(function() {
        if (!animate) {
          return void 0;
        }
        var begun = Date.now();
        var next;
        var settle;
        function later() {
          next = setTimeout(step, pageMs - (Date.now() - begun) % pageMs);
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
            settle = setTimeout(function() {
              turn.current = { prev: null, n: turn.current.n };
              redraw(function(k) {
                return k + 1;
              });
            }, TURN_MS);
          }
          redraw(function(k) {
            return k + 1;
          });
          later();
        }
        later();
        return function() {
          clearTimeout(next);
          clearTimeout(settle);
        };
      }, [animate, pageMs]);
      var pushing = animate && !reducedMotion();
      return { items: shown.current.items, page: shown.current.page, prev: pushing ? turn.current.prev : null, n: turn.current.n };
    }
    function pageSlots(view, slotClass, rowClass, content) {
      var cur = pageItems(view.items, view.page);
      var before = view.prev ? pageItems(view.prev.items, view.prev.page) : [];
      var slots = [];
      for (var r = 0; r < Math.max(cur.length, before.length); r += 1) {
        var faces = [];
        if (before[r]) {
          faces.push(h("div", {
            key: "out:" + view.n + ":" + (before[r].id || r),
            className: cx(rowClass, "pn-turn-leave"),
            style: { animationDelay: r * TURN.stagger + "ms" }
          }, content(before[r])));
        }
        if (cur[r]) {
          faces.push(h("div", {
            key: "in:" + view.n + ":" + (cur[r].id || r),
            className: cx(rowClass, view.prev && "pn-turn-enter"),
            style: view.prev ? { animationDelay: r * TURN.stagger + TURN.leave + "ms" } : void 0
          }, content(cur[r])));
        }
        slots.push(h("div", { key: r, className: slotClass }, faces));
      }
      return slots;
    }
    function pageTab(view, tabClass) {
      var pages = pageCount(view.items.length);
      var before = view.prev ? pageCount(view.prev.items.length) : 1;
      if (pages < 2 && before < 2) {
        return null;
      }
      var faces = [];
      if (view.prev && before > 1) {
        faces.push(h("div", {
          key: "out:" + view.n,
          className: "pn-page pn-turn-leave",
          style: { animationDelay: PAGE_ROWS * TURN.stagger + "ms" }
        }, pageWords(view.prev.page, before)));
      }
      if (pages > 1) {
        faces.push(h("div", {
          key: "in:" + view.n,
          className: cx("pn-page", view.prev && "pn-turn-enter"),
          style: view.prev ? { animationDelay: PAGE_ROWS * TURN.stagger + TURN.leave + "ms" } : void 0
        }, pageWords(view.page, pages)));
      }
      return h("div", { className: tabClass }, faces);
    }
    function pageWords(page, pages) {
      return h("span", { className: "pn-ticker-clock pn-page-tab" }, h("span", null, page + 1 + " OF " + pages));
    }
    var LIMITS = [
      { kind: "session", label: "SESSION", name: "Session limit" },
      { kind: "week", label: "WEEK", name: "Weekly limit" }
    ];
    function limitStep(percent) {
      return percent >= 90 ? "top" : percent >= 70 ? "high" : null;
    }
    function LimitMeters(props) {
      var given = props.limits || [];
      var meters = [];
      LIMITS.forEach(function(limit) {
        var found = null;
        given.forEach(function(meter) {
          if (meter && meter.kind === limit.kind) {
            found = meter;
          }
        });
        if (!found) {
          return;
        }
        var percent = Math.max(0, Math.min(100, Math.round(num(found.percent, 0))));
        var step = limitStep(percent);
        meters.push(h(
          "span",
          {
            key: limit.kind,
            className: cx("pn-limit", step && "pn-limit--" + step),
            role: "img",
            "aria-label": limit.name + ", " + percent + "% used"
          },
          h("span", { className: "pn-ticker-lead" }, limit.label),
          h("span", { className: "pn-limit-track" }, h("i", { className: "pn-limit-fill", style: { width: percent + "%" } })),
          h("span", { className: "pn-limit-figure" }, percent + "%")
        ));
      });
      return meters.length ? h("div", { className: "pn-board-limits" }, meters) : null;
    }
    function SessionBoard(props) {
      var scene = props.sample && SAMPLES[props.sample] || {};
      var list = (props.sessions || scene.sessions || []).slice();
      if (bool(props.sort, true)) {
        list.sort(function(a, b) {
          return (STATES[a.state] || STATES.working).priority - (STATES[b.state] || STATES.working).priority;
        });
      }
      var view = usePages(list, BOARD_PAGE_MS, bool(props.animate, false));
      return h(
        "div",
        { className: cx("pn-board", props.inline && "pn-inline") },
        pageSlots(view, "pn-board-slot", "pn-row", function(s) {
          return [
            /* The project leads the row on a plate, as chosen on PiP
               Newsroom · Project in the listing; a session without one has
               no plate */
            s.project ? h("span", { key: "project", className: "pn-row-project" }, h("span", null, s.project)) : null,
            h("span", { key: "name", className: "pn-row-name" }, s.name),
            h(StatePill, { key: "pill", state: s.state })
          ];
        }),
        pageTab(view, "pn-board-tab"),
        h(LimitMeters, { limits: props.limits || scene.limits })
      );
    }
    function LowerThird(props) {
      var kind = EVENTS[props.kind] ? props.kind : "needs-input";
      var ev = EVENTS[kind];
      var strap = props.strap || props.session;
      var family = kind === "hourly" ? "hourly" : "breaking";
      return h(
        "div",
        { className: cx("pn-l3", "pn-k-" + family, props.inline && "pn-inline") },
        h(
          "div",
          { className: "pn-l3-line" },
          h("div", { className: "pn-l3-tag" }, h("span", null, props.tag || ev.tag)),
          h("div", { className: "pn-l3-head" }, h("span", null, props.headline || ev.headline), h("i", { className: "pn-l3-sweep", "aria-hidden": "true" }, h("i", { className: "pn-l3-glint" })))
        ),
        strap ? h("div", { className: "pn-l3-strap" }, h(
          "span",
          null,
          h("span", { className: "pn-l3-title" }, strap),
          props.project ? h("b", null, "\xB7 " + props.project) : null
        )) : null
      );
    }
    function OTSBox(props) {
      var kind = EVENTS[props.kind] ? props.kind : "needs-input";
      return h(
        "div",
        { className: cx("pn-ots", "pn-k-" + kind, props.inline && "pn-inline") },
        h(
          "div",
          { className: "pn-monitor-screen" },
          h("div", { className: "pn-ots-head" }, props.label || EVENTS[kind].ots),
          h(
            "div",
            { className: "pn-ots-body" },
            /* A long figure (the hour's "+1,482 -356") steps down a size to stay on one line */
            props.figure ? h("div", { className: cx("pn-ots-figure", String(props.figure).length > 9 && "pn-ots-figure--long") }, props.figure) : null,
            /* a permission ask: the command in gold, Claude's description of it under it */
            props.command ? h("div", { className: "pn-ots-command" }, props.command) : null,
            props.quote ? h("div", { className: "pn-ots-quote" }, props.quote) : null,
            props.sub ? h("div", { className: "pn-ots-sub" }, props.sub) : null
          ),
          props.foot ? h("div", { className: "pn-ots-foot" }, props.foot) : null
        )
      );
    }
    var PANES = (function() {
      var rnd = seeded(5813);
      var out = [];
      for (var r = 0; r < 6; r++) {
        for (var c = 0; c < 11; c++) {
          out.push({ x: c * 100 - 70, y: r * 100 - 30, d: c * 100 + r * 60, v: rnd() });
        }
      }
      return out;
    })();
    var MOTION_RATE = 60;
    var MOTION_EPSILON = 1e-3;
    function round4(v) {
      return +v.toFixed(4);
    }
    var NUMBER = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi;
    function numbersOf(style, names) {
      var out = [];
      names.forEach(function(name) {
        String(style[name]).replace(NUMBER, function(m) {
          out.push(parseFloat(m));
          return m;
        });
      });
      return out;
    }
    function motionFrames(at2, dur) {
      var n = Math.max(1, Math.round(dur * MOTION_RATE));
      var frames = [];
      for (var i = 0; i <= n; i++) {
        var style = at2(i / n);
        var frame = { offset: i / n };
        for (var name in style) {
          if (Object.prototype.hasOwnProperty.call(style, name)) {
            frame[name] = style[name];
          }
        }
        frames.push(frame);
      }
      var names = Object.keys(frames[0]).filter(function(key) {
        return key !== "offset";
      });
      var values = frames.map(function(f) {
        return numbersOf(f, names);
      });
      var kept = [0];
      for (var k = 1; k < n; k++) {
        var a = kept[kept.length - 1];
        var b = k + 1;
        var straight = true;
        for (var j = a + 1; j < b && straight; j++) {
          var t = (j - a) / (b - a);
          for (var v = 0; v < values[j].length; v++) {
            var line = values[a][v] + (values[b][v] - values[a][v]) * t;
            if (Math.abs(values[j][v] - line) > MOTION_EPSILON) {
              straight = false;
              break;
            }
          }
        }
        if (!straight) {
          kept.push(k);
        }
      }
      kept.push(n);
      return kept.map(function(i2) {
        return frames[i2];
      });
    }
    function useMotion(animate, dur, run) {
      var ref = useRef2(null);
      var moves = {};
      var latest = useRef2(moves);
      latest.current = moves;
      useLayoutEffect(function() {
        var root = ref.current;
        if (!animate || !root || typeof root.animate !== "function") {
          return void 0;
        }
        var pieces = Array.prototype.slice.call(root.querySelectorAll("[data-pn-move]"));
        if (root.hasAttribute("data-pn-move")) {
          pieces.unshift(root);
        }
        var running = [];
        pieces.forEach(function(el) {
          var at2 = latest.current[el.getAttribute("data-pn-move")];
          if (at2) {
            running.push(el.animate(motionFrames(at2, dur), { duration: dur * 1e3, fill: "both" }));
          }
        });
        return function() {
          running.forEach(function(anim) {
            anim.cancel();
          });
        };
      }, [animate, dur, run]);
      return {
        ref,
        move: function(id, at2) {
          moves[id] = at2;
          return id;
        }
      };
    }
    function glassWall(p, back, wave, move) {
      return [
        h(
          "div",
          { key: "wall", className: "pn-stinger-wall", "aria-hidden": "true" },
          PANES.map(function(g, i) {
            var at2 = function(x) {
              var front = back ? 1450 - 1700 * wave(x) : -250 + 1700 * wave(x);
              var lit = clamp01(1 - Math.abs(g.d - front) / 260);
              var settled2 = g.d < front ? 0.08 + 0.3 * g.v : 0.04;
              return { opacity: round4(Math.max(0.75 * lit, settled2)) };
            };
            return h("div", { key: i, className: "pn-stinger-pane", "data-pn-move": move("pane-" + i, at2), style: { left: g.x + "px", top: g.y + "px", opacity: at2(p).opacity } });
          })
        ),
        h("div", { key: "glass", className: "pn-stinger-glass" })
      ];
    }
    function chromeLine(word, className, p, lineAt, glintAt, move) {
      function windowAt(x) {
        return { transform: "translateX(" + round4(-163 + 320 * glintAt(x)) + "%)" };
      }
      function copyAt(x) {
        return { transform: "translateX(" + round4(163 - 320 * glintAt(x)) + "%)" };
      }
      return h(
        "div",
        { key: word, className, "data-pn-move": move("line-" + word, lineAt), style: lineAt(p) },
        h(
          "div",
          { className: "pn-stinger-cast" },
          h("span", { className: "pn-stinger-ink", "aria-hidden": "true" }, word),
          h("span", { className: "pn-stinger-face" }, word)
        ),
        h(
          "span",
          { className: "pn-stinger-glint", "aria-hidden": "true", "data-pn-move": move("glint-" + word, windowAt), style: windowAt(p) },
          h("span", { className: "pn-stinger-shine", "data-pn-move": move("shine-" + word, copyAt), style: copyAt(p) }, word)
        )
      );
    }
    var BREAKING = { words: ["BREAKING", "NEWS"], duration: 1.4, outro: 1.2 };
    function Stinger(props) {
      var outro = bool(props.outro, false);
      var animate = bool(props.animate, false) && !reducedMotion();
      var dur = num(props.duration, outro ? BREAKING.outro : BREAKING.duration);
      var words = props.words || BREAKING.words;
      var motion = useMotion(animate, dur, (outro ? "outro " : "intro ") + words.join(" "));
      var p = animate ? 1 : clamp01(num(props.progress, 1));
      if (outro) {
        return outroPicture(p, words, motion);
      }
      var lines = words.map(function(w, i) {
        return chromeLine(w, "pn-stinger-line", p, function(x) {
          var s = easeOut(seg(x, 0.22 + 0.1 * i, 0.5 + 0.1 * i));
          return {
            opacity: round4(s),
            transform: "translateX(" + round4((1 - s) * -140) + "px) scale(" + round4(1.3 - 0.3 * s) + ")"
          };
        }, function(x) {
          return seg(x, 0.6, 0.92);
        }, motion.move);
      });
      return h(
        "div",
        { ref: motion.ref, className: "pn-stinger pn-k-breaking" },
        glassWall(p, false, function(x) {
          return x;
        }, motion.move),
        h("div", { className: "pn-stinger-words" }, lines)
      );
    }
    function outroPicture(p, words, motion) {
      var lines = words.map(function(w, i) {
        return chromeLine(w, "pn-stinger-line", p, function(x) {
          var s = easeInOut(seg(x, 0.1 + 0.12 * i, 0.45 + 0.12 * i));
          return {
            opacity: round4(1 - s),
            transform: "translateX(" + round4(s * 180) + "px) scale(" + round4(1 + 0.25 * s) + ")"
          };
        }, function(x) {
          return seg(x, 0, 0.3);
        }, motion.move);
      });
      function fadeAt(x) {
        return { opacity: round4(1 - easeInOut(seg(x, 0.7, 1))) };
      }
      return h(
        "div",
        { ref: motion.ref, className: "pn-stinger pn-k-breaking", "data-pn-move": motion.move("open", fadeAt), style: fadeAt(p) },
        glassWall(p, true, function(x) {
          return seg(x, 0, 0.75);
        }, motion.move),
        h("div", { className: "pn-stinger-words" }, lines)
      );
    }
    var STRIKE = 2 / 3;
    function minuteBefore(hhmm) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || ""));
      if (!m) {
        return "14:59";
      }
      var total = (parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + 1439) % 1440;
      return pad22(Math.floor(total / 60)) + ":" + pad22(total % 60);
    }
    function pad22(n) {
      return (n < 10 ? "0" : "") + n;
    }
    function hoursMinutes(hhmm) {
      var m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "")) || [0, "15", "00"];
      return [parseInt(m[1], 10), parseInt(m[2], 10)];
    }
    function tickEase(x) {
      var u = clamp01(x / 0.16) - 1;
      return 1 + 2.6 * u * u * u + 1.6 * u * u;
    }
    function stationClock(c) {
      var hm = hoursMinutes(c.prev);
      function jump(x) {
        var t = c.time(x);
        return t < 0 ? 0 : tickEase(t);
      }
      function seconds(x) {
        var sec = 60 + c.time(x);
        var whole = Math.floor(sec);
        return (whole - 1 + tickEase(sec - whole)) * 6;
      }
      function turn(angle) {
        return function(x) {
          return { transform: "rotate(" + round4(angle(x)) + "deg)" };
        };
      }
      var hourAt = turn(function(x) {
        return (hm[0] % 12 + (hm[1] + jump(x)) / 60) * 30;
      });
      var minuteAt = turn(function(x) {
        return (hm[1] + jump(x)) * 6;
      });
      var secondAt = turn(seconds);
      function glintAt(x) {
        var t = c.time(x);
        var g = t < 0 ? 0 : seg(t, 0.02, 0.55);
        return { transform: "translateX(" + round4(537.6 * g) + "px) skewX(-20deg)" };
      }
      var marks = [];
      for (var i = 0; i < 60; i++) {
        marks.push(h("i", { key: i, className: i % 5 === 0 ? "pn-dial-hour" : "pn-dial-min", style: { transform: "rotate(" + i * 6 + "deg)" } }));
      }
      function piece(cls, id, at2) {
        return h("i", { className: cls, "data-pn-move": c.move(id, at2), style: at2(c.x) });
      }
      return h(
        "div",
        { className: "pn-dial", "aria-hidden": "true" },
        h(
          "div",
          { className: "pn-dial-face" },
          marks,
          h("div", { className: "pn-dial-mark pn-chrome" }, "KLWD"),
          piece("pn-dial-hand pn-dial-hand--h", "hour-hand", hourAt),
          piece("pn-dial-hand pn-dial-hand--m", "minute-hand", minuteAt),
          piece("pn-dial-sec", "second-hand", secondAt),
          h("i", { className: "pn-dial-cap" }),
          piece("pn-dial-glint", "dial-glint", glintAt)
        )
      );
    }
    function Ident(props) {
      var outro = bool(props.outro, false);
      var animate = bool(props.animate, false) && !reducedMotion();
      var dur = num(props.duration, outro ? EVENTS.hourly.outro : EVENTS.hourly.ident);
      var hour = props.hour || "15:00";
      var words = props.words || EVENTS.hourly.words;
      var motion = useMotion(animate, dur, (outro ? "outro " : "intro ") + hour + " " + words.join(" "));
      var q = animate ? 1 : clamp01(num(props.progress, 1));
      function P(x) {
        return outro ? 1 : x;
      }
      function O(x) {
        return outro ? x : 0;
      }
      var struck = P(q) >= STRIKE;
      var now = struck ? 60 : Math.floor(55 + 5 * P(q) / STRIKE);
      function glintAt(x) {
        return outro ? seg(O(x), 0, 0.3) : seg(P(x), 0.88, 1);
      }
      var lines = words.map(function(w, i) {
        return chromeLine(w, "pn-stinger-line pn-ident-line", q, function(x) {
          var s = easeOut(seg(P(x), STRIKE + 0.04 + 0.06 * i, STRIKE + 0.16 + 0.06 * i));
          var leave = outro ? easeInOut(seg(O(x), 0.15 + 0.12 * i, 0.5 + 0.12 * i)) : 0;
          return {
            opacity: round4(s * (1 - leave)),
            transform: "translateX(" + round4((1 - s) * 160 + leave * 180) + "px) scale(" + round4(1.3 - 0.3 * s + 0.25 * leave) + ")"
          };
        }, glintAt, motion.move);
      });
      function clockAt(x) {
        var aside = easeInOut(seg(P(x), STRIKE + 0.01, STRIKE + 0.16));
        var drop = outro ? easeInOut(seg(O(x), 0.4, 0.72)) : 0;
        var sc = (1 - 0.2 * aside) * (1 - 0.3 * drop);
        return {
          opacity: round4(1 - drop),
          transform: "translate(" + round4(480 - 230 * aside) + "px, 268px) scale(" + round4(sc) + ")"
        };
      }
      function raysAt(x) {
        return { transform: "rotate(" + round4(P(x) * 30 + O(x) * 12) + "deg)" };
      }
      function fadeAt(x) {
        return { opacity: round4(1 - easeInOut(seg(O(x), 0.7, 1))) };
      }
      var clock2 = stationClock({ prev: minuteBefore(hour), time: function(x) {
        return (P(x) - STRIKE) * EVENTS.hourly.ident;
      }, x: q, move: motion.move });
      return h(
        "div",
        { ref: motion.ref, className: cx("pn-ident", "pn-k-hourly"), "data-pn-move": outro ? motion.move("open", fadeAt) : void 0, style: outro ? fadeAt(q) : void 0 },
        h("div", { className: "pn-ident-rays", "data-pn-move": motion.move("rays", raysAt), style: raysAt(q) }),
        h("div", {
          className: "pn-ident-clock",
          role: "img",
          "aria-label": struck ? "The station clock at " + hour : "The station clock, " + (60 - now) + " seconds to " + hour,
          "data-pn-move": motion.move("clock", clockAt),
          style: clockAt(q)
        }, clock2),
        h("div", { className: "pn-ident-words" }, lines)
      );
    }
    function HourReview(props) {
      var scene = props.sample && SAMPLES[props.sample] || {};
      var rows = (props.rows || scene.rows || []).slice().sort(function(a, b) {
        return (STATES[a.state] || STATES.working).priority - (STATES[b.state] || STATES.working).priority;
      });
      var view = usePages(rows, REVIEW_PAGE_MS, bool(props.animate, false));
      return h(
        "div",
        { className: cx("pn-review", props.inline && "pn-inline") },
        h(
          "div",
          { className: "pn-review-head" },
          h("div", { className: "pn-review-tag" }, h("span", null, props.span || scene.span || "14:00\u201315:00")),
          h("div", { className: "pn-review-title" }, h("span", null, props.label || "THE HOUR IN REVIEW"))
        ),
        h("div", { className: "pn-review-rows" }, pageSlots(view, "pn-review-slot", "pn-review-row", function(r) {
          var st = STATES[r.state] ? r.state : "working";
          return [
            r.name && r.project ? h("span", { key: "project", className: "pn-row-project" }, h("span", null, r.project)) : null,
            h(
              "div",
              { key: "body", className: "pn-review-body" },
              h("div", { className: "pn-review-name" }, r.name || r.project),
              r.detail ? h("div", { className: "pn-review-meta" }, r.detail) : null
            ),
            h(StatePill, { key: "pill", state: st })
          ];
        })),
        pageTab(view, "pn-review-tab")
      );
    }
    function seeded(a) {
      return function() {
        a = a + 1831565813 | 0;
        var t = Math.imul(a ^ a >>> 15, 1 | a);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
      };
    }
    var DAY_PARTS = ["morning", "afternoon", "evening", "night"];
    function dayPart(time) {
      var m = /^(\d{1,2}):(\d{2})/.exec(String(time || ""));
      if (!m) {
        return "evening";
      }
      var hr = parseInt(m[1], 10) % 24;
      if (hr >= 21 || hr < 5) {
        return "night";
      }
      if (hr < 11) {
        return "morning";
      }
      if (hr < 17) {
        return "afternoon";
      }
      return "evening";
    }
    var LIT = { morning: [0.08, 0.08], afternoon: [0, 0], evening: [0.3, 0.3], night: [0.45, 0.55] };
    var SKYLINE = (function() {
      var rnd = seeded(20261020);
      var towers = "";
      var windows = [];
      var beacons = "";
      var x = -12;
      var horizon = 330;
      while (x < 972) {
        var w = 36 + Math.floor(rnd() * 6) * 10;
        var tall = 70 + Math.floor(rnd() * 14) * 10 + (rnd() < 0.18 ? 60 : 0);
        var top = horizon - tall;
        towers += "M" + x + " " + top + "h" + w + "v" + tall + "h-" + w + "z";
        if (rnd() < 0.3) {
          var mx = x + Math.floor(w / 2) - 1;
          towers += "M" + mx + " " + (top - 24) + "h3v24h-3z";
          beacons += "M" + (mx - 1) + " " + (top - 29) + "h5v5h-5z";
        }
        for (var wy = top + 10; wy < horizon - 10; wy += 14) {
          for (var wx = x + 6; wx < x + w - 8; wx += 10) {
            windows.push({ d: "M" + wx + " " + wy + "h4v6h-4z", r: rnd() });
          }
        }
        x += w + 4 + Math.floor(rnd() * 3) * 4;
      }
      var parts = {};
      DAY_PARTS.forEach(function(k) {
        var warm = "";
        var cool = "";
        var dark = "";
        windows.forEach(function(wd) {
          if (wd.r < LIT[k][0]) {
            warm += wd.d;
          } else if (wd.r < LIT[k][1]) {
            cool += wd.d;
          } else {
            dark += wd.d;
          }
        });
        parts[k] = { warm, cool, dark };
      });
      var srnd = seeded(1969);
      var stars = "";
      for (var i = 0; i < 46; i++) {
        var sz = srnd() < 0.2 ? 3 : 2;
        stars += "M" + Math.floor(srnd() * 960) + " " + (6 + Math.floor(srnd() * 150)) + "h" + sz + "v" + sz + "h-" + sz + "z";
      }
      return { towers, parts, beacons, stars };
    })();
    var MULLIONS = "M232 0h10v330h-10zM482 0h10v330h-10zM722 0h10v330h-10zM0 96h960v7h-960z";
    var SCRIPT = (function() {
      function pt(X, Z, lift) {
        var p = 800 / (800 + Z);
        return (480 + (X - 480) * p).toFixed(1) + " " + (350 - Z * 0.16 * p - lift).toFixed(1);
      }
      function sheet(cx2, cz, deg) {
        var a = deg * Math.PI / 180;
        var c = Math.cos(a);
        var sn = Math.sin(a);
        return function(dx, dz2, lift) {
          return pt(cx2 + dx * c - dz2 * sn, cz + dx * sn + dz2 * c, lift || 0);
        };
      }
      function poly(list) {
        return "M" + list.join("L") + "Z";
      }
      var W = 46;
      var L = 59;
      var st = sheet(388, 66, -6);
      var top = sheet(384, 68, -11);
      var leaves = "";
      [1.4, 2.8, 4.2].forEach(function(lift) {
        leaves += "M" + st(-W, -L, lift) + "L" + st(W, -L, lift);
      });
      var type = "";
      for (var i = 0, dz = -L + 22; dz < L - 8; dz += 8.5, i++) {
        var end = i % 4 === 3 ? W - 30 : W - 8;
        type += "M" + top(-W + 8, dz, 6) + "L" + top(end, dz, 6);
      }
      return {
        edge: poly([st(-W, -L, 0), st(W, -L, 0), st(W, -L, 5), st(W, L, 5), st(-W, L, 5), st(-W, -L, 5)]),
        stackTop: poly([st(-W, -L, 5), st(W, -L, 5), st(W, L, 5), st(-W, L, 5)]),
        leaves,
        page: poly([top(-W, -L, 6), top(W, -L, 6), top(W, L, 6), top(-W, L, 6)]),
        head: poly([top(-W, -L, 6), top(W, -L, 6), top(W, -L + 13, 6), top(-W, -L + 13, 6)]),
        type
      };
    })();
    function NewsDesk(props) {
      var kind = EVENTS[props.kind] ? props.kind : "needs-input";
      var part = DAY_PARTS.indexOf(props.part) >= 0 ? props.part : dayPart(props.time);
      var city = SKYLINE.parts[part];
      var dark = part === "evening" || part === "night";
      return h(
        "div",
        { className: cx("pn-desk", "pn-desk--" + part, "pn-k-" + kind) },
        h("div", { className: "pn-sky" }),
        h(
          "svg",
          { className: "pn-skyline", viewBox: "0 0 960 540", "aria-hidden": "true" },
          part === "night" ? h("path", { className: "pn-stars", d: SKYLINE.stars }) : null,
          h("path", { className: "pn-towers", d: SKYLINE.towers }),
          h("path", { className: "pn-win-dark", d: city.dark }),
          city.warm ? h("path", { className: "pn-win-lit", d: city.warm }) : null,
          city.cool ? h("path", { className: "pn-win-cool", d: city.cool }) : null,
          dark ? h("path", { className: "pn-beacons", d: SKYLINE.beacons }) : null,
          h("path", { className: "pn-mullions", d: MULLIONS })
        ),
        h("div", { className: "pn-glow", "aria-hidden": "true" }),
        h(
          "div",
          { className: "pn-anchor" },
          h(Clawd, { cell: 18, act: props.act || EVENTS[kind].act, animate: props.animate, pose: props.pose, eyes: props.eyes, arms: props.arms, facing: props.facing })
        ),
        h("div", { className: "pn-desk-front" }),
        h("div", { className: "pn-desk-top" }),
        h("div", { className: "pn-script-shadow", "aria-hidden": "true" }),
        h(
          "svg",
          { className: "pn-script", viewBox: "0 0 960 540", "aria-hidden": "true" },
          h("path", { className: "pn-script-edge", d: SCRIPT.edge }),
          h("path", { className: "pn-script-leaves", d: SCRIPT.leaves }),
          h("path", { className: "pn-script-stack", d: SCRIPT.stackTop }),
          h("path", { className: "pn-script-page", d: SCRIPT.page }),
          h("path", { className: "pn-script-head", d: SCRIPT.head }),
          h("path", { className: "pn-script-type", d: SCRIPT.type })
        ),
        h(
          "div",
          { className: "pn-mug", "aria-hidden": "true" },
          h("i", { className: "pn-mug-handle" }),
          h("i", { className: "pn-mug-body" }),
          h("i", { className: "pn-mug-rim" })
        ),
        h(
          "svg",
          { className: "pn-desk-lip", viewBox: "0 0 960 540", "aria-hidden": "true" },
          h("path", { className: "pn-lip-chrome", d: "M0 348Q480 358 960 348V353Q480 363 0 353Z" }),
          h("path", { className: "pn-lip-lo", d: "M0 351Q480 361 960 351V353Q480 363 0 353Z" }),
          h("path", { className: "pn-lip-hi", d: "M0 348Q480 358 960 348V349.5Q480 359.5 0 349.5Z" }),
          h("path", { className: "pn-lip-gold", d: "M0 353Q480 363 960 353V356Q480 366 0 356Z" })
        )
      );
    }
    function useRun(run, animate) {
      var st = useState3(0);
      var i = st[0];
      var setI = st[1];
      var n = run && run.length ? run.length : 0;
      useEffect3(function() {
        if (!n || !animate) {
          return void 0;
        }
        var id = setTimeout(function() {
          setI(function(x) {
            return x + 1;
          });
        }, Math.max(0.4, num(run[i % n].dur, 4)) * 1e3);
        return function() {
          clearTimeout(id);
        };
      }, [n, animate, i]);
      if (!n) {
        return null;
      }
      return { scene: run[i % n].scene, index: i % n, step: i };
    }
    var SIGNAL = { period: 9e3, waves: 3 };
    function Signal() {
      var at2 = useState3(function() {
        return Date.now();
      })[0];
      var waves = [];
      for (var i = 0; i < SIGNAL.waves; i++) {
        var lead = (at2 + i * SIGNAL.period / SIGNAL.waves) % SIGNAL.period;
        waves.push(h("i", { key: i, style: { animationDelay: -lead + "ms" } }));
      }
      return h("div", { className: "pn-signal", "aria-hidden": "true" }, waves);
    }
    function Broadcast2(props) {
      var animate = bool(props.animate, false);
      var run = props.run || props.sample && RUNS[props.sample] || null;
      var live = useRun(run, animate);
      var scene = live && live.scene || props.scene || SAMPLES[props.sample] || SAMPLES["run-board"];
      var mode = scene.mode || "board";
      var ev = scene.event || {};
      var kind = EVENTS[ev.kind] ? ev.kind : "needs-input";
      var parts = [];
      if (mode === "desk") {
        parts.push(h(NewsDesk, { key: "desk", kind, act: scene.act, time: scene.clock, animate }));
        parts.push(h(OTSBox, { key: "ots", kind, label: ev.label, command: ev.command, quote: ev.quote, figure: ev.figure, sub: ev.sub, foot: ev.foot }));
        parts.push(h(LowerThird, {
          key: "l3",
          kind,
          headline: scene.headline,
          strap: scene.strap,
          session: ev.session,
          project: ev.project
        }));
      } else if (mode === "stinger") {
        parts.push(h(Stinger, { key: "st", kind, progress: scene.progress, animate }));
      } else if (mode === "outro") {
        var back = scene.board || {};
        parts.push(h(
          "div",
          { key: "under", className: "pn-board-under", style: { position: "absolute", left: 0, top: 0, width: STAGE_W + "px", height: STAGE_H + "px", zIndex: 0 } },
          animate ? h(Signal) : null,
          h(SessionBoard, { sessions: back.sessions, limits: back.limits }),
          h(Ticker2, { items: back.ticker, time: back.clock, animate })
        ));
        parts.push(scene.open === "hour" ? h(Ident, { key: "id-out", outro: true, hour: scene.hour, progress: scene.progress, animate }) : h(Stinger, { key: "st", outro: true, progress: scene.progress, animate }));
      } else if (mode === "ident") {
        parts.push(h(Ident, { key: "id", hour: scene.hour, progress: scene.progress, animate }));
      } else if (mode === "review") {
        parts.push(h(HourReview, { key: "rv", rows: scene.rows, span: scene.span, label: scene.label, animate }));
      } else {
        if (animate) {
          parts.push(h(Signal, { key: "signal" }));
        }
        parts.push(h(SessionBoard, { key: "board", sessions: scene.sessions, limits: scene.limits, animate }));
      }
      parts.push(h(TopBand, { key: "top" }));
      if (mode !== "stinger" && mode !== "outro" && mode !== "ident") {
        parts.push(h(Ticker2, { key: "tick", items: scene.ticker, time: scene.clock, label: scene.tickerLabel, offset: scene.tickerOffset, animate }));
      }
      return h("div", {
        key: live ? "scene-" + live.step : "scene",
        className: cx("pn-broadcast", "pn-mode-" + mode, (mode === "stinger" || mode === "outro" && scene.open !== "hour") && "pn-k-breaking"),
        style: { position: "absolute", left: 0, top: 0, width: STAGE_W + "px", height: STAGE_H + "px" }
      }, parts);
    }
    function Stage2(props) {
      var w = num(props.width, STAGE_W);
      var crawl = useState3(function() {
        return { belt: null };
      })[0];
      return h(
        CrawlContext.Provider,
        { value: crawl },
        h(
          "div",
          { className: "pn-stage-wrap", style: { width: w + "px", height: w * STAGE_H / STAGE_W + "px" } },
          h("div", {
            className: cx("pn-stage", bool(props.animate, false) && "pn-anim"),
            style: { transform: "scale(" + w / STAGE_W + ")" }
          }, props.children)
        )
      );
    }
    var GLYPH_SCALE = 44 / 33;
    function glyphSize(n) {
      return Math.round(n * GLYPH_SCALE * 100) / 100;
    }
    function icon(w, hgt, kids) {
      return h("svg", {
        width: glyphSize(w),
        height: glyphSize(hgt),
        viewBox: "0 0 " + w + " " + hgt,
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": "true"
      }, kids);
    }
    var iconSeq = 0;
    function nextId(base) {
      iconSeq += 1;
      return base + "-" + iconSeq;
    }
    function iconClose() {
      return icon(14, 14, [h("path", { key: "x", d: "M2.6 2.6l8.8 8.8M11.4 2.6l-8.8 8.8", strokeWidth: 1.7 })]);
    }
    function iconReturn() {
      var id = nextId("pn-ret");
      return icon(22, 18, [
        h(
          "defs",
          { key: "d" },
          h(
            "mask",
            { id, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 22, height: 18 },
            h("rect", { x: 0, y: 0, width: 22, height: 18, fill: "#ffffff" }),
            h("rect", { x: 7, y: 5.5, width: 15.5, height: 12.5, rx: 3.6, fill: "#000000" })
          )
        ),
        h(
          "g",
          { key: "b", mask: "url(#" + id + ")" },
          h("rect", { x: 1, y: 1, width: 15.5, height: 11.5, rx: 2.6, strokeWidth: 1.5 }),
          h("path", { d: "M4.2 3.6v3.3M4.2 3.6h3.3M4.4 3.8l3.8 3.6", strokeWidth: 1.4 })
        ),
        h("rect", { key: "f", x: 8.8, y: 7.2, width: 12, height: 9, rx: 2.4, fill: "currentColor", stroke: "none" })
      ]);
    }
    function iconSound(on) {
      var body = "M2.1 5.7h2.6l3.6-3.2c.5-.4 1.2-.1 1.2.6v9.8c0 .7-.7 1-1.2.6L4.7 10.3H2.1c-.6 0-1.1-.5-1.1-1.1V6.8c0-.6.5-1.1 1.1-1.1z";
      if (on) {
        return icon(20, 16, [
          h("path", { key: "b", d: body, fill: "currentColor", stroke: "none" }),
          h("path", { key: "w1", d: "M12.2 5.4a3.6 3.6 0 0 1 0 5.2", strokeWidth: 1.6 }),
          h("path", { key: "w2", d: "M14.8 3a7 7 0 0 1 0 10", strokeWidth: 1.6 })
        ]);
      }
      var id = nextId("pn-mute");
      return icon(20, 16, [
        h(
          "defs",
          { key: "d" },
          h(
            "mask",
            { id, maskUnits: "userSpaceOnUse", x: 0, y: 0, width: 20, height: 16 },
            h("rect", { x: 0, y: 0, width: 20, height: 16, fill: "#ffffff" }),
            h("path", { d: "M1.6 1.4l14.4 13.2", stroke: "#000000", strokeWidth: 4.2 })
          )
        ),
        h(
          "g",
          { key: "g", mask: "url(#" + id + ")" },
          h("path", { d: body, fill: "currentColor", stroke: "none" }),
          h("path", { d: "M12.2 5.4a3.6 3.6 0 0 1 0 5.2", strokeWidth: 1.6 })
        ),
        h("path", { key: "s", d: "M1.6 1.4l14.4 13.2", strokeWidth: 1.7 })
      ]);
    }
    function PipControls(props) {
      var w = num(props.width, 716);
      var soundOn = !(props.sound === "off" || props.sound === false || props.sound === "false");
      function button(key, cls, label, glyph) {
        var under = props.hover === key;
        return h("div", { key, className: cx("pn-glass", "pn-ctl-btn", cls, under && "pn-glass--hover"), role: "img", "aria-label": label }, glyph);
      }
      return h(
        "div",
        { className: "pn-ctl", style: { width: w + "px", height: Math.round(w * 9 / 16) + "px" } },
        h("div", { key: "dim", className: "pn-ctl-dim" }),
        button("close", "pn-ctl-close", "Stop tracking", iconClose()),
        button("sound", "pn-ctl-sound", soundOn ? "Mute" : "Unmute", iconSound(soundOn)),
        button("back", "pn-ctl-return", "Back to Claude", iconReturn())
      );
    }
    function Pip(props) {
      var w = num(props.width, 716);
      var animate = bool(props.animate, false);
      var blank = bool(props.blank, false);
      var content = blank ? null : hasElements(props.children) ? props.children : h(Broadcast2, { scene: props.scene, sample: props.sample, run: props.run, animate });
      var style = { width: w + "px", height: Math.round(w * 9 / 16) + "px" };
      if (props.radius !== void 0) {
        style.borderRadius = num(props.radius, 20) + "px";
      }
      return h(
        "div",
        {
          className: cx("pn-pip", bool(props.shadow, true) && "pn-pip--shadow", props.className),
          style
        },
        blank ? null : h(Stage2, { width: w, animate }, content),
        bool(props.controls, false) ? h(PipControls, { width: w, sound: props.sound, hover: props.hover }) : null
      );
    }
    function pct(v, d) {
      if (typeof v === "string" && v.trim().slice(-1) === "%") {
        return num(v.trim().slice(0, -1), d * 100) / 100;
      }
      return num(v, d);
    }
    function pipSize(screenW, screenH, margin) {
      var qw = num(screenW, 1512) / 2;
      var qh = num(screenH, 982) / 2;
      var m = num(margin, 20);
      var w = Math.floor(qw - 2 * m);
      var hh = Math.round(w * 9 / 16);
      var cap = Math.floor(qh - 2 * m);
      if (hh > cap) {
        hh = cap;
        w = Math.round(hh * 16 / 9);
      }
      return { width: w, height: hh };
    }
    function pipRange(screenW, screenH, margin, minScale) {
      var full = pipSize(screenW, screenH, margin);
      var nw = Math.round(full.width * pct(minScale, 0.7));
      return { min: { width: nw, height: Math.round(nw * 9 / 16) }, full };
    }
    var S = {
      auth: { id: "auth", name: "Refactor auth middleware", project: "api-server" },
      checkout: { id: "checkout", name: "Fix flaky checkout test", project: "web-shop" },
      notes: { id: "notes", name: "Write release notes for 2.4", project: "docs-site" },
      sqlite: { id: "sqlite", name: "Migrate settings to SQLite", project: "desktop-app" },
      crash: { id: "crash", name: "Check last night\u2019s crash reports", project: "mobile-app" },
      search: { id: "search", name: "Speed up product search", project: "search-api" },
      runners: { id: "runners", name: "Move CI to the new runners", project: "ci-config" }
    };
    function at(base, state) {
      return { id: base.id, name: base.name, project: base.project, state };
    }
    var EV_ASK = { kind: "needs-input", session: S.checkout.name, project: S.checkout.project, command: "npm install", quote: "Install dependencies", foot: "Waiting 0:12" };
    var EV_READY = { kind: "ready", session: S.notes.name, project: S.notes.project, figure: "+182 \u221240", sub: "4 files changed", foot: "Finished in 9 min" };
    var EV_QUESTION = { kind: "needs-input", session: S.auth.name, project: S.auth.project, quote: "Expired sessions: log users out at once, or on their next request?", foot: "Waiting 0:05" };
    var EV_COMPLETE = { kind: "complete", session: S.crash.name, project: S.crash.project, quote: "Both crashes come from the old 3.1 build. Nothing to fix.", foot: "Finished in 6 min" };
    var EV_ERROR = { kind: "error", session: S.sqlite.name, project: S.sqlite.project, quote: "Claude is overloaded right now. Try again in a moment.", foot: "Stopped after 31 min" };
    var EV_ASK_LONG = {
      kind: "needs-input",
      session: "Investigate the intermittent failures in the nightly integration pipeline",
      project: "ci-config",
      quote: "Run the whole integration suite against the staging database? It takes about 25 minutes, needs the VPN up the whole time and locks the shared test accounts until it ends.",
      foot: "Waiting 0:08"
    };
    var EV_READY_LONG = {
      kind: "ready",
      session: "Upgrade every package in the monorepo to its latest major version and fix what breaks",
      project: "platform-monorepo",
      figure: "+12,480 \u22129,731",
      sub: "238 files changed",
      foot: "Finished in 1 h 48 min"
    };
    var EV_HOUR = { kind: "hourly", figure: "+1,546 \u2212368", sub: "Across 4 sessions", foot: "14:00 to 15:00" };
    var TICK_WORKING = [
      "api-server: editing src/auth/session.ts",
      "web-shop: running the test suite",
      "docs-site: drafting CHANGELOG.md",
      "desktop-app: writing migration 004"
    ];
    var TICK_ASK = [
      { lead: "BREAKING", text: "Fix flaky checkout test needs your input" },
      "api-server: editing src/auth/session.ts",
      "docs-site: drafting CHANGELOG.md"
    ];
    var TICK_HOUR = [
      { lead: "ON THE HOUR", text: "2 stories since 14:00" },
      { lead: "STILL WAITING", text: "Fix flaky checkout test needs your input \xB7 27 min" },
      { lead: "READY", text: "Release notes for 2.4 waiting for review" }
    ];
    var SAMPLES = {
      /* The live board: how many sessions, and what they need */
      "board-one": {
        mode: "board",
        clock: "14:32",
        sessions: [at(S.auth, "working")],
        ticker: [{ lead: "ON THE DESK", text: "1 session working" }, TICK_WORKING[0]]
      },
      "board-two": {
        mode: "board",
        clock: "14:32",
        sessions: [at(S.auth, "working"), at(S.checkout, "working")],
        ticker: [{ lead: "ON THE DESK", text: "2 sessions working" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      "board-three": {
        mode: "board",
        clock: "14:32",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "working")],
        ticker: [{ lead: "ON THE DESK", text: "3 sessions working" }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
      },
      "run-board": {
        mode: "board",
        clock: "14:32",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "working"), at(S.sqlite, "working")],
        ticker: [{ lead: "ON THE DESK", text: "4 sessions working" }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
      },
      "board-needs-you": {
        mode: "board",
        clock: "14:34",
        sessions: [at(S.auth, "working"), at(S.checkout, "needs-input"), at(S.notes, "working"), at(S.sqlite, "working")],
        ticker: [{ lead: "STILL WAITING", text: "Fix flaky checkout test needs your input \xB7 1 min" }, TICK_WORKING[0], TICK_WORKING[2]]
      },
      "board-ready": {
        mode: "board",
        clock: "14:37",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "ready"), at(S.sqlite, "working")],
        ticker: [{ lead: "BREAKING", text: "Release notes for 2.4 ready for review" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      "run-return": {
        mode: "board",
        clock: "14:38",
        sessions: [at(S.auth, "working"), at(S.checkout, "needs-input"), at(S.notes, "ready"), at(S.sqlite, "working")],
        ticker: [
          { lead: "STILL WAITING", text: "Fix flaky checkout test needs your input \xB7 5 min" },
          { lead: "READY", text: "Release notes for 2.4 waiting for review" }
        ]
      },
      /* More than four: seven sessions, four a page */
      "board-seven": {
        mode: "board",
        clock: "14:38",
        sessions: [at(S.checkout, "needs-input"), at(S.notes, "ready"), at(S.auth, "working"), at(S.sqlite, "working"), at(S.crash, "working"), at(S.search, "working"), at(S.runners, "working")],
        ticker: [
          { lead: "STILL WAITING", text: "Fix flaky checkout test needs your input \xB7 5 min" },
          { lead: "READY", text: "Release notes for 2.4 waiting for review" },
          "api-server: editing src/auth/session.ts"
        ]
      },
      /* Breaking news: needs your input */
      "brk-stinger-1": { mode: "stinger", clock: "14:33", progress: 0.34, event: EV_ASK },
      "brk-stinger-2": { mode: "stinger", clock: "14:33", progress: 0.74, event: EV_ASK },
      "run-stinger": { mode: "stinger", clock: "14:33", progress: 1, event: EV_ASK },
      "run-needs-input": { mode: "desk", clock: "14:33", act: "urgent", event: EV_ASK, ticker: TICK_ASK },
      /* the longest text it has to carry: a long title on the strap, a question past three lines */
      "brk-long-desk": {
        mode: "desk",
        clock: "14:41",
        act: "urgent",
        event: EV_ASK_LONG,
        ticker: [{ lead: "BREAKING", text: EV_ASK_LONG.session + " needs your input" }, TICK_WORKING[0], TICK_WORKING[2]]
      },
      /* Every story airs as BREAKING NEWS: the same open, then its own desk.
         Each has a run from the board and back, all in the same afternoon, so
         only the story changes. */
      /* Needs your input, the other kind: Claude asks you a question */
      "ask-question-desk": {
        mode: "desk",
        clock: "14:41",
        act: "urgent",
        event: EV_QUESTION,
        ticker: [{ lead: "BREAKING", text: "Refactor auth middleware needs your input" }, TICK_WORKING[1], TICK_WORKING[2]]
      },
      /* Finished, with changes: READY FOR REVIEW */
      "ready-board": {
        mode: "board",
        clock: "14:36",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "working"), at(S.sqlite, "working")],
        ticker: [{ lead: "ON THE DESK", text: "4 sessions working" }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
      },
      "ready-desk": {
        mode: "desk",
        clock: "14:36",
        act: "cheer",
        event: EV_READY,
        ticker: [{ lead: "BREAKING", text: "Release notes for 2.4 ready for review" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      /* the longest text: a long title on the strap, the biggest changes on the monitor */
      "ready-long-desk": {
        mode: "desk",
        clock: "16:02",
        act: "cheer",
        event: EV_READY_LONG,
        ticker: [{ lead: "BREAKING", text: EV_READY_LONG.session + " ready for review" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      /* Finished, nothing changed: WORK COMPLETE, with Claude's last words */
      "complete-board": {
        mode: "board",
        clock: "14:44",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.crash, "working"), at(S.sqlite, "working")],
        ticker: [{ lead: "ON THE DESK", text: "4 sessions working" }, TICK_WORKING[0], TICK_WORKING[1], "mobile-app: reading the crash reports"]
      },
      "complete-desk": {
        mode: "desk",
        clock: "14:44",
        act: "talk",
        event: EV_COMPLETE,
        ticker: [{ lead: "BREAKING", text: "Last night\u2019s crash reports checked: nothing to fix" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      "complete-return": {
        mode: "board",
        clock: "14:44",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.crash, "ready"), at(S.sqlite, "working")],
        ticker: [{ lead: "BREAKING", text: "Last night\u2019s crash reports checked: nothing to fix" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      /* Stopped on an error: the turn died on an API error */
      "error-board": {
        mode: "board",
        clock: "14:47",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "working"), at(S.sqlite, "working")],
        ticker: [{ lead: "ON THE DESK", text: "4 sessions working" }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[3]]
      },
      "error-desk": {
        mode: "desk",
        clock: "14:47",
        act: "glance",
        event: EV_ERROR,
        ticker: [{ lead: "BREAKING", text: "Migrate settings to SQLite stopped on an error" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      "error-return": {
        mode: "board",
        clock: "14:47",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "working"), at(S.sqlite, "error")],
        ticker: [{ lead: "STILL WAITING", text: "Migrate settings to SQLite stopped on an error" }, TICK_WORKING[0], TICK_WORKING[1]]
      },
      /* Every pill on the board at once, sorted: INPUT, ERROR, READY, LIVE */
      "board-every-state": {
        mode: "board",
        clock: "14:52",
        sessions: [at(S.auth, "working"), at(S.checkout, "needs-input"), at(S.notes, "ready"), at(S.sqlite, "error")],
        ticker: [
          { lead: "STILL WAITING", text: "Fix flaky checkout test needs your input \xB7 19 min" },
          { lead: "STILL WAITING", text: "Migrate settings to SQLite stopped on an error \xB7 5 min" },
          { lead: "BREAKING", text: "Release notes for 2.4 ready for review" }
        ]
      },
      /* One after another: a story lands while another is at the desk. It goes
         into the ticker as COMING UP and airs, with its own BREAKING NEWS, as
         soon as that desk ends; then the board carries both. All within 14:36. */
      "queue-desk": {
        mode: "desk",
        clock: "14:36",
        act: "urgent",
        event: EV_ASK,
        ticker: [{ lead: "COMING UP", text: "Release notes for 2.4 ready for review" }, { lead: "BREAKING", text: "Fix flaky checkout test needs your input" }, TICK_WORKING[0]]
      },
      "queue-next-desk": {
        mode: "desk",
        clock: "14:36",
        act: "cheer",
        event: EV_READY,
        ticker: [{ lead: "STILL WAITING", text: "Fix flaky checkout test needs your input" }, { lead: "BREAKING", text: "Release notes for 2.4 ready for review" }, TICK_WORKING[0]]
      },
      "queue-return": {
        mode: "board",
        clock: "14:36",
        sessions: [at(S.auth, "working"), at(S.checkout, "needs-input"), at(S.notes, "ready"), at(S.sqlite, "working")],
        ticker: [{ lead: "STILL WAITING", text: "Fix flaky checkout test needs your input" }, { lead: "BREAKING", text: "Release notes for 2.4 ready for review" }, TICK_WORKING[0]]
      },
      /* On the hour: the 15:00 report on the same four sessions, and a quiet
         hour elsewhere in the day. The hour's numbers are examples too. */
      "hour-board": {
        mode: "board",
        clock: "14:59",
        sessions: [at(S.auth, "working"), at(S.checkout, "needs-input"), at(S.notes, "ready"), at(S.sqlite, "working")],
        ticker: [
          { lead: "STILL WAITING", text: "Fix flaky checkout test needs your input \xB7 26 min" },
          { lead: "READY", text: "Release notes for 2.4 waiting for review" },
          TICK_WORKING[0]
        ]
      },
      "hour-ident-1": { mode: "ident", clock: "14:59", hour: "15:00", progress: 0.45 },
      "hour-ident-2": { mode: "ident", clock: "15:00", hour: "15:00", progress: 1 },
      "hour-desk": {
        mode: "desk",
        clock: "15:00",
        act: "talk",
        event: EV_HOUR,
        headline: "2 STORIES",
        strap: "1 needs you \xB7 1 ready for review",
        ticker: TICK_HOUR
      },
      "hour-review": {
        mode: "review",
        clock: "15:00",
        span: "14:00\u201315:00",
        rows: [
          { id: "auth", project: "api-server", name: S.auth.name, state: "working", detail: "+1,204 \u2212310" },
          { id: "checkout", project: "web-shop", name: S.checkout.name, state: "needs-input", detail: "Waiting 27 min" },
          { id: "notes", project: "docs-site", name: S.notes.name, state: "ready", detail: "+182 \u221240" },
          { id: "sqlite", project: "desktop-app", name: S.sqlite.name, state: "working", detail: "+64 \u221212" }
        ],
        ticker: TICK_HOUR
      },
      "review-seven": {
        mode: "review",
        clock: "15:00",
        span: "14:00\u201315:00",
        rows: [
          { id: "checkout", project: "web-shop", name: S.checkout.name, state: "needs-input", detail: "Waiting 27 min" },
          { id: "notes", project: "docs-site", name: S.notes.name, state: "ready", detail: "+182 \u221240" },
          { id: "auth", project: "api-server", name: S.auth.name, state: "working", detail: "+1,204 \u2212310" },
          { id: "sqlite", project: "desktop-app", name: S.sqlite.name, state: "working", detail: "+64 \u221212" },
          { id: "crash", project: "mobile-app", name: S.crash.name, state: "working", detail: "+18 \u22123" },
          { id: "search", project: "search-api", name: S.search.name, state: "working", detail: "+240 \u221288" },
          { id: "runners", project: "ci-config", name: S.runners.name, state: "working", detail: "+31 \u22129" }
        ],
        ticker: TICK_HOUR
      },
      "hour-return": {
        mode: "board",
        clock: "15:01",
        sessions: [at(S.auth, "working"), at(S.checkout, "needs-input"), at(S.notes, "ready"), at(S.sqlite, "working")],
        ticker: [
          { lead: "ON THE HOUR", text: "2 stories at 15:00 \xB7 next report 16:00" },
          { lead: "STILL WAITING", text: "Fix flaky checkout test needs your input \xB7 28 min" }
        ]
      },
      "hour-quiet": {
        mode: "desk",
        clock: "11:00",
        act: "talk",
        event: { kind: "hourly", figure: "+204 \u221218", sub: "Across 4 sessions", foot: "10:00 to 11:00" },
        headline: "A QUIET HOUR",
        strap: "4 sessions working, nothing needs you",
        ticker: [{ lead: "ON THE HOUR", text: "A quiet hour: 4 sessions working" }, TICK_WORKING[0], TICK_WORKING[2]]
      },
      "quiet-board": {
        mode: "board",
        clock: "10:59",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "working"), at(S.sqlite, "working")],
        ticker: [{ lead: "ON THE DESK", text: "4 sessions working" }, TICK_WORKING[0], TICK_WORKING[1], TICK_WORKING[2]]
      },
      "quiet-ident": { mode: "ident", clock: "11:00", hour: "11:00", progress: 1 },
      "quiet-return": {
        mode: "board",
        clock: "11:00",
        sessions: [at(S.auth, "working"), at(S.checkout, "working"), at(S.notes, "working"), at(S.sqlite, "working")],
        ticker: [{ lead: "ON THE HOUR", text: "A quiet hour \xB7 next report 12:00" }, TICK_WORKING[0], TICK_WORKING[2]]
      },
      /* first come, first served: a question on air at the hour holds the report
         back, and a story that lands during the report waits for it */
      "hour-wait-desk": {
        mode: "desk",
        clock: "15:00",
        act: "urgent",
        event: EV_QUESTION,
        ticker: [{ lead: "COMING UP", text: "The 15:00 report" }, { lead: "BREAKING", text: "Refactor auth middleware needs your input" }]
      },
      "hour-desk-coming": {
        mode: "desk",
        clock: "15:00",
        act: "talk",
        event: EV_HOUR,
        headline: "2 STORIES",
        strap: "1 needs you \xB7 1 ready for review",
        ticker: [{ lead: "COMING UP", text: "Migrate settings to SQLite stopped on an error" }, { lead: "ON THE HOUR", text: "2 stories since 14:00" }]
      }
    };
    function outroOf(board, progress, open, hour) {
      return { mode: "outro", clock: board.clock, progress: num(progress, 1), board, open, hour };
    }
    SAMPLES["brk-outro-1"] = outroOf(SAMPLES["board-needs-you"], 0.4);
    SAMPLES["brk-outro-2"] = outroOf(SAMPLES["board-needs-you"], 0.8);
    SAMPLES["hour-outro-1"] = outroOf(SAMPLES["hour-return"], 0.4, "hour", "15:00");
    SAMPLES["hour-outro-2"] = outroOf(SAMPLES["hour-return"], 0.8, "hour", "15:00");
    SAMPLES["board-limits"] = Object.assign({}, SAMPLES["board-every-state"], { limits: [{ kind: "session", percent: 42 }, { kind: "week", percent: 61 }] });
    SAMPLES["board-limits-near"] = Object.assign({}, SAMPLES["board-seven"], { limits: [{ kind: "session", percent: 74 }, { kind: "week", percent: 92 }] });
    SAMPLES["limits-outro"] = outroOf(SAMPLES["board-limits"], 0.8);
    var RUNS = {
      /* The board and its stories, as they air: a question, the board, then a
         finished session while the question still waits */
      loop: [
        { scene: SAMPLES["run-board"], dur: 4 },
        { scene: SAMPLES["run-stinger"], dur: 1.9 },
        { scene: SAMPLES["run-needs-input"], dur: 10 },
        { scene: outroOf(SAMPLES["board-needs-you"]), dur: 1.4 },
        { scene: SAMPLES["board-needs-you"], dur: 4 },
        { scene: SAMPLES["run-stinger"], dur: 1.9 },
        { scene: SAMPLES["queue-next-desk"], dur: 10 },
        { scene: outroOf(SAMPLES["queue-return"]), dur: 1.4 },
        { scene: SAMPLES["queue-return"], dur: 6 }
      ],
      /* BREAKING NEWS as it airs, for a permission ask: the board, the intro, the desk, the outro, back to the board */
      breaking: [
        { scene: SAMPLES["run-board"], dur: 2 },
        { scene: SAMPLES["run-stinger"], dur: 1.9 },
        { scene: SAMPLES["run-needs-input"], dur: 10 },
        { scene: outroOf(SAMPLES["board-needs-you"]), dur: 1.4 },
        { scene: SAMPLES["board-needs-you"], dur: 5 }
      ],
      /* The other stories as they air, each from the board and back */
      "breaking-ready": [
        { scene: SAMPLES["ready-board"], dur: 2 },
        { scene: SAMPLES["run-stinger"], dur: 1.9 },
        { scene: SAMPLES["ready-desk"], dur: 10 },
        { scene: outroOf(SAMPLES["board-ready"]), dur: 1.4 },
        { scene: SAMPLES["board-ready"], dur: 5 }
      ],
      "breaking-complete": [
        { scene: SAMPLES["complete-board"], dur: 2 },
        { scene: SAMPLES["run-stinger"], dur: 1.9 },
        { scene: SAMPLES["complete-desk"], dur: 10 },
        { scene: outroOf(SAMPLES["complete-return"]), dur: 1.4 },
        { scene: SAMPLES["complete-return"], dur: 5 }
      ],
      "breaking-error": [
        { scene: SAMPLES["error-board"], dur: 2 },
        { scene: SAMPLES["run-stinger"], dur: 1.9 },
        { scene: SAMPLES["error-desk"], dur: 10 },
        { scene: outroOf(SAMPLES["error-return"]), dur: 1.4 },
        { scene: SAMPLES["error-return"], dur: 5 }
      ],
      /* The 15:00 report as it airs: ident, desk, the hour in review, board */
      hour: [
        { scene: SAMPLES["hour-board"], dur: 2 },
        { scene: SAMPLES["hour-ident-2"], dur: 7.5 },
        { scene: SAMPLES["hour-desk"], dur: 10 },
        { scene: SAMPLES["hour-review"], dur: 10 },
        { scene: outroOf(SAMPLES["hour-return"], 1, "hour", "15:00"), dur: 1.6 },
        { scene: SAMPLES["hour-return"], dur: 5 }
      ],
      /* A quiet hour: the ident, the desk and the outro, no review */
      "quiet-hour": [
        { scene: SAMPLES["quiet-board"], dur: 2 },
        { scene: SAMPLES["quiet-ident"], dur: 7.5 },
        { scene: SAMPLES["hour-quiet"], dur: 10 },
        { scene: outroOf(SAMPLES["quiet-return"], 1, "hour", "11:00"), dur: 1.6 },
        { scene: SAMPLES["quiet-return"], dur: 5 }
      ]
    };
    var HZ = {
      D2: 73.42,
      F2: 87.31,
      G2: 98,
      A2: 110,
      D3: 146.83,
      F3: 174.61,
      Fs3: 185,
      G3: 196,
      A3: 220,
      Bb3: 233.08,
      C4: 261.63,
      Cs4: 277.18,
      D4: 293.66,
      E4: 329.63,
      F4: 349.23,
      Fs4: 369.99,
      A4: 440,
      C5: 523.25,
      D5: 587.33,
      A5: 880,
      D6: 1174.66
    };
    function noise(ctx, seconds) {
      var rnd = seeded(7151);
      var n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      var buf = ctx.createBuffer(1, n, ctx.sampleRate);
      var d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) {
        d[i] = rnd() * 2 - 1;
      }
      return buf;
    }
    function hall(ctx, seconds) {
      var n = Math.floor(ctx.sampleRate * seconds);
      var buf = ctx.createBuffer(2, n, ctx.sampleRate);
      for (var ch = 0; ch < 2; ch++) {
        var rnd = seeded(911 + ch * 31);
        var d = buf.getChannelData(ch);
        var pre = Math.floor(ctx.sampleRate * 0.012);
        for (var i = pre; i < n; i++) {
          d[i] = (rnd() * 2 - 1) * Math.pow(1 - (i - pre) / (n - pre), 3.2);
        }
      }
      return buf;
    }
    function mixer(ctx, dest) {
      var master = ctx.createGain();
      master.gain.value = 0.5;
      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -10;
      comp.knee.value = 8;
      comp.ratio.value = 2.5;
      comp.attack.value = 3e-3;
      comp.release.value = 0.25;
      var limit = ctx.createDynamicsCompressor();
      limit.threshold.value = -3;
      limit.knee.value = 0;
      limit.ratio.value = 20;
      limit.attack.value = 15e-4;
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
      return { ctx, dry, send: verb, master, white: noise(ctx, 2) };
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
    function brass(m, t, f, dur, vel, rel) {
      var ctx = m.ctx;
      var r = rel || 0.28;
      var out = voice(m, 1, 0.8);
      var amp = ctx.createGain();
      amp.gain.setValueAtTime(1e-4, t);
      amp.gain.exponentialRampToValueAtTime(vel, t + 0.018);
      amp.gain.exponentialRampToValueAtTime(vel * 0.6, t + 0.16);
      amp.gain.setValueAtTime(vel * 0.6, t + dur);
      amp.gain.exponentialRampToValueAtTime(1e-4, t + dur + r);
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.Q.value = 0.9;
      lp.frequency.setValueAtTime(f * 1.5, t);
      lp.frequency.exponentialRampToValueAtTime(Math.min(f * 10, 8e3), t + 0.04);
      lp.frequency.exponentialRampToValueAtTime(Math.min(f * 4, 5e3), t + 0.3);
      [-8, 0, 7].forEach(function(cents) {
        var o = ctx.createOscillator();
        o.type = "sawtooth";
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
      [[1, len], [1.5, len * 0.36], [1.99, len * 0.23]].forEach(function(p, i) {
        var o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(f * p[0] * 1.45, t);
        o.frequency.exponentialRampToValueAtTime(f * p[0], t + 0.045);
        var g = ctx.createGain();
        var v = vel * (i === 0 ? 1 : 0.35);
        g.gain.setValueAtTime(1e-4, t);
        g.gain.exponentialRampToValueAtTime(v, t + 4e-3);
        g.gain.exponentialRampToValueAtTime(1e-4, t + p[1]);
        o.connect(g);
        g.connect(out);
        o.start(t);
        o.stop(t + p[1] + 0.05);
      });
      var n = ctx.createBufferSource();
      n.buffer = m.white;
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1100;
      var ng = ctx.createGain();
      ng.gain.setValueAtTime(vel * 0.6, t);
      ng.gain.exponentialRampToValueAtTime(1e-4, t + 0.09);
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
      o.type = "sine";
      o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(38, t + 0.45);
      var g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 6e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 1.2);
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
      hp.type = "highpass";
      hp.frequency.value = 3200;
      var g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 0.01);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 1.9);
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
      bp.type = "bandpass";
      bp.Q.value = 3;
      bp.frequency.setValueAtTime(300, t);
      bp.frequency.exponentialRampToValueAtTime(7e3, t + dur);
      var g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vel, t + dur * 0.95);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur + 0.04);
      n.connect(bp);
      bp.connect(g);
      g.connect(out);
      n.start(t);
      n.stop(t + dur + 0.05);
    }
    function bell(m, t, f, dur, vel) {
      var ctx = m.ctx;
      var out = voice(m, 1, 1);
      var car = ctx.createOscillator();
      car.type = "sine";
      car.frequency.value = f;
      var mod = ctx.createOscillator();
      mod.type = "sine";
      mod.frequency.value = f * 3.5;
      var idx = ctx.createGain();
      idx.gain.setValueAtTime(f * 2.2, t);
      idx.gain.exponentialRampToValueAtTime(f * 0.25, t + dur * 0.6);
      mod.connect(idx);
      idx.connect(car.frequency);
      var oct = ctx.createOscillator();
      oct.type = "triangle";
      oct.frequency.value = f * 2;
      var og = ctx.createGain();
      og.gain.value = 0.18;
      oct.connect(og);
      var g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 5e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      car.connect(g);
      og.connect(g);
      g.connect(out);
      [car, mod, oct].forEach(function(o) {
        o.start(t);
        o.stop(t + dur + 0.05);
      });
    }
    function tick(m, t, f, vel) {
      var ctx = m.ctx;
      var out = voice(m, 1, 0.3);
      var o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      var lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1900;
      var g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 4e-3);
      g.gain.exponentialRampToValueAtTime(1e-4, t + 0.075);
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
      lp.type = "lowpass";
      lp.frequency.value = 3200;
      var g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 0.08);
      g.gain.setValueAtTime(vel, t + dur * 0.4);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      var trem = ctx.createGain();
      trem.gain.value = 0.5;
      var lfo = ctx.createOscillator();
      lfo.frequency.value = 13;
      var depth = ctx.createGain();
      depth.gain.value = 0.5;
      lfo.connect(depth);
      depth.connect(trem.gain);
      [-6, 6].forEach(function(cents) {
        var o = ctx.createOscillator();
        o.type = "sawtooth";
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
    function scoreBreaking(m, t0) {
      var roll = [0, 0.06, 0.11, 0.155, 0.195, 0.23, 0.26, 0.285];
      riser(m, t0, 0.31, 0.12);
      roll.forEach(function(x, i) {
        timpani(m, t0 + x, HZ.D2, 0.06 + 0.22 * i / (roll.length - 1), 0.3);
      });
      var hits = [
        { at: 0.31, logo: HZ.A4, chord: [HZ.D3, HZ.F3, HZ.A3, HZ.D4], drum: HZ.D2, dur: 0.1 },
        { at: 0.45, logo: HZ.D5, chord: [HZ.F3, HZ.A3, HZ.D4], drum: HZ.A2, dur: 0.1 },
        { at: 0.59, logo: HZ.A5, chord: [HZ.F3, HZ.A3, HZ.C4, HZ.F4], drum: HZ.F2, dur: 0.12 },
        { at: 0.84, logo: HZ.D6, chord: [HZ.D3, HZ.A3, HZ.D4, HZ.F4, HZ.A4], drum: HZ.D2, dur: 1 }
      ];
      hits.forEach(function(x, i) {
        var last = i === hits.length - 1;
        x.chord.forEach(function(f) {
          brass(m, t0 + x.at, f, x.dur, last ? 0.17 : 0.06);
        });
        timpani(m, t0 + x.at, x.drum, last ? 1 : i === 0 ? 0.35 : 0.3, last ? 1.3 : 0.6);
        bell(m, t0 + x.at, x.logo, last ? 1.7 : 0.55, last ? 0.3 : 0.17);
      });
      boom(m, t0 + 0.31, 0.15);
      boom(m, t0 + 0.84, 1);
      crash(m, t0 + 0.84, 0.5);
      brass(m, t0 + 0.84, HZ.D2, 1, 0.12);
      tremolo(m, t0 + 0.84, HZ.D5, 1.7, 0.05);
      tremolo(m, t0 + 0.84, HZ.A5, 1.7, 0.035);
    }
    function scoreBreakingOut(m, t0) {
      var steps = [
        { at: 0.1, logo: HZ.A5, chord: [HZ.D3, HZ.F3, HZ.A3, HZ.D4], bass: HZ.D2, drum: HZ.D2, vel: 0.15 },
        { at: 0.34, logo: HZ.D5, chord: [HZ.G3, HZ.Bb3, HZ.D4], bass: HZ.G2, drum: 0, vel: 0.13 },
        { at: 0.62, logo: HZ.A4, chord: [HZ.A3, HZ.Cs4, HZ.E4], bass: HZ.A2, drum: HZ.A2, vel: 0.12 }
      ];
      steps.forEach(function(x, i) {
        var t = t0 + x.at;
        x.chord.forEach(function(f) {
          brass(m, t, f, 0.18, 0.05 - 5e-3 * i);
        });
        brass(m, t, x.bass, 0.18, 0.04);
        bell(m, t, x.logo, 0.8, x.vel);
        if (x.drum) {
          timpani(m, t, x.drum, 0.24 - 0.04 * i, 0.5);
        }
      });
      var end = t0 + 0.96;
      [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4].forEach(function(f) {
        brass(m, end, f, 0.3, 0.1, 1.4);
      });
      brass(m, end, HZ.D2, 0.3, 0.06, 1.4);
      timpani(m, end, HZ.D2, 0.45, 1.3);
      bell(m, end, HZ.D4, 1.8, 0.2);
      tremolo(m, end, HZ.A3, 1.8, 0.025);
      tremolo(m, end, HZ.D4, 1.8, 0.02);
    }
    function pip(m, t, dur, vel) {
      var ctx = m.ctx;
      var out = voice(m, 1, 0.15);
      var o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = HZ.D6;
      var g = ctx.createGain();
      g.gain.setValueAtTime(1e-4, t);
      g.gain.exponentialRampToValueAtTime(vel, t + 6e-3);
      g.gain.setValueAtTime(vel, t + dur - 0.012);
      g.gain.exponentialRampToValueAtTime(1e-4, t + dur);
      o.connect(g);
      g.connect(out);
      o.start(t);
      o.stop(t + dur + 0.02);
    }
    function scoreHour(m, t0) {
      for (var i = 0; i < 5; i++) {
        pip(m, t0 + i, 0.1, 0.16);
      }
      var strike = t0 + 5;
      pip(m, strike, 0.5, 0.18);
      var hits = [
        { at: 0, logo: HZ.A4, chord: [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4] },
        { at: 0.42, logo: HZ.D5, chord: [HZ.Fs3, HZ.A3, HZ.D4] },
        { at: 0.84, logo: HZ.A5, chord: [HZ.A3, HZ.Cs4, HZ.E4] },
        { at: 1.4, logo: HZ.D6, chord: [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4, HZ.Fs4] }
      ];
      hits.forEach(function(x, i2) {
        var last = i2 === hits.length - 1;
        x.chord.forEach(function(f) {
          brass(m, strike + x.at, f, last ? 1.6 : 0.32, last ? 0.12 : 0.065);
        });
        timpani(m, strike + x.at, i2 % 2 ? HZ.A2 : HZ.D2, last ? 0.8 : 0.35, last ? 1.4 : 0.7);
        bell(m, strike + x.at, x.logo, last ? 2.2 : 0.7, last ? 0.26 : 0.16);
      });
      crash(m, strike + 1.4, 0.3);
      boom(m, strike + 1.4, 0.5);
      tremolo(m, strike + 1.4, HZ.D5, 2.6, 0.04);
      tremolo(m, strike + 1.4, HZ.A5, 2.6, 0.028);
    }
    function scoreHourOut(m, t0) {
      [{ at: 0.1, f: HZ.D6 }, { at: 0.3, f: HZ.A5 }, { at: 0.5, f: HZ.D5 }, { at: 0.7, f: HZ.A4 }].forEach(function(x) {
        bell(m, t0 + x.at, x.f, 0.9, 0.17);
      });
      [HZ.Fs3, HZ.A3, HZ.D4].forEach(function(f) {
        brass(m, t0 + 0.1, f, 0.7, 0.04);
      });
      var end = t0 + 1;
      [HZ.D3, HZ.Fs3, HZ.A3, HZ.D4, HZ.Fs4].forEach(function(f) {
        brass(m, end, f, 0.3, 0.11, 1.8);
      });
      brass(m, end, HZ.D2, 0.3, 0.06, 1.8);
      timpani(m, end, HZ.D2, 0.55, 1.2);
      bell(m, end, HZ.D5, 2, 0.2);
      crash(m, end, 0.18);
      tremolo(m, end, HZ.A4, 2.2, 0.03);
      tremolo(m, end, HZ.D5, 2.2, 0.025);
    }
    var BEAT = { turn: 43648 / 48e3, warm: 6, fadeIn: 0.3, fadeOut: 0.5 };
    var BEDS = { "beat-minor": HZ.F4, "beat-major": HZ.Fs4 };
    function beat(m, t0, turns, third, from) {
      var step = BEAT.turn / 8;
      var line = [HZ.D4, HZ.D4, HZ.A4, HZ.D4, third, HZ.D4, HZ.A4, HZ.D4];
      for (var k = 0; k < turns * 8; k++) {
        var t = t0 + k * step;
        if (from !== void 0 && t < from - 1e-6) {
          continue;
        }
        tick(m, t, line[k % 8], 0.133);
        if (k % 4 === 0) {
          timpani(m, t, HZ.D2, 0.36, 0.5);
        }
      }
    }
    function playBed(m, name, at2, until) {
      var ctx = m.ctx;
      var dry = ctx.createGain();
      var send = ctx.createGain();
      dry.connect(m.dry);
      send.connect(m.send);
      var end = Math.max(until, at2 + BEAT.fadeIn);
      var out = new Float32Array(32);
      for (var i = 0; i < out.length; i++) {
        out[i] = Math.pow(1 - i / (out.length - 1), 2);
      }
      [dry.gain, send.gain].forEach(function(g) {
        g.setValueAtTime(0, at2);
        g.linearRampToValueAtTime(1, at2 + BEAT.fadeIn);
        g.setValueCurveAtTime(out, end, BEAT.fadeOut);
      });
      var from = at2 + BEAT.fadeIn - BEAT.turn;
      beat({ ctx, dry, send, white: m.white }, from, Math.ceil((end + BEAT.fadeOut - from) / BEAT.turn), BEDS[name], at2);
    }
    var JINGLES = {
      breaking: { duration: 5.8, score: scoreBreaking },
      "breaking-out": { duration: 3.4, score: scoreBreakingOut },
      hour: { duration: 9.6, score: scoreHour },
      "hour-out": { duration: 3.6, score: scoreHourOut }
    };
    var AUDIO = null;
    var PLAYING = null;
    function audioContext() {
      var C = window.AudioContext || window.webkitAudioContext;
      if (!C) {
        return null;
      }
      if (!AUDIO) {
        AUDIO = new C();
      }
      if (AUDIO.state === "suspended") {
        AUDIO.resume();
      }
      return AUDIO;
    }
    function playJingle(name, when) {
      return playJingles([{ name, at: num(when, 0) }]);
    }
    function playJingles(list) {
      var ctx = audioContext();
      if (!ctx) {
        return function() {
        };
      }
      if (PLAYING) {
        PLAYING();
      }
      var out = ctx.createGain();
      out.connect(ctx.destination);
      var m = mixer(ctx, out);
      list.forEach(function(x) {
        var at2 = Math.max(ctx.currentTime + 0.02, num(x.at, 0));
        if (x.bed && BEDS[x.bed]) {
          playBed(m, x.bed, at2, Math.max(at2, num(x.until, at2)));
          return;
        }
        var j = JINGLES[x.name];
        if (j) {
          j.score(m, at2);
        }
      });
      PLAYING = function() {
        var now = ctx.currentTime;
        out.gain.setValueAtTime(out.gain.value, now);
        out.gain.linearRampToValueAtTime(0, now + 0.08);
        window.setTimeout(function() {
          out.disconnect();
        }, 200);
      };
      return PLAYING;
    }
    function renderJingle(name, sampleRate) {
      if (BEDS[name]) {
        return renderBed(name);
      }
      var j = JINGLES[name];
      var C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (!j || !C) {
        return Promise.reject(new Error("no jingle or no offline audio"));
      }
      var sr = num(sampleRate, 44100);
      var ctx = new C(2, Math.ceil(sr * j.duration), sr);
      var m = mixer(ctx, ctx.destination);
      j.score(m, 0.02);
      return ctx.startRendering();
    }
    function renderBed(name) {
      var C = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      var third = BEDS[name];
      if (!third || !C) {
        return Promise.reject(new Error("no bed or no offline audio"));
      }
      var rate = 48e3;
      var turn = Math.round(BEAT.turn * rate);
      var ctx = new C(2, (BEAT.warm + 1) * turn, rate);
      var m = mixer(ctx, ctx.destination);
      beat(m, 0, BEAT.warm + 1, third);
      return ctx.startRendering().then(function(all) {
        var part = ctx.createBuffer(2, turn, rate);
        for (var ch = 0; ch < 2; ch++) {
          part.getChannelData(ch).set(all.getChannelData(ch).subarray(BEAT.warm * turn, (BEAT.warm + 1) * turn));
        }
        return part;
      });
    }
    function PlayWithSound(props) {
      var w = num(props.width, 716);
      var st = useState3(0);
      var take = st[0];
      var setTake = st[1];
      var cue = num(props.cue, 2);
      function play() {
        var ctx = audioContext();
        setTake(take + 1);
        if (!ctx) {
          return;
        }
        var list = [];
        var at2 = 0;
        var key = null;
        var bed = null;
        (RUNS[props.sample] || []).forEach(function(step) {
          var mode = step.scene.mode;
          var t = ctx.currentTime + at2;
          if (mode === "stinger") {
            list.push({ name: "breaking", at: t });
            key = "beat-minor";
          }
          if (mode === "ident") {
            list.push({ name: "hour", at: t });
            key = "beat-major";
          }
          if ((mode === "desk" || mode === "review") && key && !bed) {
            bed = { bed: key, at: t };
          }
          if (mode === "outro") {
            list.push({ name: step.scene.open === "hour" ? "hour-out" : "breaking-out", at: t });
            if (bed) {
              bed.until = t;
              list.push(bed);
            }
            key = null;
            bed = null;
          }
          at2 += num(step.dur, 4);
        });
        if (!list.length) {
          list.push({ name: props.jingle || "breaking", at: ctx.currentTime + cue });
        }
        playJingles(list);
      }
      return h(
        "div",
        { className: "pn-sound", style: { width: w + "px" } },
        h(Pip, { key: "take-" + take, width: w, sample: props.sample, animate: true, shadow: false, radius: props.radius }),
        h(
          "div",
          { className: "pn-sound-bar" },
          h("button", { type: "button", className: "pn-sound-btn", onClick: play }, "\u25B6 Play with sound"),
          props.caption ? h("span", { className: "pn-sound-note" }, props.caption) : null
        )
      );
    }
    function Band(props) {
      var tuned = bool(props.tuned, false);
      return h(
        "div",
        { className: cx("pn-band", bool(props.parts, false) && "pn-band--parts") },
        h(
          "span",
          { className: "pn-band-plate", role: "img", "aria-label": tuned ? "KLWD, Tune out" : "KLWD, Tune in" },
          h("span", { className: "pn-mark pn-band-mark" }, h("span", { className: "pn-chrome pn-mark-letters" }, "KLWD")),
          h(
            "span",
            { className: cx("pn-band-act", tuned ? "pn-band-act--out" : "pn-band-act--in") },
            h("span", { className: "pn-band-word" }, tuned ? "TUNE OUT" : "TUNE IN")
          )
        )
      );
    }
    var USAGE = { low: "#3A82DA", critical: "#D2544A", quiet: "#87867F", track: "#8C8C8C" };
    var USAGE_HOURGLASS = '<path d="M3.4 1.6h6.2M3.4 11.4h6.2M4 1.6v1.6l2.5 3.3L9 3.2V1.6M4 11.4V9.8l2.5-3.3L9 9.8v1.6"/>';
    var USAGE_CALENDAR = '<rect x="1.8" y="2.8" width="9.4" height="8.4" rx="1.6"/><path d="M1.8 5.7h9.4M4.4 1.5v2.4M8.6 1.5v2.4"/>';
    var USAGE_PADLOCK = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="22" viewBox="0 0 13 22"><g transform="translate(0 4.5)" fill="none" stroke="' + USAGE.quiet + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><rect x="2.6" y="5.9" width="7.8" height="5.5" rx="1.4"/><path d="M4.3 5.9V3.3a2.2 2.2 0 0 1 4.4 0M6.5 8.2v.9"/></g></svg>';
    function usageMark(glyph, used, left, colour) {
      var ring = 59.06;
      var wedge = 18.85;
      return '<svg xmlns="http://www.w3.org/2000/svg" width="41" height="22" viewBox="0 0 41 22"><g transform="translate(0 4.5)" fill="none" stroke="' + USAGE.quiet + '" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">' + glyph + '</g><circle cx="30" cy="11" r="9.4" fill="none" stroke="' + USAGE.track + '" stroke-opacity="0.3" stroke-width="2.6"/><circle cx="30" cy="11" r="9.4" fill="none" stroke="' + colour + '" stroke-width="2.6" stroke-dasharray="' + (ring * used).toFixed(2) + " " + ring + '" transform="rotate(-90 30 11)"/><circle cx="30" cy="11" r="3" fill="none" stroke="' + USAGE.track + '" stroke-opacity="0.3" stroke-width="6"/><circle cx="30" cy="11" r="3" fill="none" stroke="' + USAGE.quiet + '" stroke-width="6" stroke-dasharray="' + (wedge * left).toFixed(2) + " " + wedge + '" transform="rotate(-90 30 11)"/></svg>';
    }
    function svgImage(key, source, w, hgt, alt) {
      return h("img", { key, src: "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source), width: w, height: hgt, alt });
    }
    function UsageBand() {
      return h(
        "span",
        { className: "pn-usage" },
        h("span", { key: "s", className: "pn-usage-meter" }, svgImage("i", usageMark(USAGE_HOURGLASS, 0.42, 0.6, USAGE.low), 41, 22, "Current session: 42% used"), h("b", { key: "p", style: { color: USAGE.low } }, "42%")),
        h("span", { key: "w", className: "pn-usage-meter" }, svgImage("i", usageMark(USAGE_CALENDAR, 0.92, 0.3, USAGE.critical), 41, 22, "Weekly: 92% used"), h("b", { key: "p", style: { color: USAGE.critical } }, "92%")),
        svgImage("l", USAGE_PADLOCK, 13, 22, "Session lock: off")
      );
    }
    function PromptSketch(props) {
      var dark = props.theme === "dark";
      var w = num(props.width, 720);
      return h(
        "div",
        { className: cx("pn-app", dark ? "pn-app--dark" : "pn-app--light"), style: { width: w + 80 + "px" } },
        h(
          "div",
          { key: "lines", className: "pn-app-lines", "aria-hidden": "true" },
          [0.94, 0.86, 0.58].map(function(f, i) {
            return h("i", { key: i, style: { width: Math.round(w * f) + "px" } });
          })
        ),
        h(
          "div",
          { key: "band", className: "pn-app-band" },
          props.beside === "usage" ? h(UsageBand, { key: "usage" }) : null,
          h(Band, { key: "ours", tuned: props.tuned, parts: props.parts })
        ),
        h(
          "div",
          { key: "field", className: "pn-app-field" },
          h("span", { key: "hint", className: "pn-app-hint" }, "Reply\u2026"),
          h(
            "span",
            { key: "add", className: "pn-app-add", "aria-hidden": "true" },
            h("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" }, h("path", { d: "M7 2.5v9M2.5 7h9" }))
          ),
          h(
            "span",
            { key: "send", className: "pn-app-send", "aria-hidden": "true" },
            h("svg", { width: 14, height: 14, viewBox: "0 0 14 14", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }, h("path", { d: "M7 11.5V2.5M3 6.5l4-4 4 4" }))
          )
        )
      );
    }
    window.PipNews = {
      Pip,
      PipControls,
      Broadcast: Broadcast2,
      TopBand,
      Ticker: Ticker2,
      LowerThird,
      Stinger,
      Ident,
      SessionBoard,
      StatePill,
      NewsDesk,
      OTSBox,
      HourReview,
      Clawd,
      Mark,
      Stage: Stage2,
      crawlStep: crawlStep2,
      crawlSpeed: CRAWL_SPEED,
      EVENTS,
      STATES,
      CLAWD_SOURCE,
      clawdGrid,
      pipSize,
      dayPart,
      pipRange,
      samples: SAMPLES,
      runs: RUNS,
      PlayWithSound,
      Band,
      PromptSketch,
      playJingle,
      playJingles,
      renderJingle,
      jingles: Object.keys(JINGLES),
      beds: Object.keys(BEDS),
      beat: BEAT
    };
  })();

  // packages/renderer/src/design.ts
  var PipNews = window.PipNews;
  if (PipNews === void 0) {
    throw new Error("the design system did not load: window.React was missing when its bundle ran");
  }
  var { Broadcast, Stage, Ticker, crawlStep, crawlSpeed, samples } = PipNews;

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
    const director = (0, import_react.useMemo)(() => createSource({ reducedMotion }), [createSource, reducedMotion]);
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
        if (snapshot.current !== null) {
          setProgram(next);
        }
      };
      const unsubscribe = subscribe((message) => {
        if (message.type === "snapshot") {
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
    function step() {
      const now = Date.now();
      if (now - cycleStart >= CYCLE_MS) {
        cycle += 1;
        cycleStart = now;
        sessions = newSessions(now);
        pending = plan();
      }
      const elapsed = now - cycleStart;
      while (pending[0] !== void 0 && pending[0].at <= elapsed) {
        pending.shift()?.run(sessions, now, cycle);
      }
      for (const session of sessions) {
        session.checkedInAt = now;
      }
      receive({ type: "snapshot", now, visible: true, sessions, lastReportAt: null });
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
    const director = createDirector();
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
    return ready.then(() => new Promise((done) => window.setTimeout(done, SETTLE_MS)));
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
