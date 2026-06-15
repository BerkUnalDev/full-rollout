// Featuring reward is a low-skewed 5–25% roll (not a flat +25%)
import { Rng } from '../rng';
import { generateInboxItem } from '../inbox';
import { FEATURING_REWARD_MIN, FEATURING_REWARD_MAX } from '../constants';
import { makeState } from './helpers';

describe('featuring reward roll', () => {
  it('always lands in [MIN, MAX] and is skewed toward the low end', () => {
    const s = makeState();
    const vals: number[] = [];
    for (let i = 0; i < 1000; i++) {
      vals.push(generateInboxItem(s, new Rng(i), 'opportunity', s.games[0].id).rewardPlayersPct!);
    }
    expect(Math.min(...vals)).toBeGreaterThanOrEqual(FEATURING_REWARD_MIN);
    expect(Math.max(...vals)).toBeLessThanOrEqual(FEATURING_REWARD_MAX);

    const nearMax = vals.filter((v) => v >= 0.22).length / vals.length;
    const low = vals.filter((v) => v <= 0.12).length / vals.length;
    expect(nearMax).toBeLessThan(0.12); // ~25% is rare (~5%)
    expect(low).toBeGreaterThan(0.5); // most rewards are low
    // not every roll identical (it's actually random, not flat)
    expect(new Set(vals).size).toBeGreaterThan(5);
  });
});
