// src/engine/economy.ts
import {
  DECAY_GRACE_WEEKS, DECAY_MAX_STALE_WEEKS, DECAY_PER_STALE_WEEK,
  EVENT_SCALE_INCOME_DIV, EVENT_SCALE_PER_LEVEL, PLAYER_VALUE, RATING_DECAY_STALE,
} from './constants';
import type { GameState } from './types';

/** Current weekly revenue across the portfolio (outages contribute 0). */
export function weeklyIncome(s: GameState): number {
  return s.games.reduce(
    (a, g) => a + (g.outageWeeks && g.outageWeeks > 0 ? 0 : g.players * g.revenuePerPlayer),
    0,
  );
}

/** Multiplier that keeps flat event amounts (fines, fees) meaningful as the
 *  studio grows — driven by studio level and weekly income. */
export function economyScale(s: GameState): number {
  return 1 + EVENT_SCALE_PER_LEVEL * (s.studioLevel - 1) + weeklyIncome(s) / EVENT_SCALE_INCOME_DIV;
}

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
