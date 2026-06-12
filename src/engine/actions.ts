// src/engine/actions.ts
import { Rng } from './rng';
import type { GameState, PlanAction, Ticket } from './types';

type Ctx = { s: GameState; rng: Rng };
const handlers: Partial<Record<PlanAction['type'], (ctx: Ctx, a: any) => void>> = {};

/** Pure plan-phase reducer. Throws on invalid actions; never mutates input. */
export function applyAction(state: GameState, action: PlanAction): GameState {
  if (state.status !== 'playing') throw new Error('Game over');
  const s = structuredClone(state);
  const rng = new Rng(s.rngState);
  const handler = handlers[action.type];
  if (!handler) throw new Error(`Unknown action ${action.type}`);
  handler({ s, rng }, action);
  s.rngState = rng.state;
  return s;
}

export function getTicket(s: GameState, key: string): Ticket {
  const t = s.tickets.find((x) => x.key === key);
  if (!t) throw new Error(`No ticket ${key}`);
  return t;
}

function freeMemberFromTicket(s: GameState, ticket: Ticket): void {
  if (ticket.assigneeId) {
    const m = s.team.find((x) => x.id === ticket.assigneeId);
    if (m) m.ticketKey = null;
  }
  ticket.assigneeId = null;
}

handlers.assign = ({ s }, a: { ticketKey: string; memberId: string }) => {
  const t = getTicket(s, a.ticketKey);
  const m = s.team.find((x) => x.id === a.memberId);
  if (!m) throw new Error('No such team member');
  if (m.role !== 'Developer') throw new Error('Only developers can be assigned');
  if (t.type === 'Release Ticket') throw new Error('Release tickets are handled by RMs');
  if (t.status !== 'TODO' && t.status !== 'IN_DEVELOPMENT') {
    throw new Error(`Cannot assign a ticket in ${t.status}`);
  }
  if (t.assigneeId && t.assigneeId !== m.id) throw new Error('Ticket already assigned');
  // Free the dev's previous ticket, if any.
  if (m.ticketKey && m.ticketKey !== t.key) {
    const old = getTicket(s, m.ticketKey);
    old.assigneeId = null;
  }
  m.ticketKey = t.key;
  t.assigneeId = m.id;
  if (t.status === 'TODO') t.status = 'IN_DEVELOPMENT';
};

handlers.unassign = ({ s }, a: { ticketKey: string }) => {
  const t = getTicket(s, a.ticketKey);
  if (t.status !== 'IN_DEVELOPMENT') throw new Error('Only dev-phase tickets can be unassigned');
  freeMemberFromTicket(s, t);
  if (t.pointsWorked === 0) t.status = 'TODO';
};
