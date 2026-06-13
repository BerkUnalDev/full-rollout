// src/engine/__tests__/studio.test.ts
import { Rng } from '../rng';
import { maxGamesFor, nextUpgradeCost, rollRequiredLevel, studioGameRequirement, roleCapacity } from '../studio';
import { STUDIO_LEVEL_CAP, STUDIO_UPGRADE_COSTS, LEVEL_WINDOW_SPAN, WEEKS_PER_REQ_BUMP, GATE_GRACE_WEEKS } from '../constants';
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

describe('rising floor (v2.1)', () => {
  it('floor climbs +1 every WEEKS_PER_REQ_BUMP after grace', () => {
    const s = makeState();
    s.studioLevel = 1;
    const minAt = (week: number) => {
      s.weekIndex = week;
      let min = 99;
      for (let i = 0; i < 300; i++) min = Math.min(min, rollRequiredLevel(s, new Rng(i))); // no accessible chance
      return min;
    };
    expect(minAt(GATE_GRACE_WEEKS)).toBe(1);
    expect(minAt(GATE_GRACE_WEEKS + WEEKS_PER_REQ_BUMP)).toBe(2);
    expect(minAt(GATE_GRACE_WEEKS + WEEKS_PER_REQ_BUMP * 3)).toBe(4);
  });

  it('feature accessible-chance yields ≤ studioLevel sometimes; tech-debt never gets the guarantee', () => {
    const s = makeState();
    s.studioLevel = 2;
    s.weekIndex = 40; // floor well above 2 without the guarantee
    let featAccessible = 0, techAccessible = 0;
    for (let i = 0; i < 400; i++) {
      if (rollRequiredLevel(s, new Rng(i), 0.2) <= s.studioLevel) featAccessible++;
      if (rollRequiredLevel(s, new Rng(i)) <= s.studioLevel) techAccessible++;
    }
    expect(featAccessible).toBeGreaterThan(40); // ~20% land accessible
    expect(techAccessible).toBe(0); // pure rising floor is above level 2 by week 40
  });
});

describe('studioGameRequirement / roleCapacity', () => {
  it('game requirement by level', () => {
    expect(studioGameRequirement(1)).toBe(3);
    expect(studioGameRequirement(2)).toBe(5);
  });
  it('role capacity = base + level', () => {
    expect(roleCapacity('Developer', 1)).toBe(3);
    expect(roleCapacity('QA', 1)).toBe(2);
    expect(roleCapacity('Release Manager', 3)).toBe(4);
  });
});
