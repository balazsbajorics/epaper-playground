# epaper-playground

A monochrome e-paper (e-ink) display simulator for the browser, with no
dependencies. It shows what a 1-bit frame looks like on a real panel: the slow
partial refresh, the invert/black/white flashing of a full refresh, the ghosts
that partial updates leave behind, the automatic clean after a few partials,
and the texture of paper and ink. Use it to test UI designs for e-paper devices
before you have the hardware, or to judge whether a design will survive a panel
that takes half a second to change and flashes when it cleans.

Try it: https://balazsbajorics.github.io/epaper-playground/

It was extracted from the browser simulator of the CyberPocket T-Deck MAX
project, where it stands in for a 240 × 320 GDEQ031T10 panel. Timings are
visual approximations of typical waveforms, not measurements of a module.

## Quick start

No build step. Copy `src/` next to your page (or `npm install epaper-playground`)
and import it as an ES module.

```html
<canvas id="screen" style="width: 480px; image-rendering: pixelated"></canvas>
<script type="module">
  import {createEpaperDisplay, preset} from './src/index.js';

  // A 3.1" 240 × 320 panel driving the <canvas>.
  const display = createEpaperDisplay(
    document.getElementById('screen'),
    preset('3.1'),
  );

  // Draw your UI on an ordinary canvas of the same size...
  const frame = new OffscreenCanvas(display.width, display.height);
  const ctx = frame.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, frame.width, frame.height);
  ctx.fillStyle = '#000';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('12:34', 40, 160);

  // ...and submit it. The panel converts it to 1-bit and animates a partial refresh.
  display.submit(frame);
  // display.submit(frame, {full: true}) requests a full (flashing, cleaning) refresh.
</script>
```

Run `node serve.js` and open http://localhost:4175/ for the playground, or
`examples/minimal.html` for the snippet above. Any static server works; the
page is plain HTML and ES modules.

## Concepts

- **Bitmap.** A frame is 1 bit per pixel, row-major, most significant bit
  first, **1 = white (paper), 0 = black (ink)**, with no row padding. A
  240 × 320 panel is exactly 9600 bytes. `bitmap.js` has helpers to create,
  read, write and convert bitmaps; `display.submit()` accepts a packed
  `Uint8Array`, a base64 string of one, `ImageData`, or any canvas of the
  panel's size and converts it for you.
- **Partial refresh.** Only pixels that differ from the last drawn frame move,
  over `partialMs`. Each partial leaves a faint ghost of the old ink that
  accumulates. Submitting an identical frame does nothing.
- **Full refresh.** The whole panel inverts, goes black, goes white, then
  draws the target, over `fullMs`. Ghosts are cleared. The first frame after a
  reset is always a full refresh, and after `fullEvery` consecutive partials
  the next frame is promoted to a full one (as controllers and firmware do).
- **Coalescing.** A frame submitted while the panel is busy waits; a newer
  frame replaces the waiting one; a requested full refresh is not forgotten.
  This is how a real device behaves when the app redraws faster than the panel.
- **Instant mode.** `setEnabled(false)` shows every frame immediately and
  exactly, without texture. Useful to check the bitmap itself, and the right
  default when the visitor prefers reduced motion.
- **Texture.** Pigment activation and settling times vary per pixel in a
  stationary, seeded pattern, so transitions mottle and catch up instead of
  fading uniformly. Settled paper and ink keep a subtle grain. Nothing changes
  between frames at rest.

## API

All exports come from `src/index.js`. Types are in `types/index.d.ts`.

### `createEpaperDisplay(canvas, options) → display`

Binds an `EpaperPanel` to a `<canvas>` or `OffscreenCanvas` and animates it
with `requestAnimationFrame`. Options are the `EpaperPanel` options below plus:

| Option                                 | Default | Meaning                                                                        |
| -------------------------------------- | ------- | ------------------------------------------------------------------------------ |
| `scale`                                | `2`     | Backing pixels per panel pixel (1 or 2). 2 shows grain on HiDPI.               |
| `dither`                               | `none`  | Default conversion for canvases/ImageData: `none`, `bayer`, `floyd-steinberg`. |
| `threshold`                            | `0.5`   | Luminance (0..1) at or above which a pixel is paper.                           |
| `onState(state)`                       |         | Called after every paint with `{mode, partials, queued, enabled}`.             |
| `clock`, `requestFrame`, `cancelFrame` |         | Injectable timing for tests and workers.                                       |

The returned object:

| Member                                      | Meaning                                                                |
| ------------------------------------------- | ---------------------------------------------------------------------- |
| `submit(source, {full, dither, threshold})` | Show a frame. Returns `false` if the size is wrong or nothing changed. |
| `refresh()`                                 | Full refresh of the latest frame (a "clean screen" command).           |
| `setEnabled(boolean)`                       | Toggle the simulation; `false` is an exact, instant preview.           |
| `reset()`                                   | Blank white panel, forget history.                                     |
| `dispose()`                                 | Stop animating.                                                        |
| `state`                                     | `{mode: 'idle' \| 'partial' \| 'full', partials, queued, enabled}`     |
| `panel`, `canvas`, `width`, `height`        | The underlying model and sizes.                                        |

Size the canvas with CSS (`width: 480px` for a 240-wide panel at 2×), keep
`image-rendering: pixelated` so pixels stay square.

### `new EpaperPanel(options)`

The model with no DOM dependency; runs in Node, workers, tests. Time is
explicit: pass `now` in milliseconds and call `tick(now)` to advance.

| Option      | Default      | Meaning                                           |
| ----------- | ------------ | ------------------------------------------------- |
| `width`     | `240`        | Panel width in pixels                             |
| `height`    | `320`        | Panel height in pixels                            |
| `partialMs` | `450`        | Partial refresh duration                          |
| `fullMs`    | `1800`       | Full refresh duration                             |
| `fullEvery` | `5`          | Full refresh after this many consecutive partials |
| `enabled`   | `true`       | `false` = instant preview                         |
| `seed`      | `0x54444543` | Seed of the texture fields                        |

| Member                          | Meaning                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- |
| `submit(bitmap, full, now)`     | Queue a packed bitmap. Returns `false` for a wrong size or no change.       |
| `tick(now)`                     | Advance; returns `pixels`, a `Float32Array` of brightness (0 ink, 1 paper). |
| `refresh(now)`                  | Queue a full refresh of the latest frame.                                   |
| `setEnabled(flag, now)`         | Toggle simulation.                                                          |
| `reset()`                       | Blank panel.                                                                |
| `state`, `busy`, `bitmapLength` | Status and the byte count a bitmap must have.                               |

### `createRasterizer(panel, scale) → {width, height, rasterize(pixels, rgba)}`

Turns `panel.pixels` into RGBA bytes with paper and ink texture. This is what
the display uses; call it yourself to render frames headlessly (for example to
encode a GIF of a transition in Node).

### Bitmaps

| Function                                                                | Meaning                                                       |
| ----------------------------------------------------------------------- | ------------------------------------------------------------- |
| `createBitmap(w, h, white = true)`                                      | A blank bitmap                                                |
| `getPixel(bitmap, w, x, y)` / `setPixel(bitmap, w, x, y, white)`        | Single pixels                                                 |
| `fromImageData(image, {threshold, dither})`                             | RGBA → 1-bit. Transparent counts as paper.                    |
| `fromCanvas(canvas, options)`                                           | Same, from a canvas                                           |
| `toBitmap(source, w, h, options)`                                       | Accepts bytes, base64, ImageData or a canvas; checks the size |
| `packBits(values, w, h, {threshold, max})` / `unpackBits(bitmap, w, h)` | Per-pixel arrays ↔ packed bits                                |
| `toBase64(bitmap)` / `bitmapLength(w, h)`                               |                                                               |

Design note: use `dither: 'none'` for UI (crisp edges), `bayer` or
`floyd-steinberg` for photos and gradients. Draw text with the bitmap fonts
below, not `ctx.fillText`.

### Fonts

Text on e-paper must be drawn from bitmap fonts: scalable fonts antialias, and
antialiasing thresholded to 1 bit is speckle. The package bundles three open
bitmap families in BDF, the format firmware font engines such as u8g2 are
generated from, so the simulator draws exactly the glyphs a device would.

| Family   | Ids                                                                                        | License      |
| -------- | ------------------------------------------------------------------------------------------ | ------------ |
| Terminus | `terminus-12` … `terminus-32` (12, 14, 16, 18, 20, 22, 24, 28, 32), each also `-bold`      | OFL 1.1      |
| Spleen   | `spleen-5x8`, `spleen-6x12`, `spleen-8x16`, `spleen-12x24`, `spleen-16x32`, `spleen-32x64` | BSD 2-clause |
| Cozette  | `cozette-13`, `cozette-26`                                                                 | MIT          |

All are monospace. Glyph coverage is Latin, Latin-1, Latin Extended-A,
punctuation, arrows, box drawing, blocks and geometric shapes (trimmed from the
upstream fonts by `tools/trim-bdf.js`). `FONTS` lists every id with its line
height and cell width. Rules of thumb: 16 px for body text on a 240-wide
panel, 12 px for captions, 24 px and up for anything read at a glance.

| Function                                                 | Meaning                                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `loadFonts(ids?, base?)`                                 | Browser: fetch and parse bundled fonts; returns `{id: font}`.                                             |
| `loadFontsFromDisk(ids?, directory?)`                    | Node: the same from the file system.                                                                      |
| `drawText(ctx, font, text, x, y)`                        | Paint glyphs with the context's `fillStyle`; `x, y` is the top-left of the line box. Returns the advance. |
| `drawTextBitmap(bitmap, w, h, font, text, x, y, white?)` | Paint straight into a packed bitmap (no canvas needed).                                                   |
| `measureText(font, text)`                                | Width in pixels.                                                                                          |
| `wrapText(font, text, maxWidth)`                         | Word-wrap into lines.                                                                                     |
| `parseBdf(text)` / `loadBdf(url)` / `toBdf(font, keep?)` | Use any other BDF font (u8g2's sources, X11 fonts, your own).                                             |

A font has `height`, `ascent`, `descent` and a `glyphs` map; the baseline is at
`y + font.ascent`.

### Presets

`PRESETS` and `preset(name)` give sizes and timings for common panels:
`'1.54'` (200 × 200), `'2.13'` (250 × 122), `'2.9'` (296 × 128), `'3.1'`
(240 × 320), `'3.7'` (480 × 280), `'4.2'` (400 × 300), `'5.83'` (648 × 480),
`'7.5'` (800 × 480). Spread and override: `{...preset('4.2'), fullMs: 2500}`.
For a portrait 2.9" panel, swap width and height.

## Testing a design

1. Draw each screen of the design on a canvas of the panel size and submit it.
   Watch the partial refresh: does the change read as one movement, or as a
   smear across the screen? Large inverted regions (selection bars, dark
   headers) ghost the most.
2. Drive the real update cadence: a clock every second, a progress bar every
   200 ms. Count how often `fullEvery` forces a flashing clean and whether
   that is acceptable where it lands.
3. Submit the same screen with `{full: true}` to see what a deliberate clean
   costs (about two seconds of flashing on most panels).
4. Toggle `setEnabled(false)` to check the raw bitmap: threshold artifacts,
   stray gray, anything drawn with `fillText` by mistake.
5. Write tests against `EpaperPanel` directly with fake time (see `test/`):
   it is deterministic for a given seed.

## Development

```sh
npm test            # node:test, no dependencies
node serve.js       # playground at http://localhost:4175/
npx prettier -w .   # formatting
```

MIT license.
