// src/engine/__tests__/rng.test.ts
import { Rng } from '../rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42), b = new Rng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1), b = new Rng(2);
    expect([a.next(), a.next()]).not.toEqual([b.next(), b.next()]);
  });

  it('next() stays in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min, max) is inclusive on both ends and covers the range', () => {
    const r = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('pick returns elements of the array', () => {
    const r = new Rng(5);
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });

  it('chance(0) is never true, chance(1) always true', () => {
    const r = new Rng(9);
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it('count(expected) returns floor or floor+1, averaging near expected', () => {
    const r = new Rng(11);
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const c = r.count(0.3);
      expect([0, 1]).toContain(c);
      sum += c;
    }
    expect(sum / 2000).toBeGreaterThan(0.2);
    expect(sum / 2000).toBeLessThan(0.4);
  });

  it('state can be saved and resumed mid-sequence', () => {
    const a = new Rng(42);
    a.next(); a.next();
    const resumed = new Rng(a.state);
    const cont = new Rng(42);
    cont.next(); cont.next();
    expect(resumed.next()).toBe(cont.next());
  });

  it('produces known output for seed 42 (golden value — do not change)', () => {
    expect(new Rng(42).next()).toBe(0.6011037519201636);
  });
});
