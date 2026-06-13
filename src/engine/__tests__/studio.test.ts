// src/engine/__tests__/studio.test.ts
import { Rng } from '../rng';
import { maxGamesFor, nextUpgradeCost, rollRequiredLevel } from '../studio';
import { STUDIO_LEVEL_CAP, STUDIO_UPGRADE_COSTS, LEVEL_WINDOW_SPAN } from '../constants';
import { makeState } from './helpers';

describe('maxGamesFor', () => {
  it('is level × 4', () => {
    expect(maxGamesFor(1)).toBe(4);
    expect(maxGamesFor(10)).toBe(40);
  });
});

describe('nextUpgradeCost', () => {
  it('returns the indexed cost, null at cap', () => {
    expect(nextUpgradeCost(1)).toBe(STUDIO_UPGRADE_COSTS[0]);
    expect(nextUpgradeCost(9)).toBe(STUDIO_UPGRADE_COSTS[8]);
    expect(nextUpgradeCost(STUDIO_LEVEL_CAP)).toBeNull();
  });
});

describe('rollRequiredLevel', () => {
  it('forces level 1 during the grace period', () => {
    const s = makeState();
    s.weekIndex = 0;
    s.studioLevel = 5;
    for (let i = 0; i < 50; i++) expect(rollRequiredLevel(s, new Rng(i))).toBe(1);
  });

  it('post-grace stays within a clamped window around studioLevel', () => {
    const s = makeState();
    s.weekIndex = 20;
    s.studioLevel = 5; // ceiling = 7, floor = 3
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rollRequiredLevel(s, new Rng(i)));
    const levels = [...seen];
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...levels)).toBeLessThanOrEqual(7);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(LEVEL_WINDOW_SPAN - 1);
    expect(levels).toContain(3); // lower levels always present (skewed toward floor)
  });

  it('never exceeds the cap even at high studio level', () => {
    const s = makeState();
    s.weekIndex = 20;
    s.studioLevel = 10;
    for (let i = 0; i < 200; i++) {
      const lv = rollRequiredLevel(s, new Rng(i));
      expect(lv).toBeLessThanOrEqual(STUDIO_LEVEL_CAP);
      expect(lv).toBeGreaterThanOrEqual(1);
    }
  });
});
