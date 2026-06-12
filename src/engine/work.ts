// src/engine/work.ts
import { Rng } from './rng';
import { BUG_RATE_PER_POINT, speedOf } from './constants';
import type { GameState } from './types';

/** Mutates s: every assigned developer applies one week of work. */
export function runDevPhase(s: GameState, rng: Rng): void {
  for (const m of s.team) {
    if (m.role !== 'Developer' || !m.ticketKey) continue;
    const t = s.tickets.find((x) => x.key === m.ticketKey);
    if (!t || t.status !== 'IN_DEVELOPMENT') {
      m.ticketKey = null;
      continue;
    }
    const applied = Math.min(speedOf(m.skill), t.effort);
    t.effort -= applied;
    t.pointsWorked += applied;
    t.devSkillSum += applied * m.skill;
    if (t.effort <= 0) {
      const expectedBugs = t.phaseEffort * (6 - m.skill) * BUG_RATE_PER_POINT;
      t.hiddenBugs += rng.count(expectedBugs);
      t.status = 'AWAITING_QA';
      t.assigneeId = null;
      m.ticketKey = null;
    }
  }
}
