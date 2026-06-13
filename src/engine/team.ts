// src/engine/team.ts
import { QA_CATCH_BASE, QA_CATCH_PER_SKILL, speedOf } from './constants';
import type { Role } from './types';

// index by skill 1-5
const BUG_PRONENESS = ['', 'very high', 'high', 'medium', 'low', 'very low'] as const;

/** Human-readable derived stats for a team member / candidate, shown in the UI. */
export function memberStats(role: Role, skill: number): string[] {
  if (role === 'Developer') {
    return [`⚡ ${speedOf(skill)} pts/wk build`, `🐛 ${BUG_PRONENESS[skill]} bug-proneness`];
  }
  if (role === 'QA') {
    const rate = Math.min(99, Math.round((QA_CATCH_BASE + QA_CATCH_PER_SKILL * skill) * 100));
    return [`⚡ ${speedOf(skill)} pts/wk test`, `🎯 ${rate}% catch rate`];
  }
  return [`📦 ${skill} release${skill === 1 ? '' : 's'}/week`];
}
