// src/engine/disruptions.ts — random pipeline/revenue blockers (1–3 weeks)
import { Rng } from './rng';
import { DISRUPTION_CHANCE, DISRUPTION_WEEKS } from './constants';
import { cwLabel } from './week';
import type { GameState } from './types';

const wk = (n: number) => `${n} week${n > 1 ? 's' : ''}`;
const OUT_REASONS = ['is on vacation', 'is out sick', 'has a family emergency'] as const;

/** Mutates s: tick down active disruptions (lifting expired ones), then maybe
 *  start a new one. Called once per week from endWeek, after the market refresh. */
export function runDisruptions(s: GameState, rng: Rng): void {
  // tick down + lift
  for (const g of s.games) {
    if (g.outageWeeks && g.outageWeeks > 0) {
      g.outageWeeks -= 1;
      if (g.outageWeeks === 0) s.pendingEvents.push(`✅ ${g.name} servers are back online`);
    }
  }
  for (const m of s.team) {
    if (m.outWeeks && m.outWeeks > 0) {
      m.outWeeks -= 1;
      if (m.outWeeks === 0) s.pendingEvents.push(`✅ ${m.name} is back at work`);
    }
  }

  if (!rng.chance(DISRUPTION_CHANCE)) return;
  const weeks = rng.int(DISRUPTION_WEEKS[0], DISRUPTION_WEEKS[1]);

  // 50/50 outage vs employee-out; fall back to the other if no candidate.
  const outageCandidates = s.games.filter((g) => g.players > 0 && !(g.outageWeeks && g.outageWeeks > 0));
  const peopleCandidates = s.team.filter((m) => !(m.outWeeks && m.outWeeks > 0));
  const wantOutage = rng.chance(0.5);

  if (wantOutage && outageCandidates.length > 0) {
    const g = rng.pick(outageCandidates);
    g.outageWeeks = weeks;
    s.pendingEvents.push(`🚨 Breaking change! ${g.name} servers are down — $0 revenue for ${wk(weeks)}.`);
    s.log.push(`${cwLabel(s.weekIndex)}: ${g.name} outage (${weeks}w)`);
    return;
  }
  if (peopleCandidates.length > 0) {
    // bias toward release managers — losing one squeezes the release pipeline
    const rms = peopleCandidates.filter((m) => m.role === 'Release Manager');
    const m = rms.length > 0 && rng.chance(0.6) ? rng.pick(rms) : rng.pick(peopleCandidates);
    m.outWeeks = weeks;
    if (m.ticketKey) {
      const t = s.tickets.find((x) => x.key === m.ticketKey);
      if (t) {
        t.assigneeId = null;
        if (t.status === 'IN_DEVELOPMENT') t.status = 'TODO';
        else if (t.status === 'IN_QA') t.status = 'AWAITING_QA';
      }
      m.ticketKey = null;
    }
    s.pendingEvents.push(`🚨 ${m.name} (${m.role}) ${rng.pick(OUT_REASONS)} — out for ${wk(weeks)}.`);
    s.log.push(`${cwLabel(s.weekIndex)}: ${m.name} out (${weeks}w)`);
    return;
  }
  if (outageCandidates.length > 0) {
    const g = rng.pick(outageCandidates);
    g.outageWeeks = weeks;
    s.pendingEvents.push(`🚨 Breaking change! ${g.name} servers are down — $0 revenue for ${wk(weeks)}.`);
    s.log.push(`${cwLabel(s.weekIndex)}: ${g.name} outage (${weeks}w)`);
  }
}
