// A small seeded random source (mulberry32) so a run started from one seed
// plays out the same way every time: the staged screenshots rely on it, and
// two runs of the entry hand in the same bytes.
export function makeRng(seed) {
  let state = seed >>> 0 || 0x9e3779b9;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** An integer in [min, max]. */
export function intRange(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** One element of `items`, uniformly. */
export function pick(rng, items) {
  return items[Math.floor(rng() * items.length)];
}

/** True with probability `p`. */
export function chance(rng, p) {
  return rng() < p;
}

/** One element of weighted [item, weight] pairs. */
export function weightedPick(rng, pairs) {
  let total = 0;
  for (const [, weight] of pairs) total += weight;
  let roll = rng() * total;
  for (const [item, weight] of pairs) {
    roll -= weight;
    if (roll <= 0) return item;
  }
  return pairs[pairs.length - 1][0];
}

/** A point on the border ring of the field, for spawning wisps at the edges. */
export function borderPoint(rng, width, height, margin) {
  const side = intRange(rng, 0, 3);
  if (side === 0) return { x: range(rng, margin, width - margin), y: margin };
  if (side === 1) return { x: range(rng, margin, width - margin), y: height - margin };
  if (side === 2) return { x: margin, y: range(rng, margin, height - margin) };
  return { x: width - margin, y: range(rng, margin, height - margin) };
}
