# Stinger

The full-frame open of every story: BREAKING NEWS on a wall of glass panes on the station's navy, lit by a red wave that leaves each pane glowing, the chrome words slamming in, and a glint. It is the same for every story and carries no title: the session is first named at the desk. After the desk comes its outro.

- One number drives it: `progress`, 0 to 1. A storyboard frame sets it (0.34, 0.74, 1); with `animate` it runs from 0 to 1 over 1.4 s (`duration` overrides). Under reduced motion it shows the last frame.
- `outro` plays the outro instead: the intro's last picture run out over 1.2 s, ending clear, so the board underneath shows through. Broadcast's `outro` mode draws the board under it.
- `words` overrides BREAKING NEWS.

The hour opens with its own ident. The top band stays on top of it.
