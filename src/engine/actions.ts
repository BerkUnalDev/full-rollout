// src/engine/actions.ts
import { Rng } from './rng';
import { applyFullRollout, applyPullBack, performCut } from './releases';
import { generateGameName } from './names';
import { createTicket, effortFor, genId, genStoryConcept, genBugTitle } from './generators';
import { GENRE_FIT, NEW_GAME_COST, QA_EFFORT_FRACTION } from './constants';
import { NEW_GAME_STORY_TITLES } from './data';
import { acceptInboxItem, declineInboxItem } from './inbox';
import type { GameState, Genre, PlanAction, PortfolioGame, Ticket } from './types';

type Ctx = { s: GameState; rng: Rng };
type Handlers = {
  [K in PlanAction['type']]?: (ctx: Ctx, a: Extract<PlanAction, { type: K }>) => void;
};
const handlers: Handlers = {};

/** Pure plan-phase reducer. Throws on invalid actions; never mutates input. */
export function applyAction(state: GameState, action: PlanAction): GameState {
  if (state.status !== 'playing') throw new Error('Game over');
  const s = structuredClone(state);
  const rng = new Rng(s.rngState);
  const handler = handlers[action.type];
  if (!handler) throw new Error(`Unknown action ${action.type}`);
  (handler as (ctx: Ctx, a: PlanAction) => void)({ s, rng }, action);
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
    if (!m) throw new Error(`Assigned member ${ticket.assigneeId} not found — corrupt state`);
    m.ticketKey = null;
  }
  ticket.assigneeId = null;
}

// Invariant: a ticket is in an "active" column (IN_DEVELOPMENT / IN_QA) iff it
// has an assignee. Unassigned work always sits in its queue column.
function returnToQueue(t: Ticket): void {
  if (t.status === 'IN_DEVELOPMENT') t.status = 'TODO';
  else if (t.status === 'IN_QA') t.status = 'AWAITING_QA';
}

handlers.assign = ({ s }, a: { ticketKey: string; memberId: string }) => {
  const t = getTicket(s, a.ticketKey);
  const m = s.team.find((x) => x.id === a.memberId);
  if (!m) throw new Error('No such team member');
  if (t.type === 'Release Ticket') throw new Error('Release tickets are handled by RMs');
  if (m.role === 'Developer') {
    if (t.status !== 'TODO' && t.status !== 'IN_DEVELOPMENT') {
      throw new Error(`Developers can't pick up a ticket in ${t.status}`);
    }
  } else if (m.role === 'QA') {
    if (t.status !== 'AWAITING_QA' && t.status !== 'IN_QA') {
      throw new Error(`QA can't pick up a ticket in ${t.status}`);
    }
  } else {
    throw new Error('Release managers handle releases, not tickets');
  }
  if (t.assigneeId && t.assigneeId !== m.id) throw new Error('Ticket already assigned');
  // Free the member's previous ticket, if any — it returns to its queue.
  if (m.ticketKey && m.ticketKey !== t.key) {
    const old = getTicket(s, m.ticketKey);
    freeMemberFromTicket(s, old);
    returnToQueue(old);
  }
  m.ticketKey = t.key;
  t.assigneeId = m.id;
  if (t.status === 'TODO') t.status = 'IN_DEVELOPMENT';
  else if (t.status === 'AWAITING_QA') {
    t.status = 'IN_QA';
    // Size the QA pass once per phase; remaining effort survives re-assignment.
    if (t.qaEffort <= 0) t.qaEffort = Math.ceil(t.phaseEffort * QA_EFFORT_FRACTION);
  }
};

handlers.unassign = ({ s }, a: { ticketKey: string }) => {
  const t = getTicket(s, a.ticketKey);
  if (t.status !== 'IN_DEVELOPMENT' && t.status !== 'IN_QA') {
    throw new Error('Only active tickets can be unassigned');
  }
  freeMemberFromTicket(s, t);
  returnToQueue(t); // progress (dev points / remaining QA effort) is preserved
};

handlers.cutRelease = ({ s, rng }, a: { gameId: string }) => {
  performCut(s, rng, a.gameId);
};

handlers.fullRollout = ({ s }, a: { releaseId: string }) => {
  applyFullRollout(s, a.releaseId);
};

handlers.pullBack = ({ s, rng }, a: { releaseId: string }) => {
  applyPullBack(s, rng, a.releaseId);
};

handlers.hire = ({ s }, a: { candidateId: string }) => {
  const c = s.market.candidates.find((x) => x.id === a.candidateId);
  if (!c) throw new Error('No such candidate');
  if (s.cash < c.signingFee) throw new Error('Not enough cash for the signing fee');
  s.cash -= c.signingFee;
  s.pendingDeltas.push({ label: `Signing fee: ${c.name}`, amount: -c.signingFee });
  s.team.push({ id: c.id, name: c.name, role: c.role, skill: c.skill, salary: c.salary, ticketKey: null });
  s.market.candidates = s.market.candidates.filter((x) => x.id !== c.id);
  s.pendingEvents.push(`👋 Hired ${c.name} — ${c.role}, ${'⭐'.repeat(c.skill)}`);
};

handlers.buyGame = ({ s, rng }, a: { offerId: string }) => {
  const o = s.market.offers.find((x) => x.id === a.offerId);
  if (!o) throw new Error('No such offer');
  if (s.cash < o.price) throw new Error('Not enough cash');
  s.cash -= o.price;
  s.pendingDeltas.push({ label: `Acquired ${o.name}`, amount: -o.price });
  const game: PortfolioGame = {
    id: genId(s, 'g'), name: o.name, genre: o.genre, players: o.players,
    rating: o.rating, revenuePerPlayer: o.revenuePerPlayer,
    version: `${rng.int(1, 3)}.${rng.int(0, 9)}.${rng.int(0, 2)}`,
    lastRolloutWeek: s.weekIndex, // acquisition resets the staleness clock
    pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  s.games.push(game);
  createTicket(s, {
    type: 'Bug', gameId: game.id,
    title: `${game.name} - ${genBugTitle(rng)}`, effort: effortFor(rng, 'Bug'),
  });
  for (let i = 0; i < 2; i++) {
    const { title, tag } = genStoryConcept(rng, game.genre, GENRE_FIT[game.genre]);
    const revenuePct = Math.round(rng.range(4, 10) * 10) / 10;
    createTicket(s, {
      type: 'Story', gameId: game.id, title: `${game.name} - ${title}`,
      effort: effortFor(rng, 'Story'), tags: [tag],
      predictedImpact: { revenuePct, ratingBonus: 0.1 },
      impact: {
        revenuePct: Math.round(revenuePct * rng.range(0.5, 1.4) * 10) / 10,
        ratingBonus: 0.1,
      },
    });
  }
  s.market.offers = s.market.offers.filter((x) => x.id !== o.id);
  s.pendingEvents.push(`🎉 Acquired ${o.name} for $${o.price.toLocaleString('en-US')}`);
  s.log.push(`Acquired ${o.name}`);
};

handlers.startNewGame = ({ s, rng }, a: { genre: Genre }) => {
  if (s.cash < NEW_GAME_COST) throw new Error('Not enough cash');
  s.cash -= NEW_GAME_COST;
  s.pendingDeltas.push({ label: 'New game prototype', amount: -NEW_GAME_COST });
  const name = generateGameName(rng, s.usedNames);
  s.usedNames.push(name);
  const game: PortfolioGame = {
    id: genId(s, 'g'), name, genre: a.genre, players: 0, rating: 3.0,
    revenuePerPlayer: 0.012, version: '0.0.0', lastRolloutWeek: s.weekIndex,
    pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  s.games.push(game);
  for (const title of NEW_GAME_STORY_TITLES) {
    createTicket(s, {
      type: 'Story', gameId: game.id, title: `${name} - ${title}`,
      effort: rng.int(5, 8),
      predictedImpact: { revenuePct: 3, ratingBonus: 0.1 },
      impact: { revenuePct: Math.round(rng.range(2, 5) * 10) / 10, ratingBonus: 0.1 },
    });
  }
  s.pendingEvents.push(`🌱 Started a new ${a.genre} game: ${name}`);
  s.log.push(`Started ${name} (${a.genre})`);
};

handlers.acceptInbox = ({ s }, a: { itemId: string }) => {
  acceptInboxItem(s, a.itemId);
};

handlers.declineInbox = ({ s }, a: { itemId: string }) => {
  declineInboxItem(s, a.itemId);
};
