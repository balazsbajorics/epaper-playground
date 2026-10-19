// Bitmaps are packed 1 bit per pixel, row-major, most significant bit first,
// 1 = white (paper), 0 = black (ink). Rows are NOT padded to a byte boundary:
// a 240 x 320 panel takes exactly 240 * 320 / 8 = 9600 bytes. This matches what
// the panel model and the canvas display accept.

export function bitmapLength(width, height) {
  return Math.ceil((width * height) / 8);
}

// A blank bitmap, white by default.
export function createBitmap(width, height, white = true) {
  return new Uint8Array(bitmapLength(width, height)).fill(white ? 255 : 0);
}

export function getPixel(bitmap, width, x, y) {
  const i = y * width + x;
  return (bitmap[i >> 3] >> (7 - (i & 7))) & 1;
}

export function setPixel(bitmap, width, x, y, white) {
  const i = y * width + x,
    mask = 1 << (7 - (i & 7));
  if (white) bitmap[i >> 3] |= mask;
  else bitmap[i >> 3] &= ~mask;
}

// Unpack to one Float32 per pixel (1 = white, 0 = black).
export function unpackBits(bitmap, width, height) {
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = (bitmap[i >> 3] >> (7 - (i & 7))) & 1;
  return out;
}

// Pack an array of per-pixel luminance values (0..1, or 0..255 when `max` is 255).
export function packBits(values, width, height, {threshold = 0.5, max = 1} = {}) {
  const out = createBitmap(width, height, false),
    limit = threshold * max;
  for (let i = 0; i < width * height; i++)
    if (values[i] >= limit) out[i >> 3] |= 1 << (7 - (i & 7));
  return out;
}

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

// Convert RGBA ImageData (from any 2D canvas) into a 1-bit bitmap.
// dither: 'none' (threshold), 'bayer' (ordered 4 x 4) or 'floyd-steinberg' (error diffusion).
// Design tip: 'none' for crisp text and UI, dithering for photos and gradients.
export function fromImageData(image, {threshold = 0.5, dither = 'none'} = {}) {
  const {width, height, data} = image,
    gray = new Float32Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4,
      alpha = data[o + 3] / 255,
      lum = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    gray[i] = lum * alpha + (1 - alpha); // transparent = paper
  }
  if (dither === 'floyd-steinberg') {
    const out = createBitmap(width, height, false);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x,
          old = gray[i],
          white = old >= threshold ? 1 : 0,
          error = old - white;
        if (white) out[i >> 3] |= 1 << (7 - (i & 7));
        if (x + 1 < width) gray[i + 1] += error * (7 / 16);
        if (y + 1 < height) {
          if (x > 0) gray[i + width - 1] += error * (3 / 16);
          gray[i + width] += error * (5 / 16);
          if (x + 1 < width) gray[i + width + 1] += error * (1 / 16);
        }
      }
    return out;
  }
  if (dither === 'bayer') {
    const out = createBitmap(width, height, false);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x,
          level = (BAYER_4[y & 3][x & 3] + 0.5) / 16;
        if (gray[i] + (level - 0.5) * 0.99 >= threshold) out[i >> 3] |= 1 << (7 - (i & 7));
      }
    return out;
  }
  return packBits(gray, width, height, {threshold});
}

// Convert a canvas (HTMLCanvasElement or OffscreenCanvas) of the panel's size.
export function fromCanvas(canvas, options) {
  const context = canvas.getContext('2d');
  return fromImageData(context.getImageData(0, 0, canvas.width, canvas.height), options);
}

// Accept whatever a caller is likely to have and return a packed bitmap:
// a packed Uint8Array (returned as is), a base64 string of one, ImageData, or a canvas.
export function toBitmap(source, width, height, options) {
  if (source instanceof Uint8Array) return source;
  if (typeof source === 'string') return Uint8Array.from(atob(source), (c) => c.charCodeAt(0));
  if (source && typeof source.getContext === 'function') {
    if (source.width !== width || source.height !== height)
      throw new RangeError(
        `Canvas is ${source.width} x ${source.height}, panel is ${width} x ${height}`,
      );
    return fromCanvas(source, options);
  }
  if (source && source.data && source.width && source.height) {
    if (source.width !== width || source.height !== height)
      throw new RangeError(
        `ImageData is ${source.width} x ${source.height}, panel is ${width} x ${height}`,
      );
    return fromImageData(source, options);
  }
  throw new TypeError('Expected a packed Uint8Array, a base64 string, ImageData or a canvas');
}

export function toBase64(bitmap) {
  let binary = '';
  for (let i = 0; i < bitmap.length; i++) binary += String.fromCharCode(bitmap[i]);
  return btoa(binary);
}
