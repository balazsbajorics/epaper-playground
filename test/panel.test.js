import test from 'node:test';
import assert from 'node:assert/strict';
import {EpaperPanel, createEpaperDisplay} from '../src/index.js';

function fixture() {
  const panel = new EpaperPanel({width: 8, height: 1, partialMs: 100, fullMs: 1000});
  panel.submit(Uint8Array.of(255), true, 0);
  panel.tick(1000);
  return panel;
}
test('full erase has inversion, black/white phases, then a clean target', () => {
  const p = fixture();
  p.submit(Uint8Array.of(0), true, 1000);
  assert.equal(p.pixels[0], 1);
  assert.equal(p.tick(1200)[0], 0);
  assert.equal(p.tick(1400)[0], 0);
  assert.equal(p.tick(1650)[0], 1);
  assert.equal(p.tick(2000)[0], 0);
  assert.equal(p.state.mode, 'idle');
});
test('partial draws settle gradually and retain old ink until a full erase', () => {
  const p = fixture();
  p.submit(Uint8Array.of(127), false, 1000);
  const middle = p.tick(1050)[0];
  assert.ok(middle > 0 && middle < 1);
  p.tick(1100);
  assert.ok(p.pixels[0] > 0 && p.pixels[0] < 0.2);
  p.submit(Uint8Array.of(255), false, 1100);
  p.tick(1200);
  assert.ok(p.pixels[0] > 0.8 && p.pixels[0] < 1);
  const ghost = p.pixels[0];
  p.tick(9000);
  assert.equal(p.pixels[0], ghost);
  p.refresh(9000);
  p.tick(10000);
  assert.equal(p.pixels[0], 1);
  assert.equal(p.ghost[0], 0);
  assert.equal(p.partials, 0);
});
test('panel automatically cleans after five completed partial draws', () => {
  const p = fixture();
  let now = 1000;
  for (let i = 0; i < 5; i++) {
    p.submit(Uint8Array.of(i % 2 ? 255 : 127), false, now);
    assert.equal(p.state.mode, 'partial');
    now += 100;
    p.tick(now);
  }
  assert.equal(p.partials, 5);
  p.submit(Uint8Array.of(63), false, now);
  assert.equal(p.state.mode, 'full');
  p.tick(now + 1000);
  assert.equal(p.partials, 0);
  assert.equal(p.pixels[0], 0);
});
test('busy panel coalesces to the newest frame and retains a skipped full-refresh request', () => {
  const p = fixture();
  p.submit(Uint8Array.of(127), false, 1000);
  p.submit(Uint8Array.of(0), true, 1020);
  p.submit(Uint8Array.of(255), false, 1040);
  assert.equal(p.pending.full, true);
  p.tick(1100);
  assert.equal(p.state.mode, 'full');
  assert.equal(p.state.queued, false);
  p.tick(2100);
  assert.deepEqual([...p.pixels], Array(8).fill(1));
});
test('instant mode cancels stale animations and shows the latest frame; reset clears old sessions', () => {
  const p = fixture();
  p.submit(Uint8Array.of(127), false, 1000);
  p.submit(Uint8Array.of(0), false, 1020);
  p.setEnabled(false, 1040);
  assert.equal(p.active, null);
  assert.equal(p.pending, null);
  assert.deepEqual([...p.pixels], Array(8).fill(0));
  p.tick(9999);
  assert.equal(p.pixels[0], 0);
  p.setEnabled(true, 10000);
  assert.equal(p.state.mode, 'full');
  p.reset();
  assert.equal(p.state.mode, 'idle');
  assert.equal(p.latest, null);
  assert.deepEqual([...p.pixels], Array(8).fill(1));
});
test('duplicate frames neither build ghosting nor extend the refresh queue', () => {
  const p = fixture();
  assert.equal(p.submit(Uint8Array.of(255), false, 1000), false);
  assert.equal(p.partials, 0);
  assert.equal(p.state.mode, 'idle');
  assert.equal(p.submit(Uint8Array.of(1, 2), false, 1000), false);
});
test('a full-refresh signal cleans an unchanged bitmap and promotes pending partials', () => {
  const p = fixture();
  p.submit(Uint8Array.of(127), false, 1000);
  p.tick(1100);
  p.submit(Uint8Array.of(255), false, 1100);
  p.tick(1200);
  assert.ok(p.pixels[0] < 1);
  assert.equal(p.submit(Uint8Array.of(255), true, 1200), true);
  assert.equal(p.state.mode, 'full');
  p.submit(Uint8Array.of(127), false, 1220);
  p.submit(Uint8Array.of(127), true, 1240);
  assert.equal(p.pending.full, true);
  p.tick(2200);
  assert.equal(p.state.mode, 'full');
  p.tick(3200);
  assert.equal(p.pixels[0], 0);
  assert.equal(p.ghost[0], 0);
});
test('canvas adapter eventually paints rapid instant updates and mode changes inside its frame throttle', () => {
  let now = 0,
    id = 0,
    last;
  const callbacks = new Map();
  const canvas = {
    getContext() {
      return {
        createImageData(w, h) {
          return {data: new Uint8ClampedArray(w * h * 4)};
        },
        putImageData(image) {
          last = image.data.slice();
        },
      };
    },
  };
  const display = createEpaperDisplay(canvas, {
    width: 8,
    height: 1,
    enabled: false,
    clock: () => now,
    requestFrame: (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    cancelFrame: (key) => callbacks.delete(key),
  });
  const step = (time) => {
    now = time;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(now);
  };
  display.submit({pixels: 'AA==', full: false});
  step(0);
  assert.equal(last[0], 27);
  now = 1;
  display.submit({pixels: '/w==', full: false});
  step(1);
  assert.ok(callbacks.size > 0);
  step(33);
  assert.equal(last[0], 243);
  assert.equal(callbacks.size, 0);
  now = 34;
  display.setEnabled(true);
  display.submit({pixels: 'AA==', full: false});
  display.setEnabled(false);
  step(34);
  assert.ok(callbacks.size > 0);
  step(66);
  assert.equal(last[0], 27);
  assert.equal(callbacks.size, 0);
});
test('duplicate arrivals that finish a draw between paints still publish the final pixels and state', () => {
  let now = 0,
    id = 0,
    visible;
  const callbacks = new Map();
  const canvas = {
    getContext() {
      return {
        createImageData(w, h) {
          return {data: new Uint8ClampedArray(w * h * 4)};
        },
        putImageData() {},
      };
    },
  };
  const display = createEpaperDisplay(canvas, {
    width: 8,
    height: 1,
    clock: () => now,
    onState: (state) => (visible = state.mode),
    requestFrame: (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    cancelFrame: (key) => callbacks.delete(key),
  });
  const step = (time) => {
    now = time;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(now);
  };
  display.submit({pixels: 'AA==', full: true});
  step(0);
  step(1792);
  assert.equal(visible, 'full');
  now = 1800;
  display.submit({pixels: 'AA==', full: false});
  step(1808);
  assert.ok(callbacks.size > 0);
  step(1824);
  assert.equal(visible, 'idle');
  assert.equal(callbacks.size, 0);
});
test('spatially uneven pigment activation catches up to a uniform target without idle flicker', () => {
  const p = new EpaperPanel({width: 64, height: 64}),
    white = new Uint8Array(512).fill(255),
    black = new Uint8Array(512);
  p.submit(white, true, 0);
  p.tick(1800);
  p.submit(black, false, 1800);
  const middle = [...p.tick(2025)],
    mean = middle.reduce((a, b) => a + b) / middle.length,
    spread = Math.sqrt(middle.reduce((sum, value) => sum + (value - mean) ** 2, 0) / middle.length);
  assert.ok(spread > 0.08, 'visible mottling during pigment travel');
  assert.ok(Math.max(...middle) - Math.min(...middle) > 0.4);
  p.tick(2250);
  assert.ok(Math.max(...p.pixels) - Math.min(...p.pixels) < 1e-6, 'pixels catch up by completion');
  const final = p.pixels.slice();
  p.tick(10000);
  assert.deepEqual(p.pixels, final);
});
test('material response patterns are repeatable, spatially correlated and seed-specific', () => {
  const a = new EpaperPanel({width: 64, height: 64}),
    b = new EpaperPanel({width: 64, height: 64}),
    c = new EpaperPanel({width: 64, height: 64, seed: 17});
  assert.deepEqual(a.onset, b.onset);
  assert.deepEqual(a.surface, b.surface);
  assert.notDeepEqual(a.onset, c.onset);
  let near = 0,
    far = 0;
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 32; x++) {
      const i = y * 64 + x;
      near += Math.abs(a.surface[i] - a.surface[i + 1]);
      far += Math.abs(a.surface[i] - a.surface[i + 32]);
    }
  assert.ok(near < far, 'fine grain sits on larger stable patches');
});
test('high-density canvas leaves subtle stable grain in settled ink and paper, with exact raw mode', () => {
  let now = 0,
    id = 0,
    last;
  const callbacks = new Map(),
    canvas = {
      getContext() {
        return {
          createImageData(w, h) {
            return {data: new Uint8ClampedArray(w * h * 4)};
          },
          putImageData(image) {
            last = image.data.slice();
          },
        };
      },
    };
  const display = createEpaperDisplay(canvas, {
    width: 32,
    height: 32,
    clock: () => now,
    requestFrame: (callback) => {
      callbacks.set(++id, callback);
      return id;
    },
    cancelFrame: (key) => callbacks.delete(key),
  });
  const step = (time) => {
    now = time;
    const pending = [...callbacks.values()];
    callbacks.clear();
    for (const callback of pending) callback(now);
  };
  const reds = () => Array.from(last).filter((_, i) => i % 4 === 0),
    black = {pixels: Buffer.alloc(128).toString('base64'), full: true},
    white = {pixels: Buffer.alloc(128, 255).toString('base64'), full: true};
  display.submit(black);
  step(0);
  step(1800);
  assert.equal(canvas.width, 64);
  assert.equal(canvas.height, 64);
  const dark = reds();
  assert.ok(Math.max(...dark) - Math.min(...dark) >= 4);
  assert.ok(Math.min(...dark) >= 22 && Math.max(...dark) <= 36);
  const settled = last.slice();
  display.submit({...black, full: false});
  step(1900);
  assert.deepEqual(last, settled, 'no animated static');
  now = 2000;
  display.submit(white);
  step(3800);
  const light = reds();
  assert.ok(Math.max(...light) - Math.min(...light) >= 3);
  assert.ok(Math.min(...light) >= 234 && Math.max(...light) <= 248);
  assert.ok(Math.min(...light) - Math.max(...dark) > 190, 'text contrast retained');
  display.setEnabled(false);
  step(3900);
  assert.deepEqual(new Set(reds()), new Set([243]));
  now = 4000;
  display.submit(black);
  step(4032);
  assert.deepEqual(new Set(reds()), new Set([27]));
});
