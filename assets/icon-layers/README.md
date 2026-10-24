# The icon, in layers

KLWD's tower over the city at dusk, its beacon sending out the board's signal, taken apart for animating. `scripts/build-icon.mjs` draws every file here and `assets/icon.svg` from the same layers, and `scripts/render-icon.sh` renders the PNGs; `scripts/build.sh` runs both. Don't edit these files by hand: change the script and build again.

## How they stack

Every layer is drawn on the icon's own canvas, 1024 units square, so the layers line up when they are stacked with nothing moved. Each comes as an SVG, `<name>.svg`, and as a 2048-pixel PNG with a transparent ground, `png/<name>.png`. Stack them in the order `layers.json` lists them, bottom first, and mask the stack with `tile-mask`: that is the icon. No layer is cut to the tile, so anything that moves keeps its whole shape until the mask trims it.

| Layer | What it holds | It moves about |
| --- | --- | --- |
| `sky` | The dusk: deep blue at the top, then violet, then the coral glow along the horizon | Its middle |
| `ring-1`, `ring-2`, `ring-3` | The signal's three rings, smallest first | The beacon |
| `tower-l1`, `tower-l2`, `tower-l3` | The towers left of the station, nearest first: each tower, its unlit windows, and its mast if it has one | The foot of the tower |
| `tower-l1-lights` and the rest | A tower's lit windows and its mast's red beacon, riding with that tower | The foot of the tower |
| `tower-r1`, `tower-r2`, `tower-r3` | The same, right of the station. `tower-r3` stands outside the tile and shows only if the city moves | The foot of the tower |
| `station` | KLWD's building and its unlit windows | The foot of the building |
| `station-lights` | The building's lit windows | The foot of the building |
| `station-sign` | KLWD in chrome near the top of the building | The foot of the building |
| `mast` | The chrome mast on the roof | Its foot, on the roof |
| `beacon-glow` | The red glow round the beacon | The beacon |
| `beacon` | The beacon's lamp | The beacon |
| `gloss` | The sheen over the top half of the tile | The top of the tile |
| `rim` | The tile's edge | Its middle |

`tile-mask` is the tile's shape in white, for a track matte or a clip. It is not part of the stack.

## layers.json

`layers.json` lists the layers in stacking order. For each one it gives its two files; its bounds, the box round what it draws as `[x1, y1, x2, y2]` in canvas units, which for the two outer rings and the two outer towers runs past the canvas; the point it moves about, `anchor`; and the layer it rides with, `with`, so a tower's lights move with their tower. Each ring also gives its circle, `cx`, `cy`, `r`, `strokeWidth` and `opacity`, so it can be drawn again at any size. Two points have names: the beacon, at (512, 236), and the foot of the mast, at (512, 650).

## Moving it as KLWD does

On air, the board's ring sends out its signal: a wave leaves the ring every 3 seconds and spreads to two and a half times the ring's size, fading as it goes, 9 seconds from the ring to gone. Red beacons light the masts at dusk and at night, and about a third of the city's windows are lit at dusk. A glint crosses chrome words as they land. `design/README.md` has the rest of the station's motion.
