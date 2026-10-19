// Bitmap fonts in BDF, the format firmware font engines (u8g2, Adafruit GFX converters,
// Pebble's resource pipeline) are generated from. Glyphs are drawn pixel for pixel, so what
// the simulator shows is what the device renders: no antialiasing, no browser hinting.

// Parse BDF text into a font: {name, size, ascent, descent, height, glyphs: Map<codepoint, glyph>}.
// A glyph is {width (advance), bbw, bbh, bbx, bby, rows: Uint8Array[] (one packed row each)}.
export function parseBdf(text) {
  const lines = text.split(/\r?\n/),
    font = {name: '', size: 0, ascent: 0, descent: 0, height: 0, glyphs: new Map()};
  let glyph = null,
    code = -1,
    bitmap = null;
  for (const line of lines) {
    const [key, ...rest] = line.split(/\s+/);
    if (bitmap) {
      if (key === 'ENDCHAR') {
        glyph.rows = bitmap;
        if (code >= 0) font.glyphs.set(code, glyph);
        bitmap = glyph = null;
        code = -1;
      } else bitmap.push(Uint8Array.from(line.match(/../g) || [], (hex) => parseInt(hex, 16)));
      continue;
    }
    switch (key) {
      case 'FONT':
        font.name = rest.join(' ');
        break;
      case 'SIZE':
        font.size = Number(rest[0]);
        break;
      case 'FONTBOUNDINGBOX':
        font.height ||= Number(rest[1]);
        break;
      case 'FONT_ASCENT':
        font.ascent = Number(rest[0]);
        break;
      case 'FONT_DESCENT':
        font.descent = Number(rest[0]);
        break;
      case 'STARTCHAR':
        glyph = {width: 0, bbw: 0, bbh: 0, bbx: 0, bby: 0, rows: []};
        break;
      case 'ENCODING':
        code = Number(rest[0]);
        break;
      case 'DWIDTH':
        glyph.width = Number(rest[0]);
        break;
      case 'BBX':
        [glyph.bbw, glyph.bbh, glyph.bbx, glyph.bby] = rest.map(Number);
        break;
      case 'BITMAP':
        bitmap = [];
        break;
    }
  }
  if (font.ascent || font.descent) font.height = font.ascent + font.descent;
  font.fallback = font.glyphs.get(0xfffd) || font.glyphs.get(63) || font.glyphs.get(32);
  return font;
}

// Fetch and parse a BDF file in the browser.
export async function loadBdf(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}: ${response.status}`);
  return parseBdf(await response.text());
}

export function glyphFor(font, codepoint) {
  return font.glyphs.get(codepoint) || font.fallback;
}

// Width in pixels of a string (advance widths; kerning does not exist in bitmap fonts).
export function measureText(font, text) {
  let width = 0;
  for (const char of text) width += glyphFor(font, char.codePointAt(0))?.width ?? 0;
  return width;
}

// Visit every ink pixel of `text` laid out with its top-left corner at (x, y).
// The line box is font.height tall; the baseline sits at y + font.ascent.
export function eachPixel(font, text, x, y, visit) {
  const baseline = y + font.ascent;
  let pen = x;
  for (const char of text) {
    const g = glyphFor(font, char.codePointAt(0));
    if (!g) continue;
    const top = baseline - g.bby - g.bbh,
      left = pen + g.bbx;
    for (let row = 0; row < g.bbh; row++) {
      const bits = g.rows[row];
      if (!bits) continue;
      for (let col = 0; col < g.bbw; col++)
        if ((bits[col >> 3] >> (7 - (col & 7))) & 1) visit(left + col, top + row);
    }
    pen += g.width;
  }
  return pen - x;
}

// Draw onto a 2D canvas context with the current fillStyle, one fillRect per pixel run.
// Returns the advance in pixels. x and y are the top-left of the line box.
export function drawText(ctx, font, text, x, y) {
  x = Math.round(x);
  y = Math.round(y);
  let runStart = -1,
    runY = -1;
  const flush = (end) => {
    if (runStart >= 0) ctx.fillRect(runStart, runY, end - runStart, 1);
    runStart = -1;
  };
  let lastX = -2;
  const advance = eachPixel(font, text, x, y, (px, py) => {
    if (py !== runY || px !== lastX + 1) {
      flush(lastX + 1);
      runStart = px;
      runY = py;
    }
    lastX = px;
  });
  flush(lastX + 1);
  return advance;
}

// Draw into a packed 1-bit bitmap (see bitmap.js); `white` inverts the ink.
export function drawTextBitmap(bitmap, width, height, font, text, x, y, white = false) {
  return eachPixel(font, text, Math.round(x), Math.round(y), (px, py) => {
    if (px < 0 || py < 0 || px >= width || py >= height) return;
    const i = py * width + px,
      mask = 1 << (7 - (i & 7));
    if (white) bitmap[i >> 3] |= mask;
    else bitmap[i >> 3] &= ~mask;
  });
}

// Word-wrap `text` to `maxWidth` pixels. Returns the lines.
export function wrapText(font, text, maxWidth) {
  const lines = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (line && measureText(font, candidate) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

// Serialize a font back to BDF, keeping only the glyphs that `keep(codepoint)` accepts.
export function toBdf(font, keep = () => true) {
  const out = [
    'STARTFONT 2.1',
    `FONT ${font.name}`,
    `SIZE ${font.size} 75 75`,
    `FONTBOUNDINGBOX ${Math.max(...[...font.glyphs.values()].map((g) => g.width))} ${font.height} 0 ${-font.descent}`,
    'STARTPROPERTIES 2',
    `FONT_ASCENT ${font.ascent}`,
    `FONT_DESCENT ${font.descent}`,
    'ENDPROPERTIES',
  ];
  const glyphs = [...font.glyphs].filter(([code]) => keep(code));
  out.push(`CHARS ${glyphs.length}`);
  for (const [code, g] of glyphs) {
    out.push(`STARTCHAR U+${code.toString(16).toUpperCase().padStart(4, '0')}`);
    out.push(`ENCODING ${code}`);
    out.push(`SWIDTH ${g.width * 72} 0`);
    out.push(`DWIDTH ${g.width} 0`);
    out.push(`BBX ${g.bbw} ${g.bbh} ${g.bbx} ${g.bby}`);
    out.push('BITMAP');
    for (const row of g.rows)
      out.push([...row].map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(''));
    out.push('ENDCHAR');
  }
  out.push('ENDFONT');
  return out.join('\n') + '\n';
}
