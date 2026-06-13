// economyScale: event amounts grow with studio level + weekly income
import { Rng } from '../rng';
import { economyScale } from '../economy';
import { generateInboxItem } from '../inbox';
import { TECHDEBT_FINE } from '../constants';
import { makeState } from './helpers';

describe('economyScale', () => {
  it('grows with studio level and weekly income', () => {
    const base = makeState();
    base.studioLevel = 1;
    const small = economyScale(base);

    const big = makeState();
    big.studioLevel = 6;
    big.games[0].players = 400_000; // fat income
    big.games[0].revenuePerPlayer = 0.02;
    expect(economyScale(big)).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(1);
  });
});

describe('tech-debt fine scales with progression', () => {
  it('a late-game tech-debt fine is much bigger than the base', () => {
    const s = makeState();
    s.studioLevel = 8;
    s.games[0].players = 500_000;
    s.games[0].revenuePerPlayer = 0.02;
    const item = generateInboxItem(s, new Rng(1), 'techdebt', undefined, 'mandatory');
    expect(item.fineUsd!).toBeGreaterThan(TECHDEBT_FINE * 3); // meaningfully scaled up
  });

  it('an early tech-debt fine stays modest', () => {
    const s = makeState(); // L1, ~$5k income
    const item = generateInboxItem(s, new Rng(2), 'techdebt', undefined, 'mandatory');
    expect(item.fineUsd!).toBeGreaterThanOrEqual(TECHDEBT_FINE);
    expect(item.fineUsd!).toBeLessThan(TECHDEBT_FINE * 2.5);
  });
});
