// src/engine/__tests__/save.test.ts
import { newGame } from '../newGame';
import { endWeek } from '../endWeek';
import { applyAction } from '../actions';
import { canCutRelease } from '../releases';
import { deserialize, serialize } from '../save';
import type { GameState, PlanAction } from '../types';

describe('save/load', () => {
  it('roundtrips a fresh and a played state', () => {
    const fresh = newGame(1);
    expect(deserialize(serialize(fresh))).toEqual(fresh);
    const played = endWeek(endWeek(fresh));
    expect(deserialize(serialize(played))).toEqual(played);
  });

  it('roundtrips a state carrying arrived report cards (JSON drops -0)', () => {
    // Autopilot far enough that at least one release has a report card —
    // report-card fields are where -0 used to sneak in via rounding.
    let s: GameState = newGame(7);
    const safe = (a: PlanAction) => {
      try { s = applyAction(s, a); } catch { /* not valid this week */ }
    };
    for (let w = 0; w < 10 && s.status === 'playing'; w++) {
      for (const item of s.inbox.filter((i) => i.status === 'pending')) {
        safe({ type: 'acceptInbox', itemId: item.id });
      }
      for (const dev of s.team.filter((m) => m.role === 'Developer' && !m.ticketKey)) {
        const todo = s.tickets.find((t) => t.status === 'TODO');
        if (todo) safe({ type: 'assign', ticketKey: todo.key, memberId: dev.id });
      }
      for (const qa of s.team.filter((m) => m.role === 'QA' && !m.ticketKey)) {
        const waiting = s.tickets.find((t) => t.status === 'AWAITING_QA');
        if (waiting) safe({ type: 'assign', ticketKey: waiting.key, memberId: qa.id });
      }
      for (const g of s.games) {
        if (canCutRelease(s, g.id).ok) safe({ type: 'cutRelease', gameId: g.id });
      }
      s = endWeek(s);
    }
    expect(s.releases.some((r) => r.reportCard)).toBe(true);
    expect(deserialize(serialize(s))).toEqual(s);
  });

  it('rejects corrupt JSON', () => {
    expect(deserialize('{not json')).toBeNull();
    expect(deserialize('')).toBeNull();
    expect(deserialize('{"hello":1}')).toBeNull();
  });

  it('rejects other schema versions', () => {
    const s = newGame(1);
    const tampered = serialize(s).replace(/"v":\d+/, '"v":999');
    expect(deserialize(tampered)).toBeNull();
  });

  it('roundtrips studioLevel and reportHistory', () => {
    let s = newGame(2);
    s = endWeek(s); // populate reportHistory
    s.studioLevel = 3;
    const back = deserialize(serialize(s))!;
    expect(back.studioLevel).toBe(3);
    expect(back.reportHistory).toEqual(s.reportHistory);
  });

  it('rejects a save missing v2 fields', () => {
    const s = newGame(1);
    const bad = JSON.parse(serialize(s));
    delete bad.state.studioLevel;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });
});
