import {EpaperPanel} from './panel.js';
import {noise} from './noise.js';
import {toBitmap} from './bitmap.js';

// Paint a panel's brightness field into RGBA bytes with paper and ink texture.
// Exported so headless renderers (tests, Node image export) can reuse it.
export function createRasterizer(panel, scale = 2) {
  if (scale !== 1 && scale !== 2) throw new RangeError('Backing scale must be 1 or 2');
  const width = panel.width * scale,
    height = panel.height * scale,
    source = new Uint32Array(width * height),
    grain = new Float32Array(width * height),
    ink = new Uint8Array(width * height),
    paper = new Uint8Array(width * height);
  // Two samples per logical pixel reveal fine, anchored capsule grain on a
  // high-density screen without blurring or changing the submitted bitmap.
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = y * width + x,
        p = Math.floor(y / scale) * panel.width + Math.floor(x / scale);
      source[i] = p;
      grain[i] = noise(x, y, panel.seed + 5) * 2 - 1;
      ink[i] = Math.round(29 + panel.surface[p] * 3 + grain[i] * 2);
      paper[i] = Math.round(241 + panel.surface[p] * 2 + grain[i] * 1.5);
    }
  return {
    width,
    height,
    rasterize(pixels, data) {
      for (let i = 0; i < source.length; i++) {
        let brightness = pixels[source[i]];
        const offset = i * 4;
        if (panel.enabled)
          brightness = Math.max(
            0,
            Math.min(1, brightness + grain[i] * brightness * (1 - brightness) * 0.45),
          );
        const dark = panel.enabled ? ink[i] : 27,
          light = panel.enabled ? paper[i] : 243,
          luminance = dark + brightness * (light - dark);
        // Grain is strongest mid-transition; only a few tonal levels remain in settled
        // ink and paper. Instant mode is the untextured, exact bitmap preview.
        data[offset] = Math.round(luminance);
        data[offset + 1] = Math.round(luminance + 2 - 4 * brightness);
        data[offset + 2] = Math.round(luminance - 13 * brightness);
        data[offset + 3] = 255;
      }
      return data;
    },
  };
}

// Drive a <canvas> (or OffscreenCanvas) from a panel. Options are the EpaperPanel
// options plus:
//   scale        backing pixels per panel pixel, 1 or 2 (default 2)
//   onState      called after each paint with panel.state
//   clock, requestFrame, cancelFrame   injectable for tests and workers
//   dither, threshold                  defaults for converting canvases / ImageData
export function createEpaperDisplay(
  canvas,
  {
    onState = () => {},
    clock = () => performance.now(),
    requestFrame = (callback) => requestAnimationFrame(callback),
    cancelFrame = (id) => cancelAnimationFrame(id),
    scale = 2,
    dither = 'none',
    threshold = 0.5,
    ...options
  } = {},
) {
  const panel = new EpaperPanel(options),
    raster = createRasterizer(panel, scale);
  canvas.width = raster.width;
  canvas.height = raster.height;
  const context = canvas.getContext('2d'),
    image = context.createImageData(raster.width, raster.height);
  let animation = null,
    lastPaint = -Infinity,
    needsPaint = false;
  function paint(now) {
    raster.rasterize(panel.tick(now), image.data);
    context.putImageData(image, 0, 0);
    onState(panel.state);
    lastPaint = now;
    needsPaint = false;
  }
  function animate(now) {
    animation = null;
    if (now - lastPaint >= 32) paint(now);
    if (panel.active || needsPaint) animation = requestFrame(animate);
  }
  function wake() {
    needsPaint = true;
    if (animation === null) animation = requestFrame(animate);
  }
  const convert = (source, override) =>
    toBitmap(source, panel.width, panel.height, {dither, threshold, ...override});
  return {
    panel,
    canvas,
    width: panel.width,
    height: panel.height,
    // submit(source, {full, dither, threshold}); source is a packed bitmap, base64,
    // ImageData or a canvas of the panel's size. Also accepts {pixels, full}.
    submit(source, {full = false, ...override} = {}) {
      if (source && source.pixels !== undefined && !(source instanceof Uint8Array)) {
        full = !!source.full;
        source = source.pixels;
      }
      const bytes = convert(source, override);
      if (bytes.length !== panel.bitmapLength) return false;
      const accepted = panel.submit(bytes, full, clock());
      wake();
      return accepted;
    },
    refresh() {
      panel.refresh(clock());
      wake();
    },
    setEnabled(value) {
      panel.setEnabled(value, clock());
      wake();
    },
    reset() {
      if (animation !== null) cancelFrame(animation);
      animation = null;
      panel.reset();
      paint(clock());
    },
    // Stop animating; call before discarding the display.
    dispose() {
      if (animation !== null) cancelFrame(animation);
      animation = null;
    },
    get state() {
      return panel.state;
    },
  };
}
