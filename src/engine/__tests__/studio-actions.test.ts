// src/engine/__tests__/studio-actions.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { nextUpgradeCost, maxGamesFor } from '../studio';
import { STUDIO_LEVEL_CAP } from '../constants';

describe('upgradeStudio', () => {
  it('deducts cash, raises level instantly, logs a delta', () => {
    const s = newGame(1);
    // New precondition: need 3 games to go L1→L2; newGame starts with 2.
    s.games.push({ ...s.games[0], id: 'g-extra', name: 'Extra' });
    const cost = nextUpgradeCost(s.studioLevel)!;
    const s2 = applyAction(s, { type: 'upgradeStudio' });
    expect(s2.studioLevel).toBe(2);
    expect(s2.cash).toBe(s.cash - cost);
    expect(s2.pendingDeltas.some((d) => d.amount === -cost)).toBe(true);
    expect(s.studioLevel).toBe(1); // input untouched
  });

  it('throws when cash is short or at cap', () => {
    const s = newGame(1);
    s.cash = 0;
    expect(() => applyAction(s, { type: 'upgradeStudio' })).toThrow();
    const maxed = newGame(1);
    maxed.studioLevel = STUDIO_LEVEL_CAP;
    maxed.cash = 10_000_000;
    expect(() => applyAction(maxed, { type: 'upgradeStudio' })).toThrow();
  });
});

describe('games cap', () => {
  it('blocks startNewGame and buyGame beyond maxGamesFor(level)', () => {
    const s = newGame(1);
    s.cash = 10_000_000;
    // L1 → max 4 games; start at 2, add 2 → 4, third should throw
    let st = applyAction(s, { type: 'startNewGame', genre: 'Puzzle' });
    st = applyAction(st, { type: 'startNewGame', genre: 'Card' });
    expect(st.games.length).toBe(maxGamesFor(1));
    expect(() => applyAction(st, { type: 'startNewGame', genre: 'Word' })).toThrow();
    const offerId = st.market.offers[0]?.id;
    if (offerId) expect(() => applyAction(st, { type: 'buyGame', offerId })).toThrow();
  });
});
