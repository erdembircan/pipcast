// The design system's stylesheet, as the product draws with it, and the few
// rules that let the video drive the station's CSS motion from a time. Each
// rule reads a custom property that OnAir sets on every frame, in place of
// the @keyframes the live window leaves to the browser's clock (motion.ts).
import designCss from '../generated/design-css.ts'

const driven = `
.rv-air .pn-l3-line { transform: translateX(var(--rv-l3-x, 0%)); opacity: var(--rv-l3-o, 1); }
.rv-air .pn-l3-strap { transform: translateX(var(--rv-strap-x, 0%)) skewX(var(--slant, -12deg)); opacity: var(--rv-strap-o, 1); }
.rv-air .pn-l3-sweep { transform: translateX(var(--rv-sweep, 0%)); }
.rv-air .pn-ots { transform: scaleY(var(--rv-ots-sy, 1)); filter: brightness(var(--rv-ots-b, 1)); transform-origin: 50% 50%; }
.rv-air .pn-anchor { transform: translateY(var(--rv-bob, 0px)); }
.rv-air .pn-board-slot > .pn-row { transform: translateX(var(--rv-row-x, 0px)); opacity: var(--rv-row-o, 1); }
.rv-air .pn-clawd { will-change: auto; }
`

// The window's glass controls and its tab, with no backdrop-filter: headless
// Chrome leaves a backdrop-filtered layer out of some of its captures (the
// blur is drawn and the button is not), so the controls blinked from frame to
// frame. The video frosts the glass with a tint instead of blurring what is
// under it: a slate tint, matched by eye to the blurred glass over the board.
const glass = `
.pn-glass { -webkit-backdrop-filter: none; backdrop-filter: none; background: linear-gradient(rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.2)), rgba(62, 74, 112, 0.78); }
.pn-glass.pn-glass--hover { background: linear-gradient(rgba(255, 255, 255, 0.28), rgba(255, 255, 255, 0.28)), rgba(62, 74, 112, 0.78); }
`

export function DesignStyles() {
  return <style>{designCss + driven + glass}</style>
}
