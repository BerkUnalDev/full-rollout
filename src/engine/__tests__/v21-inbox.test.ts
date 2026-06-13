// src/engine/__tests__/v21-inbox.test.ts
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { generateInboxItem, generateWeeklyInbox, declineInboxItem } from '../inbox';
import { FEATURING_ACCEPT_COST, TECHDEBT_DEADLINE_WEEKS, FEATURE_CAP_PER_GAME } from '../constants';
import { makeState } from './helpers';

describe('tech-debt deadlines + no decline', () => {
  it('both subtypes carry a deadline and fine', () => {
    const s = makeState(); s.weekIndex = 20;
    const inv = generateInboxItem(s, new Rng(1), 'techdebt', undefined, 'investment');
    const man = generateInboxItem(s, new Rng(2), 'techdebt', undefined, 'mandatory');
    expect(inv.deadlineWeek).toBe(s.weekIndex + TECHDEBT_DEADLINE_WEEKS);
    expect(inv.fineUsd).toBeGreaterThan(0);
    expect(man.deadlineWeek).toBe(s.weekIndex + TECHDEBT_DEADLINE_WEEKS);
  });
  it('tech-debt cannot be declined', () => {
    const s = makeState(); s.weekIndex = 20;
    const item = generateInboxItem(s, new Rng(3), 'techdebt');
    item.requiredLevel = 1; s.inbox.push(item);
    expect(() => declineInboxItem(s, item.id)).toThrow(/can.?t be declined|tech debt/i);
  });
});

describe('featuring accept fee', () => {
  it('accepting an opportunity costs its (scaled) accept fee', () => {
    const s = newGame(1);
    const opp = generateInboxItem(s, new Rng(4), 'opportunity');
    s.inbox.push(opp);
    expect(opp.acceptCost).toBeGreaterThanOrEqual(FEATURING_ACCEPT_COST); // scaled ≥ base
    const cash = s.cash;
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: opp.id });
    expect(s2.cash).toBe(cash - opp.acceptCost!);
    expect(s2.inbox.find((i) => i.id === opp.id)!.status).toBe('accepted');
  });
});

describe('feature cap scales with games', () => {
  it('stops generating features past games × FEATURE_CAP_PER_GAME', () => {
    const s = newGame(5);
    // saturate pending features to the cap
    const cap = s.games.length * FEATURE_CAP_PER_GAME;
    for (let i = 0; i < cap; i++) s.inbox.push(generateInboxItem(s, new Rng(100 + i), 'feature'));
    const before = s.inbox.filter((i) => i.kind === 'feature' && i.status === 'pending').length;
    for (let w = 0; w < 8; w++) generateWeeklyInbox(s, new Rng(200 + w));
    const after = s.inbox.filter((i) => i.kind === 'feature' && i.status === 'pending').length;
    expect(after).toBe(before); // never exceeds the cap (excess rolls become bugs)
  });
});

describe('tech-debt refill', () => {
  it('eventually generates tech-debt even across many weeks (never dries up)', () => {
    let s = newGame(9);
    let sawTechdebt = false;
    for (let w = 0; w < 15 && !sawTechdebt; w++) {
      generateWeeklyInbox(s, new Rng(300 + w));
      if (s.inbox.some((i) => i.kind === 'techdebt' && i.status === 'pending')) sawTechdebt = true;
    }
    expect(sawTechdebt).toBe(true);
  });
});
