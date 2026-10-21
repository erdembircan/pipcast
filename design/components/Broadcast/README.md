# Broadcast

The whole picture for one moment of the feed, composed from a scene: the live board, a stinger, the news desk, or a piece of the report on the hour, with the top band and the ticker.

- Provide `scene` or `sample`. A scene is `{ mode, clock, sessions, event, act, ticker }`: `mode` is `board`, `stinger` (the intro), `desk`, `outro`, `ident` or `review`; `event` is `{ kind, session, project, quote, figure, sub, foot }` with `kind` one of `needs-input`, `ready`, `complete`, `error`, `hourly`.
- An `outro` scene carries `board`, the board scene it hands back to, drawn underneath as the open fades. With `open: 'hour'` (and `hour`) it is the report's outro, the ident run out; otherwise BREAKING NEWS's.
- At the desk, `headline` and `strap` on the scene replace the event's own (the hour's 2 STORIES, A QUIET HOUR).
- On the hour: `ident` takes `hour` and `progress`; `review` takes `rows` and `span`. The ticker steps aside for the ident, as it does for a stinger.
- `run` (or a run's name as `sample`: `loop` for the interruptions, `breaking`, `breaking-ready`, `breaking-complete` and `breaking-error` for one story each, `hour` for the report on the hour, `quiet-hour` for a quiet one) steps through a list of `{ scene, dur }` when `animate` is on; a static frame shows the first scene.
- It fills a 960 × 540 stage; mount it through `Pip` or `Stage`.

The scene object is the contract between the station canvas and the production renderer: the same state model drives both.
