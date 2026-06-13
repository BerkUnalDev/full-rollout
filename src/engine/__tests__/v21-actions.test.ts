// src/engine/__tests__/v21-actions.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { SEVERANCE_WEEKS, SELL_PRICE_WEEKS, SELL_PRICE_FLOOR } from '../constants';
import { studioGameRequirement } from '../studio';

describe('upgrade game precondition', () => {
  it('blocks upgrade until the games requirement is met', () => {
    const s = newGame(1);
    s.cash = 10_000_000; // afford the cash easily
    // L1 needs studioGameRequirement(1) games. Drop below it to prove the gate.
    s.games = s.games.slice(0, studioGameRequirement(1) - 1);
    expect(s.games.length).toBeLessThan(studioGameRequirement(1));
    expect(() => applyAction(s, { type: 'upgradeStudio' })).toThrow(/games/i);
    s.games.push({ ...s.games[0], id: 'g-x', name: 'Extra' });
    expect(s.games.length).toBe(studioGameRequirement(1));
    const s2 = applyAction(s, { type: 'upgradeStudio' });
    expect(s2.studioLevel).toBe(2);
  });
});

describe('hire role capacity', () => {
  it('blocks hiring past the per-role cap', () => {
    const s = newGame(1);
    s.cash = 10_000_000;
    // L1 Developer cap = 3; start has 2 devs. Hire devs until blocked.
    let st = s;
    const hireDev = () => {
      const c = st.market.candidates.find((x) => x.role === 'Developer');
      if (!c) { // force one onto the market
        st.market.candidates.push({ id: `d${st.nextId++}`, name: 'Dev X', role: 'Developer', skill: 3, salary: 1500, signingFee: 3000 });
      }
      const dev = st.market.candidates.find((x) => x.role === 'Developer')!;
      st = applyAction(st, { type: 'hire', candidateId: dev.id });
    };
    hireDev(); // 3rd dev → ok (cap 3)
    expect(st.team.filter((m) => m.role === 'Developer').length).toBe(3);
    // 4th dev → throws
    st.market.candidates.push({ id: 'dz', name: 'Dev Z', role: 'Developer', skill: 3, salary: 1500, signingFee: 3000 });
    expect(() => applyAction(st, { type: 'hire', candidateId: 'dz' })).toThrow(/capacity/i);
  });
});

describe('fireMember', () => {
  it('pays severance, removes the member, frees their ticket', () => {
    const s = newGame(1);
    const dev = s.team.find((m) => m.role === 'Developer')!;
    // put the dev on a ticket
    const st0 = applyAction(s, { type: 'assign', ticketKey: s.tickets[0].key, memberId: dev.id });
    const cash = st0.cash;
    const st = applyAction(st0, { type: 'fireMember', memberId: dev.id });
    expect(st.team.some((m) => m.id === dev.id)).toBe(false);
    expect(st.cash).toBe(cash - dev.salary * SEVERANCE_WEEKS);
    const t = st.tickets.find((x) => x.key === s.tickets[0].key)!;
    expect(t.assigneeId).toBeNull();
    expect(t.status).toBe('TODO');
  });
});

describe('sellGame', () => {
  it('sells a game for ~SELL_PRICE_WEEKS× weekly revenue and removes it + its tickets', () => {
    const s = newGame(1);
    const g = s.games[0];
    const weekly = Math.round(g.players * g.revenuePerPlayer);
    const expected = Math.max(SELL_PRICE_FLOOR, Math.round(weekly * SELL_PRICE_WEEKS));
    const cash = s.cash;
    const st = applyAction(s, { type: 'sellGame', gameId: g.id });
    expect(st.games.some((x) => x.id === g.id)).toBe(false);
    expect(st.tickets.some((t) => t.gameId === g.id)).toBe(false);
    expect(st.cash).toBe(cash + expected);
  });

  it('refuses to sell a game with an in-flight release', () => {
    const s = newGame(1);
    const g = s.games[0];
    s.releases.push({
      id: 'r1', gameId: g.id, version: '9.9.0', cwLabel: 'CW 24/2026', ticketKeys: [],
      releaseTicketKey: 'GIM-9', quality: 70, missedBugs: 0, impact: { revenuePct: 0, ratingBonus: 0 },
      status: 'soft', shippedWeek: 0, reportCard: null, decision: null,
    });
    expect(() => applyAction(s, { type: 'sellGame', gameId: g.id })).toThrow(/in-flight|release/i);
  });
});

describe('dismissCelebration', () => {
  it('clears the celebration', () => {
    const s = newGame(1);
    s.celebration = { title: 'x', body: 'y' };
    const st = applyAction(s, { type: 'dismissCelebration' });
    expect(st.celebration).toBeNull();
  });
});
