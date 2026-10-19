// Common monochrome panels. Timings are visual approximations of typical
// controller waveforms, not measurements of a specific module. Override any
// field when constructing a panel: `new EpaperPanel({...PRESETS['4.2'], fullMs: 2500})`.
export const PRESETS = {
  // 1.54" 200 x 200 (GDEH0154D67, Waveshare 1.54" V2)
  1.54: {width: 200, height: 200, partialMs: 400, fullMs: 1600, fullEvery: 5},
  // 2.13" 250 x 122 (GDEM0213B74, Waveshare 2.13" V4), landscape
  2.13: {width: 250, height: 122, partialMs: 400, fullMs: 1600, fullEvery: 5},
  // 2.9" 296 x 128 (GDEM029T94, Waveshare 2.9" V2), landscape
  2.9: {width: 296, height: 128, partialMs: 400, fullMs: 1600, fullEvery: 5},
  // 3.1" 240 x 320 (GDEQ031T10, LilyGO T-Deck MAX), portrait
  3.1: {width: 240, height: 320, partialMs: 450, fullMs: 1800, fullEvery: 5},
  // 3.7" 480 x 280 (ED037TC1, Waveshare 3.7"), landscape
  3.7: {width: 480, height: 280, partialMs: 500, fullMs: 2000, fullEvery: 5},
  // 4.2" 400 x 300 (GDEY042T81, Waveshare 4.2" V2), landscape
  4.2: {width: 400, height: 300, partialMs: 500, fullMs: 2200, fullEvery: 5},
  // 5.83" 648 x 480 (Waveshare 5.83" V2), landscape
  5.83: {width: 648, height: 480, partialMs: 600, fullMs: 2800, fullEvery: 5},
  // 7.5" 800 x 480 (GDEY075T7, Waveshare 7.5" V2), landscape
  7.5: {width: 800, height: 480, partialMs: 700, fullMs: 3500, fullEvery: 5},
};

export function preset(name) {
  const found = PRESETS[name];
  if (!found)
    throw new RangeError(
      `Unknown panel preset "${name}". Known: ${Object.keys(PRESETS).join(', ')}`,
    );
  return {...found};
}
