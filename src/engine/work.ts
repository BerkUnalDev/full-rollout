// src/engine/work.ts
import { Rng } from './rng';
import {
  BUG_RATE_PER_POINT, QA_CATCH_BASE, QA_CATCH_PER_SKILL, REWORK_FRACTION,
  TECH_FAIL_BASE, TECH_FAIL_MAX, TECH_FAIL_MIN, TECH_FAIL_PENALTY, TECH_FAIL_PER_SKILL, TECH_REWORK_FRACTION,
  speedOf,
} from './constants';
import { clamp } from './quality';
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
      t.assigneeId = null;
      m.ticketKey = null;
      if (t.type === 'Tech Debt') {
        const devSkill = t.pointsWorked > 0 ? t.devSkillSum / t.pointsWorked : m.skill;
        const failChance = clamp(TECH_FAIL_BASE - TECH_FAIL_PER_SKILL * devSkill, TECH_FAIL_MIN, TECH_FAIL_MAX);
        if (rng.chance(failChance)) {
          const rework = Math.max(1, Math.ceil(t.effortTotal * TECH_REWORK_FRACTION));
          t.effort = rework;
          t.phaseEffort = rework;
          t.status = 'TODO';
          s.cash -= TECH_FAIL_PENALTY;
          s.pendingDeltas.push({ label: `Technical error: ${t.title}`, amount: -TECH_FAIL_PENALTY });
          s.pendingEvents.push(`⚠️ ${m.name} hit a technical error on ${t.title} — needs rework`);
        } else {
          t.status = 'DONE';
          if (t.techSubtype === 'investment' && t.benefitRevenuePct) {
            for (const g of s.games) {
              g.revenuePerPlayer = Math.round(g.revenuePerPlayer * (1 + t.benefitRevenuePct / 100) * 10000) / 10000;
            }
            s.pendingEvents.push(`🔧 ${m.name} shipped ${t.title} — +${t.benefitRevenuePct}% revenue on all games`);
            s.log.push(`Shipped ${t.title} (+${t.benefitRevenuePct}% revenue)`);
          } else {
            t.deadlineWeek = null; // mandatory obligation cleared
            s.pendingEvents.push(`🔧 ${m.name} shipped ${t.title}`);
          }
        }
      } else {
        const expectedBugs = t.phaseEffort * Math.max(0, 6 - m.skill) * BUG_RATE_PER_POINT;
        t.hiddenBugs += rng.count(expectedBugs);
        t.status = 'AWAITING_QA';
        t.qaEffort = 0; // fresh QA phase — sized when a QA member is assigned
        s.pendingEvents.push(`✅ ${m.name} finished ${t.title} → QA`);
      }
    }
  }
}

/** Mutates s: every ASSIGNED QA member applies one week of testing.
 *  QA never self-assigns — the player staffs testing, and how long it
 *  takes stays hidden from the UI. */
export function runQaPhase(s: GameState, rng: Rng): void {
  for (const qa of s.team) {
    if (qa.role !== 'QA' || !qa.ticketKey) continue;
    const t = s.tickets.find((x) => x.key === qa.ticketKey);
    if (!t || t.status !== 'IN_QA') {
      qa.ticketKey = null;
      continue;
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
      // Rework re-injects bugs via runDevPhase (phaseEffort = rework). With
      // STORY_EFFORT ≤ 8, equilibrium hiddenBugs ≈ reworkBugs/catchRate ≤ ~1.4
      // at worst skills, so the dev↔QA loop converges. If effortTotal ever
      // exceeds ~25, this bound breaks — revisit then.
      t.hiddenBugs -= caught;
      const rework = Math.max(1, Math.ceil(t.effortTotal * REWORK_FRACTION));
      t.effort = rework;
      t.phaseEffort = rework;
      t.status = 'TODO'; // back to the backlog for rework — player re-staffs it
      s.pendingEvents.push(`🔁 ${t.title} bounced back from QA`);
    } else {
      t.status = 'QA_COMPLETE';
    }
  }
}
