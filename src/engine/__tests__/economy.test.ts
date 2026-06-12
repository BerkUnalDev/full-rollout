// src/engine/__tests__/economy.test.ts
import { companyValue, runEconomy } from '../economy';
import { PLAYER_VALUE } from '../constants';
import { makeState } from './helpers';

describe('runEconomy', () => {
  it('adds revenue per game and subtracts payroll', () => {
    const s = makeState();
    const expectedRevenue = s.games.reduce((a, g) => a + Math.round(g.players * g.revenuePerPlayer), 0);
    const payroll = s.team.reduce((a, m) => a + m.salary, 0);
    const cashBefore = s.cash;
    runEconomy(s);
    expect(s.cash).toBe(cashBefore + expectedRevenue - payroll);
    expect(s.pendingDeltas.find((d) => d.label === 'Salaries')!.amount).toBe(-payroll);
    expect(s.pendingDeltas.filter((d) => d.amount > 0).length).toBe(2); // one per game
  });

  it('decays stale games but not fresh ones', () => {
    const s = makeState();
    const stale = s.games.find((g) => g.lastRolloutWeek <= -8)!; // 8+ weeks stale
    const fresh = s.games.find((g) => g.lastRolloutWeek === -2)!;
    const stalePlayers = stale.players;
    const freshPlayers = fresh.players;
    runEconomy(s);
    expect(stale.players).toBeLessThan(stalePlayers);
    expect(fresh.players).toBe(freshPlayers);
  });

  it('never decays an unlaunched (0-player) game below zero', () => {
    const s = makeState();
    s.games[0].players = 0;
    s.games[0].lastRolloutWeek = -20;
    runEconomy(s);
    expect(s.games[0].players).toBe(0);
  });
});

describe('companyValue', () => {
  it('is cash + players × PLAYER_VALUE', () => {
    const s = makeState();
    const players = s.games.reduce((a, g) => a + g.players, 0);
    expect(companyValue(s)).toBe(Math.round(s.cash + players * PLAYER_VALUE));
  });
});
