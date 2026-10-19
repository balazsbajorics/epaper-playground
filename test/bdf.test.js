import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  parseBdf,
  toBdf,
  measureText,
  drawText,
  drawTextBitmap,
  wrapText,
  createBitmap,
  getPixel,
  FONTS,
  loadFontsFromDisk,
  EpaperPanel,
} from '../src/index.js';

const TINY = `STARTFONT 2.1
FONT tiny
SIZE 4 75 75
FONTBOUNDINGBOX 4 4 0 -1
STARTPROPERTIES 2
FONT_ASCENT 3
FONT_DESCENT 1
ENDPROPERTIES
CHARS 2
STARTCHAR I
ENCODING 73
SWIDTH 0 0
DWIDTH 2 0
BBX 1 3 0 0
BITMAP
80
80
80
ENDCHAR
STARTCHAR g
ENCODING 103
SWIDTH 0 0
DWIDTH 3 0
BBX 2 3 0 -1
BITMAP
C0
40
C0
ENDCHAR
ENDFONT
`;

test('parses metrics and glyph bitmaps', () => {
  const font = parseBdf(TINY);
  assert.equal(font.height, 4);
  assert.equal(font.ascent, 3);
  assert.equal(font.glyphs.size, 2);
  assert.equal(measureText(font, 'Ig'), 5);
  assert.equal(measureText(font, 'I?g'), 5, 'unknown glyphs fall back to ? or space');
});

test('draws glyphs at the baseline with descenders below it, into bitmaps and contexts', () => {
  const font = parseBdf(TINY),
    bitmap = createBitmap(8, 4);
  drawTextBitmap(bitmap, 8, 4, font, 'Ig', 0, 0);
  const ink = [];
  for (let y = 0; y < 4; y++) {
    let row = '';
    for (let x = 0; x < 8; x++) row += getPixel(bitmap, 8, x, y) ? '.' : '#';
    ink.push(row);
  }
  assert.deepEqual(ink, ['#.......', '#.##....', '#..#....', '..##....']);
  const rects = [];
  const advance = drawText({fillRect: (...r) => rects.push(r)}, font, 'Ig', 10.4, 2.6);
  assert.equal(advance, 5);
  assert.deepEqual(rects[0], [10, 3, 1, 1]);
  assert.ok(rects.every(([, , w, h]) => h === 1 && w >= 1));
});

test('wraps words to a pixel width', () => {
  const font = parseBdf(TINY);
  assert.deepEqual(wrapText(font, 'II II II', 9), ['II II', 'II']);
});

test('round-trips through toBdf', () => {
  const font = parseBdf(toBdf(parseBdf(TINY), (code) => code === 73));
  assert.equal(font.glyphs.size, 1);
  assert.deepEqual([...font.glyphs.get(73).rows[0]], [0x80]);
});

test('every bundled font loads, matches its catalog height and has ASCII glyphs', async () => {
  const fonts = await loadFontsFromDisk();
  for (const [id, entry] of Object.entries(FONTS)) {
    const font = fonts[id];
    assert.equal(font.height, entry.height, id);
    for (let code = 32; code < 127; code++)
      assert.ok(font.glyphs.has(code), `${id} U+${code.toString(16)}`);
    assert.equal(measureText(font, 'M'), entry.cell, `${id} cell`);
    assert.ok(font.glyphs.has(0xe9) && font.glyphs.has(0x2500), `${id} extras`);
  }
});

test('text drawn into a bitmap shows up on the panel', async () => {
  const {['terminus-16']: font} = await loadFontsFromDisk(['terminus-16']),
    bitmap = createBitmap(64, 16);
  drawTextBitmap(bitmap, 64, 16, font, 'Hi', 0, 0);
  const panel = new EpaperPanel({width: 64, height: 16, enabled: false});
  panel.submit(bitmap, true, 0);
  const ink = panel.pixels.reduce((n, v) => n + (v === 0 ? 1 : 0), 0);
  assert.ok(ink > 10 && ink < 100);
});
