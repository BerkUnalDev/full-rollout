// src/engine/__tests__/v21-celebration.test.ts
import { Rng } from '../rng';
import { applyAction } from '../actions';
import { generateInboxItem } from '../inbox';
import { makeState } from './helpers';
import type { Release } from '../types';

describe('featuring celebration', () => {
  it('sets state.celebration when a full rollout pays out a featuring', () => {
    const s = makeState();
    const g = s.games[0];
    // accept a featuring opportunity for g
    const opp = generateInboxItem(s, new Rng(1), 'opportunity', g.id);
    opp.deadlineWeek = s.weekIndex + 3;
    s.inbox.push(opp);
    let st = applyAction(s, { type: 'acceptInbox', itemId: opp.id });
    // craft a decidable soft release for g
    const r: Release = {
      id: 'rel-feat', gameId: g.id, version: '9.9.0', cwLabel: 'CW 24/2026', ticketKeys: [],
      releaseTicketKey: 'GIM-9', quality: 80, missedBugs: 0, impact: { revenuePct: 5, ratingBonus: 0.1 },
      status: 'soft', shippedWeek: 0,
      reportCard: { happiness: 'liked', bugReports: 0, revenueImpactPct: 10, ratingDelta: 0.3 }, decision: null,
    };
    st.releases.push(r);
    const s2 = applyAction(st, { type: 'fullRollout', releaseId: r.id });
    expect(s2.celebration).not.toBeNull();
    expect(s2.celebration!.title).toContain(g.name);
  });
});
