/**
 * PiP Newsroom (window.PipNews). Sizes are stage units on the 960 x 540 stage
 * unless a prop says pt. Boolean and number props also accept "true" and "640".
 */

export type SessionState = 'needs-input' | 'error' | 'ready' | 'working';
/** The stories, each airing as BREAKING NEWS (`ready` and `complete` are a finished turn with and without changes), and `hourly`: the scheduled report on the hour. */
export type EventKind = 'needs-input' | 'ready' | 'complete' | 'error' | 'hourly';
export type ClawdAct = 'idle' | 'talk' | 'urgent' | 'cheer' | 'swivel' | 'glance';
export type ClawdPose = 'default' | 'arms-up' | 'look-left' | 'look-right';
export type ClawdEyes = 'open' | 'left' | 'right' | 'closed' | 'wink';
export type ClawdArms = 'down' | 'up' | 'one-up';
export type ClawdFeet = 'both' | 'left' | 'right';
export type ClawdFacing =
  | 'right-12' | 'right-30' | 'right-55' | 'right-75' | 'edge'
  | 'back-105' | 'back-125' | 'back-150' | 'back'
  | 'left-75' | 'left-55' | 'left-30' | 'left-12';

/** One tracked session as the live board shows it. */
export interface Session {
  id: string;
  /** The session's title, shown as it is written in the listing. */
  name: string;
  /** The session's project, its repository's name or else its folder's: it leads the session's row on a plate. */
  project?: string;
  state: SessionState;
}

/** The story a news flash tells. */
export interface NewsEvent {
  kind: EventKind;
  session?: string;
  project?: string;
  /** A permission ask: the command or tool and its target, shown in gold above Claude's own description of it. */
  command?: string;
  /** Quoted on the wall monitor: Claude's description of a command, its question, its last words (complete), or the error in plain words. */
  quote?: string;
  /** The one number: "+182 −40", "15 min". */
  figure?: string;
  sub?: string;
  foot?: string;
  label?: string;
}

/** A line of the crawl. `lead` is a caps word in gold; `key` says what the line is about (a story, a session), so the crawl knows the line when its words change. */
export type TickerItem = string | { lead?: string; text: string; key?: string };

/** One moment of the feed: the contract shared by review boards and the renderer. */
export interface Scene {
  /** `ident` and `review` belong to the report on the hour. */
  mode: 'board' | 'stinger' | 'desk' | 'outro' | 'ident' | 'review';
  /** The outro: the board scene it hands back to, drawn underneath as the open fades. */
  board?: Scene;
  /** The outro: 'hour' for the report's (the ident run out, with `hour`), else BREAKING NEWS's. */
  open?: 'hour';
  /** 24-hour clock: "14:32". */
  clock?: string;
  sessions?: Session[];
  /** The board: the account's usage limits, on meters under the listing; none before a session has read them. */
  limits?: LimitMeter[];
  event?: NewsEvent;
  act?: ClawdAct;
  ticker?: TickerItem[];
  tickerLabel?: string;
  tickerOffset?: number;
  /** Stinger or ident progress, 0 to 1: one number drives the whole open. */
  progress?: number;
  /** The lower third's headline and strap at the desk, when not the event's own. */
  headline?: string;
  strap?: string;
  /** On the hour: the hour struck, "15:00". */
  hour?: string;
  /** THE HOUR IN REVIEW: the span on its tab, "14:00–15:00". */
  span?: string;
  /** THE HOUR IN REVIEW: one row per session, four a page. */
  rows?: HourRow[];
  label?: string;
}


/** One session's hour, as THE HOUR IN REVIEW shows it, read as the session's row on the board. */
export interface HourRow {
  id?: string;
  /** The session's project, its repository's name or else its folder's: it leads the row on the listing's plate. */
  project?: string;
  /** The session's title, as the listing shows it. A row without one names its project here instead, with no plate. */
  name?: string;
  state: SessionState;
  /** One short detail under the title: "Waiting 4 min", "+182 −40". */
  detail?: string;
}

/** One of the account's usage limits on the board: `session`, Claude's five-hour window, or `week`, its seven-day window, and the share used, a whole percent from 0 to 100. */
export interface LimitMeter {
  kind: 'session' | 'week';
  percent: number;
}

export interface RunStep { scene: Scene; dur: number }

export interface PipProps {
  /** Window width in pt; in the product it is its quadrant's: pipSize(screenWidth, screenHeight).width (716 on a 14-inch MacBook Pro). */
  width?: number;
  /** A scene name from PipNews.samples, or a run: "loop" (the interruptions), "breaking", "breaking-ready", "breaking-complete" and "breaking-error" (one story each, from the board and back) or "hour" and "quiet-hour" (the report on the hour). */
  sample?: string;
  scene?: Scene;
  run?: RunStep[];
  /** Show close, Transparent window, sound and Back to Claude as they look on hover. */
  controls?: boolean;
  /** With `controls`: the states the sound and Transparent window buttons show, and the button under the pointer. */
  sound?: 'on' | 'off';
  transparent?: 'on' | 'off';
  hover?: 'close' | 'transparent' | 'sound' | 'back';
  /** The window with nothing in it: the window itself. */
  blank?: boolean;
  animate?: boolean;
  shadow?: boolean;
  /** Corner radius in px; defaults to the 20 pt of radius-pip. */
  radius?: number;
  /** Replaces the broadcast with a stage of your own. */
  children?: unknown;
}

/** PipNews.pipSize(screenWidth, screenHeight, margin?): the window's full size in pt, which is its quadrant at 16:9. */
export interface PipSize { width: number; height: number }

/** PipNews.pipRange(screenWidth, screenHeight, margin?, minScale?): the full size, which is also the largest, and the smallest. */
export interface PipRange { full: PipSize; min: PipSize }

/** One unit of the crawl: an item and the diamond after it, `width` stage px wide. */
export interface CrawlUnit { key: string; item: TickerItem; width: number }

/** The crawl between frames: how far it has moved past the view's left edge, its units, the keys laid in this round, the key laid last, and whether anything was ever laid. */
export interface CrawlBelt { offset: number; units: CrawlUnit[]; done: Record<string, boolean>; last: string | null; started: boolean }

/** What one step of the crawl goes by: seconds since the last step, stage px a second, the view's width, the list as it is now, and the width a unit for an item takes. */
export interface CrawlInput { dt: number; speed: number; view: number; items: TickerItem[]; measure: (item: TickerItem) => number }

/** PipNews.crawlStep(belt, input) moves the crawl one step without drawing anything: the belt after the step, how many units left past the tab, and the items laid. PipNews.crawlSpeed is its speed on air, 53 stage px a second. */
export interface CrawlStepResult { belt: CrawlBelt; dropped: number; laid: TickerItem[] }

export interface PipControlsProps {
  width?: number;
  /** The state the sound button shows; "on" by default. */
  sound?: 'on' | 'off';
  /** The state the Transparent window button shows; "off" by default. */
  transparent?: 'on' | 'off';
  /** The button under the pointer: its glass brightens. Nothing pops up, no name and no tooltip. */
  hover?: 'close' | 'transparent' | 'sound' | 'back';
}

export interface BroadcastProps { scene?: Scene; sample?: string; run?: RunStep[]; animate?: boolean }

/** The station mark: KLWD in chrome, alone. `size` is the letters' size in px (40 in the bug). */
export interface MarkProps { size?: number; text?: string }

export interface TopBandProps { mark?: string; inline?: boolean }

/** The crawl and the clock at its right end; `sample` takes both from a scene. `animate` crawls at `PipNews.crawlSpeed`, and one crawl runs per Stage. */
export interface TickerProps { items?: TickerItem[]; time?: string; sample?: string; label?: string; animate?: boolean; offset?: number; inline?: boolean }

export interface LowerThirdProps {
  kind: EventKind;
  session?: string;
  project?: string;
  strap?: string;
  tag?: string;
  headline?: string;
  inline?: boolean;
}

/** The one open, BREAKING NEWS, the same for every story; `kind` is accepted and ignored. */
export interface StingerProps { kind?: EventKind; words?: string[]; progress?: number; animate?: boolean; duration?: number; /** The outro: the intro run out, ending clear. */ outro?: boolean }


/** ON THE HOUR: progress 0 is :55 before the hour, two thirds is the hour, 1 is 2.5 s past it; 7.5 s when animated. */
export interface IdentProps { hour?: string; words?: string[]; progress?: number; animate?: boolean; duration?: number; /** The outro: the ident's last picture run out over 1.4 s, ending clear. */ outro?: boolean }

export interface HourReviewProps { rows?: HourRow[]; span?: string; sample?: string; label?: string; inline?: boolean; /** Turns the pages, 10 s each; without it the review holds its first page. */ animate?: boolean }

export interface SessionBoardProps { sessions?: Session[]; sample?: string; sort?: boolean; inline?: boolean; /** Turns the pages, 8 s each; without it the board holds its first page. */ animate?: boolean; /** The account's usage limits, on meters under the listing beside the page tab: SESSION, then WEEK. */ limits?: LimitMeter[] }

/** The listing's state pill: INPUT, READY or LIVE. */
export interface StatePillProps { state: SessionState; label?: string }

/** The part of the day the city behind the desk shows: from 05:00, 11:00, 17:00 and 21:00. */
export type DayPart = 'morning' | 'afternoon' | 'evening' | 'night';

/** PipNews.dayPart("14:33") gives the part of the day for a clock; "evening" when there is none. */
export interface NewsDeskProps {
  kind: EventKind;
  /** The clock, "14:33": picks the part of the day. */
  time?: string;
  /** Sets the part of the day outright. */
  part?: DayPart;
  act?: ClawdAct;
  pose?: ClawdPose;
  eyes?: ClawdEyes;
  arms?: ClawdArms;
  facing?: ClawdFacing;
  animate?: boolean;
}

export interface OTSBoxProps {
  kind: EventKind;
  label?: string;
  command?: string;
  quote?: string;
  figure?: string;
  sub?: string;
  foot?: string;
  inline?: boolean;
}

export interface ClawdProps {
  /** Px per cell; Clawd is 18 x 10 cells. */
  cell?: number;
  act?: ClawdAct;
  pose?: ClawdPose;
  eyes?: ClawdEyes;
  arms?: ClawdArms;
  feet?: ClawdFeet;
  facing?: ClawdFacing;
  animate?: boolean;
  label?: string;
}

/** What the mod draws in the band above the Claude desktop app's prompt box: one plate, KLWD and TUNE IN or TUNE OUT, nothing else. */
export interface BandProps {
  /** This session is on air: the plate says TUNE OUT. */
  tuned?: boolean;
  /** Outlines the plate, for the build board. */
  parts?: boolean;
}

/** Review-board furniture, never part of the mod: the app's prompt box, sketched, with the band above it. */
export interface PromptSketchProps extends BandProps {
  theme?: 'light' | 'dark';
  /** The transcript column in px, 720 by default; the sketch is 80 px wider and 258 px tall. */
  width?: number;
  /** "usage": usage-band's group first, as that mod draws it. */
  beside?: 'usage';
}

/** Review-board furniture, never on the window: the window playing a run, and under it a button that plays the run again from the start with its jingle. */
export interface PlayWithSoundProps {
  /** A run: "breaking", "breaking-ready", "breaking-complete", "breaking-error", "hour" or "quiet-hour". */
  sample: string;
  /** Only for a run with no intro or outro: the jingle to play. The run's own intro and outro jingles play where they fall. */
  jingle?: string;
  /** Only for a run with no intro or outro: seconds into the run when `jingle` starts. Default 2. */
  cue?: number;
  /** Window width in pt. */
  width?: number;
  radius?: number;
  /** A line next to the button. */
  caption?: string;
}

/**
 * PipNews.playJingle(name, when?) plays a jingle on a shared AudioContext; `when` is on that
 * context's clock. It returns a function that fades the jingle out. Browsers allow it only after a click.
 * PipNews.renderJingle(name, sampleRate?) renders one offline and resolves to an AudioBuffer.
 * PipNews.playJingles([{ name, at }]) plays several in one mix, each at its time: a segment's intro and outro.
 * PipNews.jingles lists the jingles there are: "breaking" (the intro), "breaking-out" (the outro), "hour" (the ident) and "hour-out" (the hour's outro).
 */
export type JingleName = 'breaking' | 'breaking-out' | 'hour' | 'hour-out';
