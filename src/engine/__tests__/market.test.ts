// src/engine/__tests__/market.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { computeNextVersion } from '../releases';
import { NEW_GAME_COST, NEW_GAME_STORIES } from '../constants';
import { makeState, addTicket } from './helpers';

describe('hire', () => {
  it('deducts the signing fee and adds the member', () => {
    const s = newGame(1);
    const c = s.market.candidates[0];
    const s2 = applyAction(s, { type: 'hire', candidateId: c.id });
    expect(s2.cash).toBe(s.cash - c.signingFee);
    expect(s2.team.some((m) => m.id === c.id && m.role === c.role)).toBe(true);
    expect(s2.market.candidates.some((x) => x.id === c.id)).toBe(false);
    expect(s2.pendingDeltas.some((d) => d.amount === -c.signingFee)).toBe(true);
  });

  it('throws when cash is short', () => {
    const s = newGame(1);
    s.cash = 0;
    expect(() => applyAction(s, { type: 'hire', candidateId: s.market.candidates[0].id })).toThrow();
  });
});

describe('buyGame', () => {
  it('adds the game with starter tickets and removes the offer', () => {
    const s = newGame(1);
    s.cash = 10_000_000; // afford anything
    const o = s.market.offers[0];
    const s2 = applyAction(s, { type: 'buyGame', offerId: o.id });
    const g = s2.games.find((x) => x.name === o.name)!;
    expect(g.players).toBe(o.players);
    expect(s2.cash).toBe(10_000_000 - o.price);
    const starters = s2.tickets.filter((t) => t.gameId === g.id);
    expect(starters.filter((t) => t.type === 'Bug')).toHaveLength(1);
    expect(starters.filter((t) => t.type === 'Story')).toHaveLength(2);
    expect(s2.market.offers.some((x) => x.id === o.id)).toBe(false);
  });

  it('throws when cash is short', () => { const s = newGame(1); s.cash = 0; expect(() => applyAction(s, { type: 'buyGame', offerId: s.market.offers[0].id })).toThrow(); });
});

describe('startNewGame', () => {
  it('throws when cash is short', () => { const s = newGame(1); s.cash = 0; expect(() => applyAction(s, { type: 'startNewGame', genre: 'Puzzle' })).toThrow(); });

  it('creates a 0-player game with a 1.0.0 story chain', () => {
    const s = newGame(1);
    const s2 = applyAction(s, { type: 'startNewGame', genre: 'Card' });
    expect(s2.cash).toBe(s.cash - NEW_GAME_COST);
    const g = s2.games[s2.games.length - 1];
    expect(g.players).toBe(0);
    expect(g.genre).toBe('Card');
    expect(g.version).toBe('0.0.0');
    const stories = s2.tickets.filter((t) => t.gameId === g.id && t.type === 'Story');
    expect(stories).toHaveLength(NEW_GAME_STORIES);
    expect(s2.usedNames).toContain(g.name);
  });

  it('first release of a 0.0.0 game is version 1.0.0', () => {
    const s = makeState();
    s.games[0].version = '0.0.0';
    const story = addTicket(s, { status: 'QA_COMPLETE' });
    expect(computeNextVersion(s.games[0], [story])).toBe('1.0.0');
  });
});
