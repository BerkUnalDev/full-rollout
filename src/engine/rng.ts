// src/engine/rng.ts
// mulberry32 PRNG. The entire generator state is one 32-bit int, so it can
// live inside GameState and make every resolution reproducible.
export class Rng {
  state: number;
  constructor(state: number) {
    this.state = state | 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick: empty array');
    return arr[this.int(0, arr.length - 1)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Sample a count with the given expected value (floor + fractional chance). */
  count(expected: number): number {
    const base = Math.floor(expected);
    return base + (this.chance(expected - base) ? 1 : 0);
  }

  /** Noise in [-amp, +amp); uniform, zero-mean. */
  noise(amp: number): number {
    return (this.next() * 2 - 1) * amp;
  }
}
