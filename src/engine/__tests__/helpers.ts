// src/engine/__tests__/helpers.ts
import { newGame } from '../newGame';
import { QA_EFFORT_FRACTION } from '../constants';
import type { GameState, Role, TeamMember, Ticket } from '../types';

export function makeState(seed = 1): GameState {
  return newGame(seed);
}

export function addMember(s: GameState, role: Role, skill: number): TeamMember {
  const m: TeamMember = {
    id: `tm${s.nextId++}`, name: `Test ${role}`, role, skill, salary: 1000, ticketKey: null,
  };
  s.team.push(m);
  return m;
}

export function addTicket(s: GameState, over: Partial<Ticket> = {}): Ticket {
  const t: Ticket = {
    key: `GIM-${s.nextTicketNum++}`,
    type: 'Story', gameId: s.games[0].id, title: 'Test story',
    status: 'TODO', assigneeId: null,
    effortTotal: 4, effort: 4, phaseEffort: 4, pointsWorked: 0, devSkillSum: 0,
    qaEffort: 0, hiddenBugs: 0, tags: [],
    predictedImpact: { revenuePct: 0, ratingBonus: 0 },
    impact: { revenuePct: 0, ratingBonus: 0 },
    deadlineWeek: null, createdWeek: s.weekIndex, releaseVersion: null,
    ...over,
  };
  s.tickets.push(t);
  return t;
}

/** Directly wire an assignment in a fixture (bypasses applyAction validation). */
export function assignTo(_s: GameState, t: Ticket, m: TeamMember): void {
  t.assigneeId = m.id;
  m.ticketKey = t.key;
  if (t.status === 'TODO') t.status = 'IN_DEVELOPMENT';
  else if (t.status === 'AWAITING_QA') {
    t.status = 'IN_QA';
    if (t.qaEffort <= 0) t.qaEffort = Math.ceil(t.phaseEffort * QA_EFFORT_FRACTION);
  }
}
