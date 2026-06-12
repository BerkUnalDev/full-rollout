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

  it('reassigning a busy dev returns the old ticket to TODO, progress kept', () => {
    const s = newGame(1);
    const [t1, t2] = s.tickets;
    const dev = devOf(s);
    let st = applyAction(s, { type: 'assign', ticketKey: t1.key, memberId: dev.id });
    st.tickets.find((x) => x.key === t1.key)!.pointsWorked = 2; // simulate prior work
    st = applyAction(st, { type: 'assign', ticketKey: t2.key, memberId: dev.id });
    const old = st.tickets.find((x) => x.key === t1.key)!;
    expect(old.assigneeId).toBeNull();
    expect(old.status).toBe('TODO'); // unassigned work always returns to the queue
    expect(old.pointsWorked).toBe(2); // progress survives
    expect(st.team.find((m) => m.id === dev.id)!.ticketKey).toBe(t2.key);
  });

  it('unassign always returns a dev ticket to TODO, progress kept', () => {
    const s = newGame(1);
    const t = s.tickets[0];
    const dev = devOf(s);
    let st = applyAction(s, { type: 'assign', ticketKey: t.key, memberId: dev.id });
    st.tickets.find((x) => x.key === t.key)!.pointsWorked = 3; // simulate a week of work
    st = applyAction(st, { type: 'unassign', ticketKey: t.key });
    const t2 = st.tickets.find((x) => x.key === t.key)!;
    expect(t2.status).toBe('TODO');
    expect(t2.assigneeId).toBeNull();
    expect(t2.pointsWorked).toBe(3);
  });

  it('QA assignment moves AWAITING_QA to IN_QA and unassign returns it', () => {
    const s = newGame(1);
    const qa = s.team.find((m) => m.role === 'QA')!;
    const t = s.tickets[0];
    t.status = 'AWAITING_QA';
    t.effort = 0;
    let st = applyAction(s, { type: 'assign', ticketKey: t.key, memberId: qa.id });
    let t2 = st.tickets.find((x) => x.key === t.key)!;
    expect(t2.status).toBe('IN_QA');
    expect(t2.qaEffort).toBeGreaterThan(0);
    expect(st.team.find((m) => m.id === qa.id)!.ticketKey).toBe(t.key);
    st = applyAction(st, { type: 'unassign', ticketKey: t.key });
    t2 = st.tickets.find((x) => x.key === t.key)!;
    expect(t2.status).toBe('AWAITING_QA');
    expect(t2.assigneeId).toBeNull();
  });

  it('reassigning a busy QA returns their old ticket to AWAITING_QA', () => {
    const s = newGame(1);
    const qa = s.team.find((m) => m.role === 'QA')!;
    const [t1, t2] = s.tickets;
    t1.status = 'AWAITING_QA';
    t2.status = 'AWAITING_QA';
    let st = applyAction(s, { type: 'assign', ticketKey: t1.key, memberId: qa.id });
    st = applyAction(st, { type: 'assign', ticketKey: t2.key, memberId: qa.id });
    expect(st.tickets.find((x) => x.key === t1.key)!.status).toBe('AWAITING_QA');
    expect(st.tickets.find((x) => x.key === t2.key)!.status).toBe('IN_QA');
    expect(st.team.find((m) => m.id === qa.id)!.ticketKey).toBe(t2.key);
  });

  it('rejects role/status mismatches and unknown tickets', () => {
    const s = newGame(1);
    const qa = s.team.find((m) => m.role === 'QA')!;
    const rm = s.team.find((m) => m.role === 'Release Manager')!;
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: s.tickets[0].key, memberId: qa.id }),
    ).toThrow(); // QA can't take a TODO ticket
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: s.tickets[0].key, memberId: rm.id }),
    ).toThrow(); // RMs never take tickets
    const t = s.tickets[1];
    t.status = 'AWAITING_QA';
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: t.key, memberId: devOf(s).id }),
    ).toThrow(); // devs can't take a QA-phase ticket
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: 'GIM-999', memberId: devOf(s).id }),
    ).toThrow();
  });
});
