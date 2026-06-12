// src/engine/__tests__/quality.test.ts
import { Rng } from '../rng';
import { clamp, computeQuality, deriveReportCard } from '../quality';
import { makeState, addTicket } from './helpers';
import type { Release } from '../types';

function fakeRelease(over: Partial<Release> = {}): Release {
  return {
    id: 'r1', gameId: 'g1', version: '1.1.0', cwLabel: 'CW 24/2026',
    ticketKeys: [], quality: 70, missedBugs: 0,
    impact: { revenuePct: 10, ratingBonus: 0.2 },
    status: 'soft', shippedWeek: 0, reportCard: null, decision: null,
    releaseTicketKey: 'GIM-99',
    ...over,
  };
}

describe('computeQuality', () => {
  it('high-skill clean work scores high; missed bugs crater it', () => {
    const s = makeState();
    const game = s.games[0];
    const clean = addTicket(s, {
      status: 'QA_COMPLETE', pointsWorked: 8, devSkillSum: 40, hiddenBugs: 0, // avg skill 5
    });
    const r1 = computeQuality([clean], game, new Rng(1));
    expect(r1.quality).toBeGreaterThanOrEqual(75);
    expect(r1.missedBugs).toBe(0);

    const buggy = addTicket(s, {
      status: 'QA_COMPLETE', pointsWorked: 8, devSkillSum: 16, hiddenBugs: 2, // avg skill 2
    });
    const r2 = computeQuality([buggy], game, new Rng(1));
    expect(r2.missedBugs).toBe(2);
    expect(r2.quality).toBeLessThan(50);
  });

  it('is deterministic per seed and clamped to [0, 100]', () => {
    const s = makeState();
    const t = addTicket(s, { pointsWorked: 4, devSkillSum: 4, hiddenBugs: 6 });
    const a = computeQuality([t], s.games[0], new Rng(5));
    const b = computeQuality([t], s.games[0], new Rng(5));
    expect(a).toEqual(b);
    expect(a.quality).toBeGreaterThanOrEqual(0);
    expect(a.quality).toBeLessThanOrEqual(100);
  });
});

describe('deriveReportCard', () => {
  it('maps quality to happiness tiers', () => {
    expect(deriveReportCard(fakeRelease({ quality: 80 }), new Rng(1)).happiness).toBe('loved');
    expect(deriveReportCard(fakeRelease({ quality: 65 }), new Rng(1)).happiness).toBe('liked');
    expect(deriveReportCard(fakeRelease({ quality: 50 }), new Rng(1)).happiness).toBe('meh');
    expect(deriveReportCard(fakeRelease({ quality: 30 }), new Rng(1)).happiness).toBe('hated');
  });

  it('amplifies missed bugs into bug reports', () => {
    const card = deriveReportCard(fakeRelease({ missedBugs: 3 }), new Rng(2));
    // 3 × [1.5, 3.5) rounded → [5, 10]
    expect(card.bugReports).toBeGreaterThanOrEqual(5);
    expect(card.bugReports).toBeLessThanOrEqual(10);
  });

  it('caps rating delta and revenue impact', () => {
    const great = deriveReportCard(fakeRelease({ quality: 100, impact: { revenuePct: 40, ratingBonus: 1 } }), new Rng(3));
    expect(great.ratingDelta).toBe(0.6);
    expect(great.revenueImpactPct).toBeLessThanOrEqual(40);
    const awful = deriveReportCard(fakeRelease({ quality: 0, impact: { revenuePct: 0, ratingBonus: 0 } }), new Rng(3));
    expect(awful.ratingDelta).toBe(-0.6);
    expect(awful.revenueImpactPct).toBeGreaterThanOrEqual(-20);
  });
});

describe('clamp', () => {
  it('clamps to the inclusive range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});
