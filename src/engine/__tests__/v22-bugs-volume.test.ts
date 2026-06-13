// Round-5: launch bugs reach the inbox + inbox volume scales with portfolio
import { Rng } from '../rng';
import { applyAction } from '../actions';
import { generateWeeklyInbox } from '../inbox';
import { makeState } from './helpers';
import type { GameState, PortfolioGame, Release } from '../types';

function decidable(s: GameState, gameId: string, bugReports: number): Release {
  const r: Release = {
    id: `rel-${bugReports}`, gameId, version: '9.9.0', cwLabel: 'CW 24/2026', ticketKeys: [],
    releaseTicketKey: 'GIM-9', quality: 70, missedBugs: bugReports, impact: { revenuePct: 5, ratingBonus: 0.1 },
    status: 'soft', shippedWeek: 0,
    reportCard: { happiness: 'liked', bugReports, revenueImpactPct: 8, ratingDelta: 0.2 }, decision: null,
  };
  s.releases.push(r);
  return r;
}

describe('full rollout surfaces the report’s bugs as inbox bug reports', () => {
  it('spawns reportCard.bugReports pending bug reports for the game', () => {
    const s = makeState();
    const g = s.games[0];
    const before = s.inbox.filter((i) => i.kind === 'bug' && i.status === 'pending' && i.gameId === g.id).length;
    const r = decidable(s, g.id, 3);
    const s2 = applyAction(s, { type: 'fullRollout', releaseId: r.id });
    const after = s2.inbox.filter((i) => i.kind === 'bug' && i.status === 'pending' && i.gameId === g.id).length;
    expect(after - before).toBe(3);
  });

  it('a clean launch (0 bug reports) spawns none', () => {
    const s = makeState();
    const g = s.games[0];
    const r = decidable(s, g.id, 0);
    const s2 = applyAction(s, { type: 'fullRollout', releaseId: r.id });
    expect(s2.inbox.filter((i) => i.kind === 'bug' && i.status === 'pending').length)
      .toBe(s.inbox.filter((i) => i.kind === 'bug' && i.status === 'pending').length);
  });
});

describe('inbox volume scales with portfolio size', () => {
  it('a 15-game studio gets many more weekly items than a 2-game one', () => {
    const big = makeState();
    const proto = big.games[0];
    while (big.games.length < 15) {
      big.games.push({ ...proto, id: `g${big.nextId++}`, name: `Game ${big.games.length}` } as PortfolioGame);
    }
    const beforeBig = big.inbox.length;
    generateWeeklyInbox(big, new Rng(1));
    const addedBig = big.inbox.length - beforeBig;

    const small = makeState(); // 2 games
    const beforeSmall = small.inbox.length;
    generateWeeklyInbox(small, new Rng(1));
    const addedSmall = small.inbox.length - beforeSmall;

    expect(addedBig).toBeGreaterThan(addedSmall);
    expect(addedBig).toBeGreaterThanOrEqual(6); // 1-3 base + 15/3 = +5
  });
});
