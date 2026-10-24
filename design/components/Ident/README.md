# Ident

ON THE HOUR, the open of the scheduled report. The station clock, a dial in the wall monitor's chrome bezel with a glossy blue face, gold hour marks and chrome hands, counts the last five seconds: its gold seconds hand steps once with each pip. On the long pip the minute hand jumps to the hour and a glint crosses the face; then the clock steps aside and ON THE HOUR slams in in chrome. Nothing runs under it: no strip, no subtitle.

- Provide `hour` ("15:00"); the clock shows the minute before it until the long pip.
- One number drives it: `progress`, 0 to 1. 0 is five seconds before the hour, two thirds is the hour, 1 is 2.5 s past it. Storyboard frames set it (0.45, 1); with `animate` it runs over 7.5 s (`duration` overrides), handed to the compositor as the stinger's run is. Under reduced motion, or in a browser without the Web Animations API, it shows the last frame.
- The clock carries the mark, KLWD in chrome, on its face below the centre. The clock and ON THE HOUR share the frame's centre line.
- Its jingle (`PipNews.playJingle('hour')`) sounds a pip as the seconds hand steps through each of the last five seconds and a long one as the minute hand jumps, then the brass fanfare as the words land. A late report waits its turn and airs the same way, countdown and all.

- `outro` runs the ident's last picture out over 1.4 s, the report's last moment: a glint crosses the words, the words leave to the right, the clock drops back and fades, and the ident fades to whatever is underneath (`Broadcast` puts the board there). Its jingle is `hour-out`.

It airs only on the hour and never in an event's colour: interruptions keep the stinger. The top band stays on top of it; the ticker steps aside, as it does for a stinger.
