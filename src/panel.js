import {noise, cloud} from './noise.js';
import {bitmapLength} from './bitmap.js';

// The physical model of a monochrome e-paper panel. It has no DOM dependency and
// runs anywhere (browser, worker, Node). Time is explicit: every mutating call takes
// `now` in milliseconds, and `tick(now)` advances the simulation and returns the
// per-pixel brightness (0 = ink, 1 = paper) the panel currently shows.
//
// What it models (a visual approximation, not a measured waveform):
// - Partial refresh: pixels that change travel to their new value over `partialMs`.
//   Pixels that do not change are left alone. Each partial leaves a faint ghost of
//   the previous ink, which accumulates until a full refresh.
// - Full refresh: the whole panel inverts, flashes black, flashes white, then draws
//   the target, over `fullMs`. Ghosting is cleared.
// - Automatic full refresh after `fullEvery` consecutive partials (controllers and
//   firmware usually enforce this).
// - Coalescing: a frame submitted while the panel is busy waits; newer frames
//   replace it, and a requested full refresh is not forgotten.
// - Material texture: stationary per-pixel activation and settling times, so a
//   transition mottles and then catches up rather than fading uniformly.
export class EpaperPanel {
  constructor({
    width = 240,
    height = 320,
    partialMs = 450,
    fullMs = 1800,
    fullEvery = 5,
    enabled = true,
    seed = 0x54444543,
  } = {}) {
    Object.assign(this, {width, height, partialMs, fullMs, fullEvery, enabled, seed});
    const count = width * height;
    this.pixels = new Float32Array(count).fill(1);
    this.ghost = new Float32Array(count);
    this.onset = new Float32Array(count);
    this.finish = new Float32Array(count);
    this.surface = new Float32Array(count);
    for (let y = 0; y < height; y++)
      for (let x = 0; x < width; x++) {
        const i = y * width + x,
          patch = 0.65 * cloud(x, y, 9, seed) + 0.35 * cloud(x, y, 31, seed + 1),
          grain = noise(x, y, seed + 2);
        this.onset[i] = 0.025 + 0.34 * (0.55 * grain + 0.45 * patch);
        this.finish[i] = 0.68 + 0.3 * (0.45 * noise(x, y, seed + 3) + 0.55 * patch);
        this.surface[i] = (0.7 * cloud(x, y, 18, seed + 4) + 0.3 * grain - 0.5) * 2;
      }
    this.latest = null; // the newest bitmap submitted, unpacked
    this.drawn = null; // the bitmap the panel last finished drawing
    this.active = null; // the transition in progress
    this.pending = null; // a frame waiting for the active transition
    this.partials = 0; // partials since the last full refresh
  }

  get bitmapLength() {
    return bitmapLength(this.width, this.height);
  }

  // Submit a packed 1-bit bitmap (see bitmap.js). Returns false when the bitmap has the
  // wrong size, or when it equals the previous frame and no full refresh was requested.
  submit(bytes, full = false, now = 0) {
    if (bytes.length !== this.bitmapLength) return false;
    this.tick(now);
    const target = Float32Array.from(this.pixels, (_, i) => (bytes[i >> 3] >> (7 - (i & 7))) & 1);
    if (!full && this.latest && target.every((value, i) => value === this.latest[i])) return false;
    this.latest = target;
    this.enqueue(target, full || !this.drawn, now);
    return true;
  }

  enqueue(target, full, now) {
    if (!this.enabled) {
      this.pixels.set(target);
      this.ghost.fill(0);
      this.drawn = target;
      return;
    }
    if (this.active) {
      this.pending = {target, full: full || !!this.pending?.full};
      return;
    }
    full = full || this.partials >= this.fullEvery;
    const from = this.pixels.slice(),
      to = target.slice();
    for (let i = 0; i < to.length; i++) {
      if (full) this.ghost[i] = 0;
      else if (target[i] !== this.drawn[i])
        this.ghost[i] = Math.max(
          -0.25,
          Math.min(0.25, this.ghost[i] * 0.78 + (this.drawn[i] - target[i]) * 0.15),
        );
      to[i] = Math.max(0, Math.min(1, target[i] + this.ghost[i]));
    }
    this.active = {
      from,
      to,
      target,
      full,
      start: now,
      duration: full ? this.fullMs : this.partialMs,
    };
  }

  // Advance to `now` and return the brightness of every pixel.
  tick(now) {
    const a = this.active;
    if (!a) return this.pixels;
    const progress = Math.max(0, Math.min(1, (now - a.start) / a.duration));
    const smooth = (t) => t * t * (3 - 2 * t);
    for (let i = 0; i < this.pixels.length; i++) {
      let from = a.from[i],
        to = a.to[i],
        t = progress;
      if (a.full) {
        // Slow inversion, black erase, white erase, then the clean target.
        if (progress < 0.2) {
          to = 1 - a.from[i];
          t = progress / 0.2;
        } else if (progress < 0.4) {
          from = 1 - a.from[i];
          to = 0;
          t = (progress - 0.2) / 0.2;
        } else if (progress < 0.65) {
          from = 0;
          to = 1;
          t = (progress - 0.4) / 0.25;
        } else {
          from = 1;
          t = (progress - 0.65) / 0.35;
        }
      }
      // Warp each phase through a local activation/settling window. Every pixel reaches
      // its endpoint, so the early speckling catches up rather than fizzing.
      t = Math.max(0, Math.min(1, (t - this.onset[i]) / (this.finish[i] - this.onset[i])));
      this.pixels[i] = from + (to - from) * smooth(t);
    }
    if (progress === 1) {
      this.drawn = a.target;
      this.partials = a.full ? 0 : this.partials + 1;
      this.active = null;
      const pending = this.pending;
      this.pending = null;
      if (pending) this.enqueue(pending.target, pending.full, now);
    }
    return this.pixels;
  }

  // Force a full refresh of the latest frame (what a "clean screen" command does).
  refresh(now = 0) {
    if (this.latest) {
      this.tick(now);
      this.enqueue(this.latest, true, now);
    }
  }

  // Disabled, the panel shows every frame instantly and exactly (a plain bitmap preview).
  setEnabled(enabled, now = 0) {
    if (enabled === this.enabled) return;
    this.enabled = enabled;
    this.active = null;
    this.pending = null;
    this.ghost.fill(0);
    this.partials = 0;
    if (this.latest) this.enqueue(this.latest, enabled, now);
  }

  reset() {
    this.active = null;
    this.pending = null;
    this.latest = null;
    this.drawn = null;
    this.partials = 0;
    this.ghost.fill(0);
    this.pixels.fill(1);
  }

  get busy() {
    return this.active !== null;
  }

  get state() {
    return {
      mode: this.active ? (this.active.full ? 'full' : 'partial') : 'idle',
      partials: this.partials,
      queued: !!this.pending,
      enabled: this.enabled,
    };
  }
}
