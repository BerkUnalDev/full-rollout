// src/engine/__tests__/actions.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import type { GameState } from '../types';

function devOf(s: GameState, i = 0) {
  return s.team.filter((m) => m.role === 'Developer')[i];
}

describe('assign / unassign', () => {
  it('assigns a dev and moves the TODO ticket to IN_DEVELOPMENT', () => {
    const s = newGame(1);
    const t = s.tickets[0];
    const dev = devOf(s);
    const s2 = applyAction(s, { type: 'assign', ticketKey: t.key, memberId: dev.id });
    const t2 = s2.tickets.find((x) => x.key === t.key)!;
    expect(t2.status).toBe('IN_DEVELOPMENT');
    expect(t2.assigneeId).toBe(dev.id);
    expect(s2.team.find((m) => m.id === dev.id)!.ticketKey).toBe(t.key);
    // input state untouched
    expect(s.tickets[0].status).toBe('TODO');
  });

  it('reassigning a busy dev frees the old ticket but keeps its progress state', () => {
    const s = newGame(1);
    const [t1, t2] = s.tickets;
    const dev = devOf(s);
    let st = applyAction(s, { type: 'assign', ticketKey: t1.key, memberId: dev.id });
    st = applyAction(st, { type: 'assign', ticketKey: t2.key, memberId: dev.id });
    const old = st.tickets.find((x) => x.key === t1.key)!;
    expect(old.assigneeId).toBeNull();
    expect(st.team.find((m) => m.id === dev.id)!.ticketKey).toBe(t2.key);
  });

  it('unassign returns a no-progress ticket to TODO', () => {
    const s = newGame(1);
    const t = s.tickets[0];
    const dev = devOf(s);
    let st = applyAction(s, { type: 'assign', ticketKey: t.key, memberId: dev.id });
    st = applyAction(st, { type: 'unassign', ticketKey: t.key });
    const t2 = st.tickets.find((x) => x.key === t.key)!;
    expect(t2.status).toBe('TODO');
    expect(t2.assigneeId).toBeNull();
  });

  it('rejects assigning non-developers or wrong ticket states', () => {
    const s = newGame(1);
    const qa = s.team.find((m) => m.role === 'QA')!;
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: s.tickets[0].key, memberId: qa.id }),
    ).toThrow();
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: 'GIM-999', memberId: devOf(s).id }),
    ).toThrow();
  });
});
