// src/engine/__tests__/newGame.test.ts
import { newGame } from '../newGame';
import { STARTING_CASH } from '../constants';

describe('newGame', () => {
  it('is deterministic for the same seed', () => {
    expect(newGame(7)).toEqual(newGame(7));
  });

  it('sets up the starting company per spec', () => {
    const s = newGame(1);
    expect(s.cash).toBe(STARTING_CASH);
    expect(s.weekIndex).toBe(0);
    expect(s.status).toBe('playing');
    // 2 devs, 1 QA, 1 RM
    const roles = s.team.map((m) => m.role).sort();
    expect(roles).toEqual(['Developer', 'Developer', 'QA', 'Release Manager'].sort());
    // 2 starting games: one aging (stale), one healthy
    expect(s.games).toHaveLength(2);
    const stale = s.games.filter((g) => g.lastRolloutWeek < -6);
    expect(stale).toHaveLength(1);
    // weekly payroll ≈ weekly revenue (breakeven-ish, within 20%)
    const payroll = s.team.reduce((a, m) => a + m.salary, 0);
    const revenue = s.games.reduce((a, g) => a + g.players * g.revenuePerPlayer, 0);
    expect(revenue / payroll).toBeGreaterThan(0.8);
    expect(revenue / payroll).toBeLessThan(1.2);
  });

  it('seeds starter tickets, market and inbox', () => {
    const s = newGame(2);
    expect(s.tickets.length).toBeGreaterThanOrEqual(3);
    expect(s.tickets.every((t) => t.status === 'TODO')).toBe(true);
    expect(s.market.candidates.length).toBeGreaterThanOrEqual(2);
    expect(s.market.offers.length).toBeGreaterThanOrEqual(1);
    expect(s.inbox.filter((i) => i.status === 'pending').length).toBeGreaterThanOrEqual(2);
    // ticket keys are GIM-style and unique
    const keys = s.tickets.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^GIM-\d+$/.test(k))).toBe(true);
    // game names are fictional (asserted indirectly: tracked in usedNames)
    expect(s.usedNames.length).toBeGreaterThanOrEqual(2);
  });
});
