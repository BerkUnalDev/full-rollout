// src/engine/economy.ts
import {
  DECAY_GRACE_WEEKS, DECAY_MAX_STALE_WEEKS, DECAY_PER_STALE_WEEK, PLAYER_VALUE,
  RATING_DECAY_STALE,
} from './constants';
import type { GameState } from './types';

/** Mutates s: weekly revenue, staleness decay, payroll. Pushes deltas. */
export function runEconomy(s: GameState): void {
  for (const g of s.games) {
    const rev = g.outageWeeks && g.outageWeeks > 0 ? 0 : Math.round(g.players * g.revenuePerPlayer);
    if (rev > 0) {
      s.cash += rev;
      s.pendingDeltas.push({ label: `${g.name} revenue`, amount: rev });
    }
  }
  for (const g of s.games) {
    if (g.players === 0) continue; // not launched yet — nothing to decay
    const stale = s.weekIndex - g.lastRolloutWeek;
    if (stale > DECAY_GRACE_WEEKS) {
      const weeksOver = Math.min(stale - DECAY_GRACE_WEEKS, DECAY_MAX_STALE_WEEKS);
      g.players = Math.max(0, Math.round(g.players * (1 - DECAY_PER_STALE_WEEK * weeksOver)));
      g.rating = Math.max(1, Math.round((g.rating - RATING_DECAY_STALE) * 100) / 100);
    }
  }
  const payroll = s.team.reduce((a, m) => a + m.salary, 0);
  s.cash -= payroll;
  s.pendingDeltas.push({ label: 'Salaries', amount: -payroll });
}

export function companyValue(s: GameState): number {
  return Math.round(s.cash + s.games.reduce((a, g) => a + g.players * PLAYER_VALUE, 0));
}
