// src/engine/work.ts
import { Rng } from './rng';
import {
  BUG_RATE_PER_POINT, QA_CATCH_BASE, QA_CATCH_PER_SKILL, QA_EFFORT_FRACTION, REWORK_FRACTION, speedOf,
} from './constants';
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
      const expectedBugs = t.phaseEffort * Math.max(0, 6 - m.skill) * BUG_RATE_PER_POINT;
      t.hiddenBugs += rng.count(expectedBugs);
      t.status = 'AWAITING_QA';
      t.assigneeId = null;
      m.ticketKey = null;
    }
  }
}

/** Mutates s: every QA member works or pulls one ticket. */
export function runQaPhase(s: GameState, rng: Rng): void {
  for (const qa of s.team) {
    if (qa.role !== 'QA') continue;
    let t = qa.ticketKey ? s.tickets.find((x) => x.key === qa.ticketKey) ?? null : null;
    if (t && t.status !== 'IN_QA') {
      qa.ticketKey = null;
      t = null;
    }
    if (!t) {
      t = s.tickets.find((x) => x.status === 'AWAITING_QA') ?? null; // array order = oldest first
      if (!t) continue;
      t.status = 'IN_QA';
      t.assigneeId = qa.id;
      qa.ticketKey = t.key;
      t.qaEffort = Math.ceil(t.phaseEffort * QA_EFFORT_FRACTION);
    }
    t.qaEffort -= Math.min(t.qaEffort, speedOf(qa.skill));
    if (t.qaEffort > 0) continue;
    // QA pass complete — roll per hidden bug.
    const catchRate = QA_CATCH_BASE + QA_CATCH_PER_SKILL * qa.skill;
    let caught = 0;
    for (let i = 0; i < t.hiddenBugs; i++) if (rng.chance(catchRate)) caught++;
    qa.ticketKey = null;
    t.assigneeId = null;
    if (caught > 0) {
      t.hiddenBugs -= caught;
      const rework = Math.max(1, Math.ceil(t.effortTotal * REWORK_FRACTION));
      t.effort = rework;
      t.phaseEffort = rework;
      t.status = 'IN_DEVELOPMENT'; // unassigned — player must re-staff it
    } else {
      t.status = 'QA_COMPLETE';
    }
  }
}
