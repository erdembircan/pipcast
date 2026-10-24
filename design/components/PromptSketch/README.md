# PromptSketch

Review-board furniture, never part of the mod: a plain sketch of the Claude desktop app's prompt box with the band above it, so the band can be judged where it lives. The band sits in the container the desktop draws round every mod's band: a rounded box a step off the ground (`app-band`, `app-band-dark`), no border, 43 px tall for one 40 px line, 11 px corners, content 8 px in, 6 px above the prompt box. The dark theme's colours are measured from a screenshot of the app; the light theme's band colour is inferred. No logo, no wordmark: the transcript is grey lines and the box says "Reply…". Its colours are the `app-` tokens, all furniture.

- `theme`: `"light"` (the default) or `"dark"`, the app's.
- `width`: the transcript column in px, 720 by default; the sketch is 80 px wider and 258 px tall. A narrow one stands for a pane docked beside the transcript.
- `beside`: `"usage"` draws usage-band's group first, as that mod draws it (its own marks and colours), to show ours beside another mod's band.
- `tuned` and `parts` pass to `Band`.
