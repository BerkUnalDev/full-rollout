// src/engine/__tests__/names.test.ts
import { Rng } from '../rng';
import { generateGameName, generatePersonName } from '../names';
import { REAL_GIM_NAMES } from '../data';

describe('name generators', () => {
  it('game names are two words from the banks and deterministic', () => {
    const a = generateGameName(new Rng(1), []);
    const b = generateGameName(new Rng(1), []);
    expect(a).toBe(b);
    expect(a.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('never produces a real GIM game name', () => {
    const rng = new Rng(2);
    const used: string[] = [];
    for (let i = 0; i < 200; i++) {
      const n = generateGameName(rng, used);
      expect(REAL_GIM_NAMES as readonly string[]).not.toContain(n);
      used.push(n);
    }
  });

  it('avoids names already in use', () => {
    const rng = new Rng(3);
    const used: string[] = [];
    for (let i = 0; i < 100; i++) used.push(generateGameName(rng, used));
    expect(new Set(used).size).toBe(used.length);
  });

  it('person names are deterministic first + last', () => {
    const a = generatePersonName(new Rng(4));
    expect(a).toBe(generatePersonName(new Rng(4)));
    expect(a.split(' ').length).toBe(2);
  });
});
