// src/engine/newGame.ts
import { Rng } from './rng';
import { DEFAULT_SEED, GENRE_FIT, SCHEMA_VERSION, STARTING_CASH } from './constants';
import { generateGameName, generatePersonName } from './names';
import { createTicket, effortFor, genStoryConcept, genBugTitle, refreshMarket, genId } from './generators';
import { generateInboxItem } from './inbox';
import type { GameState, PortfolioGame, Role } from './types';

function member(s: GameState, rng: Rng, role: Role, skill: number, salary: number) {
  s.team.push({
    id: genId(s, 'm'),
    name: generatePersonName(rng),
    role,
    skill,
    salary,
    ticketKey: null,
  });
}

export function newGame(seed: number = DEFAULT_SEED): GameState {
  const rng = new Rng(seed);
  const s: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngState: seed,
    weekIndex: 0,
    cash: STARTING_CASH,
    status: 'playing',
    studioLevel: 1,
    team: [],
    games: [],
    tickets: [],
    releases: [],
    inbox: [],
    market: { candidates: [], offers: [] },
    nextTicketNum: 1,
    nextId: 1,
    usedNames: [],
    pendingDeltas: [],
    pendingEvents: [],
    lastReport: null,
    reportHistory: [],
    log: [],
  };

  // Team: Dev(3) $1500, Dev(2) $1100, QA(3) $1200, RM(3) $1300 → payroll $5,100/wk.
  member(s, rng, 'Developer', 3, 1500);
  member(s, rng, 'Developer', 2, 1100);
  member(s, rng, 'QA', 3, 1200);
  member(s, rng, 'Release Manager', 3, 1300);

  // Portfolio: an aging former hit (already stale) + a mid-size healthy title.
  // Combined revenue ≈ $5.1k/wk ≈ payroll; the aging game decays from week 1.
  const nameA = generateGameName(rng, s.usedNames);
  s.usedNames.push(nameA);
  const aging: PortfolioGame = {
    id: genId(s, 'g'), name: nameA, genre: rng.pick(['Puzzle', 'Arcade'] as const),
    players: 220_000, rating: 4.0, revenuePerPlayer: 0.016, version: '2.4.1',
    lastRolloutWeek: -8, pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  const nameB = generateGameName(rng, s.usedNames);
  s.usedNames.push(nameB);
  const healthy: PortfolioGame = {
    id: genId(s, 'g'), name: nameB, genre: rng.pick(['Merge', 'Word'] as const),
    players: 90_000, rating: 4.4, revenuePerPlayer: 0.018, version: '1.6.0',
    lastRolloutWeek: -2, pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  s.games.push(aging, healthy);

  // Starter backlog: aging game gets a bug + a story; healthy game gets a story.
  createTicket(s, {
    type: 'Bug', gameId: aging.id,
    title: `${aging.name} - ${genBugTitle(rng)}`, effort: effortFor(rng, 'Bug'),
  });
  for (const g of [aging, healthy]) {
    const { title, tag } = genStoryConcept(rng, g.genre, GENRE_FIT[g.genre]);
    const revenuePct = Math.round(rng.range(5, 10) * 10) / 10;
    createTicket(s, {
      type: 'Story', gameId: g.id, title: `${g.name} - ${title}`,
      effort: effortFor(rng, 'Story'), tags: [tag],
      predictedImpact: { revenuePct, ratingBonus: 0.1 },
      impact: {
        revenuePct: Math.round(revenuePct * rng.range(0.6, 1.3) * 10) / 10,
        ratingBonus: 0.1,
      },
    });
  }

  refreshMarket(s, rng);
  s.inbox.push(generateInboxItem(s, rng, 'feature'));
  s.inbox.push(generateInboxItem(s, rng, 'bug'));

  s.rngState = rng.state;
  return s;
}
