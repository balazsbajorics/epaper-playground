// Deterministic hash noise and smooth "cloud" noise. The panel uses these to build
// stationary material fields (where pigment moves early or late, where paper and ink
// are a touch lighter or darker). Same seed, same panel: no per-frame randomness.
export function noise(x, y, seed) {
  let value = Math.imul(x ^ seed, 0x45d9f3b) ^ Math.imul(y, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x7feb352d);
  value = Math.imul(value ^ (value >>> 15), 0x846ca68b);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

export function cloud(x, y, size, seed) {
  x /= size;
  y /= size;
  const left = Math.floor(x),
    top = Math.floor(y);
  const smooth = (t) => t * t * (3 - 2 * t),
    u = smooth(x - left),
    v = smooth(y - top);
  const a = noise(left, top, seed),
    b = noise(left + 1, top, seed),
    c = noise(left, top + 1, seed),
    d = noise(left + 1, top + 1, seed);
  return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
}
