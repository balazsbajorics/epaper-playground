// Trim upstream BDF fonts to the glyph ranges the playground ships: Latin, Latin-1 and
// Latin Extended-A, general punctuation, currency, arrows, box drawing, blocks, geometric
// shapes and a few symbols. Usage: node tools/trim-bdf.js <in.bdf> <out.bdf>
import {readFileSync, writeFileSync} from 'node:fs';
import {parseBdf, toBdf} from '../src/bdf.js';

const RANGES = [
  [0x20, 0x17f],
  [0x2010, 0x2027],
  [0x2030, 0x203a],
  [0x20ac, 0x20ac],
  [0x2122, 0x2122],
  [0x2190, 0x21ff],
  [0x2200, 0x22ff],
  [0x2500, 0x25ff],
  [0x2600, 0x2606],
  [0x2610, 0x2612],
  [0x2660, 0x2667],
  [0x2713, 0x2718],
  [0xfffd, 0xfffd],
];
const keep = (code) => RANGES.some(([lo, hi]) => code >= lo && code <= hi);
const [input, output] = process.argv.slice(2);
const font = parseBdf(readFileSync(input, 'utf8'));
writeFileSync(output, toBdf(font, keep));
console.log(
  `${output}: ${[...font.glyphs.keys()].filter(keep).length} of ${font.glyphs.size} glyphs`,
);
