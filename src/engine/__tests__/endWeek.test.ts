// src/engine/__tests__/endWeek.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { endWeek } from '../endWeek';
import { canCutRelease } from '../releases';
import type { GameState, PlanAction } from '../types';

/** Scripted autopilot: assign idle devs, accept everything, cut & roll out whenever possible. */
function autopilotWeek(s: GameState): GameState {
  let st = s;
  const safe = (a: PlanAction) => {
    try { st = applyAction(st, a); } catch { /* invalid this week — skip */ }
  };
  for (const item of st.inbox.filter((i) => i.status === 'pending')) {
    safe({ type: 'acceptInbox', itemId: item.id });
  }
  for (const dev of st.team.filter((m) => m.role === 'Developer' && !m.ticketKey)) {
    const todo = st.tickets.find((t) => t.status === 'TODO');
    if (todo) safe({ type: 'assign', ticketKey: todo.key, memberId: dev.id });
  }
  for (const r of st.releases.filter((x) => x.status === 'soft' && x.reportCard)) {
    safe({ type: 'fullRollout', releaseId: r.id });
  }
  for (const g of st.games) {
    if (canCutRelease(st, g.id).ok) safe({ type: 'cutRelease', gameId: g.id });
  }
  return endWeek(st);
}

describe('endWeek', () => {
  it('advances the week and produces a weekly report', () => {
    const s = newGame(3);
    const s2 = endWeek(s);
    expect(s2.weekIndex).toBe(1);
    expect(s2.lastReport).not.toBeNull();
    expect(s2.lastReport!.cwLabel).toBe('CW 24/2026');
    expect(s2.lastReport!.deltas.some((d) => d.label === 'Salaries')).toBe(true);
    expect(s2.pendingDeltas).toEqual([]);
    expect(s2.inbox.length).toBeGreaterThan(s.inbox.length); // new weekly events
    expect(s).not.toBe(s2); // pure
  });

  it('rolls the calendar year over after CW 52', () => {
    let s = newGame(4);
    s = { ...s, weekIndex: 28 }; // CW 52/2026
    const s2 = endWeek(s);
    expect(s2.lastReport!.cwLabel).toBe('CW 52/2026');
    expect(s2.weekIndex).toBe(29); // CW 1/2027
  });

  it('a 12-week autopilot run is deterministic and ships at least one release', () => {
    const play = () => {
      let s = newGame(7);
      for (let w = 0; w < 12 && s.status === 'playing'; w++) s = autopilotWeek(s);
      return s;
    };
    const a = play();
    const b = play();
    expect(a).toEqual(b);
    expect(a.weekIndex).toBeGreaterThan(0);
    expect(a.releases.length).toBeGreaterThanOrEqual(1);
    expect(a.releases.some((r) => r.decision === 'full')).toBe(true);
    expect(Number.isFinite(a.cash)).toBe(true);
  });

  it('declares bankruptcy when cash dips below zero', () => {
    let s = newGame(8);
    s = { ...s, cash: 100 };
    for (const g of s.games) g.players = 0; // no revenue
    const s2 = endWeek(s);
    expect(s2.cash).toBeLessThan(0);
    expect(s2.status).toBe('bankrupt');
    expect(() => endWeek(s2)).toThrow();
    expect(() => applyAction(s2, { type: 'startNewGame', genre: 'Puzzle' })).toThrow();
  });
});
