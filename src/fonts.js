import {loadBdf, parseBdf} from './bdf.js';

// The bundled bitmap fonts (fonts/*.bdf), trimmed to Latin, punctuation, arrows, box
// drawing and symbols. `height` is the line box in pixels; `cell` the advance of a
// monospace glyph. Pick by height: 12 to 16 px for body text, 24 px and up for a clock.
export const FONTS = {
  // Terminus (OFL 1.1): the clearest small terminal face; regular and bold at nine sizes.
  'terminus-12': {file: 'terminus-12.bdf', height: 12, cell: 6, bold: false, family: 'Terminus'},
  'terminus-12-bold': {
    file: 'terminus-12-bold.bdf',
    height: 12,
    cell: 6,
    bold: true,
    family: 'Terminus',
  },
  'terminus-14': {file: 'terminus-14.bdf', height: 14, cell: 8, bold: false, family: 'Terminus'},
  'terminus-14-bold': {
    file: 'terminus-14-bold.bdf',
    height: 14,
    cell: 8,
    bold: true,
    family: 'Terminus',
  },
  'terminus-16': {file: 'terminus-16.bdf', height: 16, cell: 8, bold: false, family: 'Terminus'},
  'terminus-16-bold': {
    file: 'terminus-16-bold.bdf',
    height: 16,
    cell: 8,
    bold: true,
    family: 'Terminus',
  },
  'terminus-18': {file: 'terminus-18.bdf', height: 18, cell: 10, bold: false, family: 'Terminus'},
  'terminus-18-bold': {
    file: 'terminus-18-bold.bdf',
    height: 18,
    cell: 10,
    bold: true,
    family: 'Terminus',
  },
  'terminus-20': {file: 'terminus-20.bdf', height: 20, cell: 10, bold: false, family: 'Terminus'},
  'terminus-20-bold': {
    file: 'terminus-20-bold.bdf',
    height: 20,
    cell: 10,
    bold: true,
    family: 'Terminus',
  },
  'terminus-22': {file: 'terminus-22.bdf', height: 22, cell: 11, bold: false, family: 'Terminus'},
  'terminus-22-bold': {
    file: 'terminus-22-bold.bdf',
    height: 22,
    cell: 11,
    bold: true,
    family: 'Terminus',
  },
  'terminus-24': {file: 'terminus-24.bdf', height: 24, cell: 12, bold: false, family: 'Terminus'},
  'terminus-24-bold': {
    file: 'terminus-24-bold.bdf',
    height: 24,
    cell: 12,
    bold: true,
    family: 'Terminus',
  },
  'terminus-28': {file: 'terminus-28.bdf', height: 28, cell: 14, bold: false, family: 'Terminus'},
  'terminus-28-bold': {
    file: 'terminus-28-bold.bdf',
    height: 28,
    cell: 14,
    bold: true,
    family: 'Terminus',
  },
  'terminus-32': {file: 'terminus-32.bdf', height: 32, cell: 16, bold: false, family: 'Terminus'},
  'terminus-32-bold': {
    file: 'terminus-32-bold.bdf',
    height: 32,
    cell: 16,
    bold: true,
    family: 'Terminus',
  },
  // Spleen (BSD 2-clause): a tight, modern monospace family from 5 x 8 up to 32 x 64.
  'spleen-5x8': {file: 'spleen-5x8.bdf', height: 8, cell: 5, bold: false, family: 'Spleen'},
  'spleen-6x12': {file: 'spleen-6x12.bdf', height: 12, cell: 6, bold: false, family: 'Spleen'},
  'spleen-8x16': {file: 'spleen-8x16.bdf', height: 16, cell: 8, bold: false, family: 'Spleen'},
  'spleen-12x24': {file: 'spleen-12x24.bdf', height: 24, cell: 12, bold: false, family: 'Spleen'},
  'spleen-16x32': {file: 'spleen-16x32.bdf', height: 32, cell: 16, bold: false, family: 'Spleen'},
  'spleen-32x64': {file: 'spleen-32x64.bdf', height: 64, cell: 32, bold: false, family: 'Spleen'},
  // Cozette (MIT): a friendly 13 px monospace with a doubled 26 px version.
  'cozette-13': {file: 'cozette-13.bdf', height: 13, cell: 6, bold: false, family: 'Cozette'},
  'cozette-26': {file: 'cozette-26.bdf', height: 26, cell: 12, bold: false, family: 'Cozette'},
};

const cache = new Map();

// Load bundled fonts by id. `base` is the URL of the fonts/ directory (default: the
// package's own). Returns an object mapping id → parsed font, cached across calls.
export async function loadFonts(
  ids = Object.keys(FONTS),
  base = new URL('../fonts/', import.meta.url),
) {
  const root = String(base).endsWith('/') ? String(base) : `${base}/`,
    loaded = {};
  await Promise.all(
    ids.map(async (id) => {
      const entry = FONTS[id];
      if (!entry)
        throw new RangeError(`Unknown font "${id}". Known: ${Object.keys(FONTS).join(', ')}`);
      if (!cache.has(id)) cache.set(id, loadBdf(`${root}${entry.file}`));
      loaded[id] = await cache.get(id);
    }),
  );
  return loaded;
}

// Node: read the bundled fonts from disk instead of fetching.
export async function loadFontsFromDisk(
  ids = Object.keys(FONTS),
  directory = new URL('../fonts/', import.meta.url),
) {
  const {readFile} = await import('node:fs/promises'),
    loaded = {};
  for (const id of ids) {
    const entry = FONTS[id];
    if (!entry) throw new RangeError(`Unknown font "${id}"`);
    loaded[id] = parseBdf(await readFile(new URL(entry.file, directory), 'utf8'));
  }
  return loaded;
}
