// src/engine/__tests__/rm-capacity.test.ts
import { canCutRelease } from '../releases';
import { applyAction } from '../actions';
import { makeState, addMember, addTicket } from './helpers';
import type { GameState } from '../types';

function readyTicket(s: GameState, gameId: string) {
  return addTicket(s, {
    gameId, status: 'QA_COMPLETE', pointsWorked: 6, devSkillSum: 18, hiddenBugs: 0,
    impact: { revenuePct: 8, ratingBonus: 0.1 },
  });
}

describe('RM capacity = Σ stars', () => {
  it('a single skill-3 RM allows up to 3 simultaneous cuts', () => {
    const s = makeState();
    s.team = s.team.filter((m) => m.role !== 'Release Manager');
    addMember(s, 'Release Manager', 3); // 3 stars → capacity 3
    // need 3 distinct games with QA-complete work; makeState has 2, add a third
    const g3 = { ...s.games[0], id: 'g-extra', name: 'Extra Game' };
    s.games.push(g3);
    for (const g of s.games) readyTicket(s, g.id);
    let st = applyAction(s, { type: 'cutRelease', gameId: s.games[0].id });
    st = applyAction(st, { type: 'cutRelease', gameId: s.games[1].id });
    expect(canCutRelease(st, s.games[2].id).ok).toBe(true); // 2 cutting < 3 capacity
    st = applyAction(st, { type: 'cutRelease', gameId: s.games[2].id });
    expect(st.releases.filter((r) => r.status === 'cutting').length).toBe(3);
  });

  it('blocks once cutting count reaches total RM stars', () => {
    const s = makeState();
    s.team = s.team.filter((m) => m.role !== 'Release Manager');
    addMember(s, 'Release Manager', 1); // capacity 1
    for (const g of s.games) readyTicket(s, g.id);
    const st = applyAction(s, { type: 'cutRelease', gameId: s.games[0].id });
    expect(canCutRelease(st, s.games[1].id).ok).toBe(false);
  });
});
