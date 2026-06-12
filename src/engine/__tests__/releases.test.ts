// src/engine/__tests__/releases.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { arriveReports, canCutRelease, computeNextVersion, shipCuttingReleases } from '../releases';
import { Rng } from '../rng';
import { makeState, addTicket } from './helpers';
import type { GameState } from '../types';

function withQaComplete(s: GameState, gameId: string, type: 'Story' | 'Bug' = 'Story') {
  return addTicket(s, {
    type, gameId, status: 'QA_COMPLETE', pointsWorked: 6, devSkillSum: 18, hiddenBugs: 0,
    impact: { revenuePct: 8, ratingBonus: 0.1 },
  });
}

describe('canCutRelease / cutRelease', () => {
  it('requires QA-complete tickets', () => {
    const s = newGame(1);
    const g = s.games[0];
    expect(canCutRelease(s, g.id).ok).toBe(false);
    withQaComplete(s, g.id);
    expect(canCutRelease(s, g.id)).toMatchObject({ ok: true });
  });

  it('bumps minor for stories, patch for bug-only', () => {
    const s = makeState();
    const g = s.games[0]; // version 2.4.1
    const story = withQaComplete(s, g.id, 'Story');
    expect(computeNextVersion(g, [story])).toBe('2.5.0');
    const bug = withQaComplete(s, g.id, 'Bug');
    expect(computeNextVersion(g, [bug])).toBe('2.4.2');
  });

  it('cutRelease creates the release + GIM-style release ticket and consumes pendingImpact', () => {
    const s = makeState();
    const g = s.games[0];
    g.pendingImpact = { revenuePct: 5, ratingBonus: 0.1 };
    withQaComplete(s, g.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g.id });
    expect(s2.releases).toHaveLength(1);
    const r = s2.releases[0];
    expect(r.status).toBe('cutting');
    expect(r.version).toBe('2.5.0');
    expect(r.impact.revenuePct).toBeCloseTo(13, 5); // 8 + 5 pending
    expect(s2.games[0].pendingImpact.revenuePct).toBe(0);
    const rt = s2.tickets.find((t) => t.key === r.releaseTicketKey)!;
    expect(rt.type).toBe('Release Ticket');
    expect(rt.title).toBe(`${g.name} - CW 24/2026 / 2.5.0`);
    expect(rt.status).toBe('IN_DEVELOPMENT');
  });

  it('enforces RM capacity and one in-flight release per game', () => {
    const s = makeState(); // 1 RM
    const [g1, g2] = s.games;
    withQaComplete(s, g1.id);
    withQaComplete(s, g2.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g1.id });
    expect(() => applyAction(s2, { type: 'cutRelease', gameId: g1.id })).toThrow(); // in-flight
    expect(canCutRelease(s2, g2.id).ok).toBe(false); // RM busy
    expect(() => applyAction(s2, { type: 'cutRelease', gameId: g2.id })).toThrow();
  });
});

describe('ship & report arrival', () => {
  it('shipping moves tickets to DONE and the release to soft', () => {
    const s = makeState();
    const g = s.games[0];
    const t = withQaComplete(s, g.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g.id });
    shipCuttingReleases(s2);
    const r = s2.releases[0];
    expect(r.status).toBe('soft');
    expect(r.shippedWeek).toBe(s2.weekIndex);
    expect(s2.tickets.find((x) => x.key === t.key)!.status).toBe('DONE');
    expect(s2.tickets.find((x) => x.key === r.releaseTicketKey)!.status).toBe('DONE');
  });

  it('report cards arrive only for releases shipped in an earlier week', () => {
    const s = makeState();
    const g = s.games[0];
    withQaComplete(s, g.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g.id });
    shipCuttingReleases(s2);
    const rng = new Rng(1);
    expect(arriveReports(s2, rng)).toEqual([]); // same week → nothing
    s2.weekIndex += 1;
    const arrived = arriveReports(s2, rng);
    expect(arrived).toHaveLength(1);
    expect(s2.releases[0].reportCard).not.toBeNull();
  });
});
