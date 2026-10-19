import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createBitmap,
  getPixel,
  setPixel,
  fromImageData,
  toBitmap,
  toBase64,
  unpackBits,
  preset,
  PRESETS,
  EpaperPanel,
  createRasterizer,
} from '../src/index.js';

const image = (width, height, fill) => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) data.set(fill(i % width, Math.floor(i / width)), i * 4);
  return {width, height, data};
};

test('set and get pixels in a packed bitmap, MSB first, 1 = white', () => {
  const bitmap = createBitmap(10, 2);
  assert.equal(bitmap.length, 3);
  setPixel(bitmap, 10, 0, 0, false);
  setPixel(bitmap, 10, 9, 1, false);
  assert.equal(getPixel(bitmap, 10, 0, 0), 0);
  assert.equal(getPixel(bitmap, 10, 1, 0), 1);
  assert.equal(getPixel(bitmap, 10, 9, 1), 0);
  assert.equal(bitmap[0], 0b01111111);
  assert.deepEqual([...unpackBits(bitmap, 10, 2)].slice(0, 2), [0, 1]);
});

test('threshold conversion treats transparency as paper and dark as ink', () => {
  const bitmap = fromImageData(
    image(8, 1, (x) => (x < 4 ? [0, 0, 0, 255] : x < 6 ? [255, 255, 255, 255] : [0, 0, 0, 0])),
  );
  assert.deepEqual([...bitmap], [0b00001111]);
});

test('dithering spreads a mid gray into a mix of ink and paper', () => {
  for (const dither of ['bayer', 'floyd-steinberg']) {
    const bitmap = fromImageData(
        image(16, 16, () => [128, 128, 128, 255]),
        {dither},
      ),
      white = [...unpackBits(bitmap, 16, 16)].reduce((a, b) => a + b);
    assert.ok(white > 64 && white < 192, `${dither}: ${white} white pixels of 256`);
  }
});

test('toBitmap accepts bytes, base64, ImageData and canvases of the right size', () => {
  const bytes = createBitmap(8, 1, false);
  assert.equal(toBitmap(bytes, 8, 1), bytes);
  assert.deepEqual([...toBitmap(toBase64(Uint8Array.of(0b10100000)), 8, 1)], [0b10100000]);
  const canvas = {
    width: 8,
    height: 1,
    getContext: () => ({getImageData: () => image(8, 1, () => [255, 255, 255, 255])}),
  };
  assert.deepEqual([...toBitmap(canvas, 8, 1)], [255]);
  assert.throws(() => toBitmap(canvas, 9, 1), RangeError);
  assert.throws(() => toBitmap(42, 8, 1), TypeError);
});

test('presets are copies and the panel sizes its bitmap from them', () => {
  const p = preset('3.1');
  p.width = 1;
  assert.equal(PRESETS['3.1'].width, 240);
  assert.equal(new EpaperPanel(preset('2.9')).bitmapLength, (296 * 128) / 8);
  assert.throws(() => preset('99'), RangeError);
});

test('rasterizer renders a settled frame headlessly', () => {
  const panel = new EpaperPanel({width: 8, height: 2});
  panel.submit(createBitmap(8, 2, false), true, 0);
  panel.tick(5000);
  const raster = createRasterizer(panel, 1),
    data = raster.rasterize(panel.pixels, new Uint8ClampedArray(raster.width * raster.height * 4));
  assert.equal(raster.width, 8);
  assert.ok(data[0] < 40 && data[3] === 255);
});
