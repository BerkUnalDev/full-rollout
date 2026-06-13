// src/engine/__tests__/inbox.test.ts
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { checkDeadlines, generateWeeklyInbox } from '../inbox';
import { generateInboxItem } from '../inbox';
import { TECHDEBT_FINE } from '../constants';

const SDK_FINE_EXPECTED = TECHDEBT_FINE;
import { makeState } from './helpers';

describe('accept / decline', () => {
  it('accepting a feature creates a Story carrying hidden actual impact', () => {
    const s = newGame(1);
    const item = s.inbox.find((i) => i.kind === 'feature')!;
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const t = s2.tickets.find((x) => x.title === item.title)!;
    expect(t.type).toBe('Story');
    expect(t.predictedImpact).toEqual(item.predictedImpact);
    expect(t.impact).toEqual(item.actualImpact);
    expect(s2.inbox.find((i) => i.id === item.id)!.status).toBe('accepted');
  });

  it('declining a bug dents the rating, escalating with repetition', () => {
    const s = makeState();
    const rng = new Rng(9);
    const i1 = generateInboxItem(s, rng, 'bug', s.games[0].id);
    const i2 = generateInboxItem(s, rng, 'bug', s.games[0].id);
    s.inbox.push(i1, i2);
    const r0 = s.games[0].rating;
    const s2 = applyAction(s, { type: 'declineInbox', itemId: i1.id });
    const drop1 = r0 - s2.games[0].rating;
    const s3 = applyAction(s2, { type: 'declineInbox', itemId: i2.id });
    const drop2 = s2.games[0].rating - s3.games[0].rating;
    expect(drop1).toBeGreaterThan(0);
    expect(drop2).toBeGreaterThan(drop1); // escalation
  });

  it('handled items cannot be handled twice', () => {
    const s = newGame(1);
    const item = s.inbox[0];
    const s2 = applyAction(s, { type: 'declineInbox', itemId: item.id });
    expect(() => applyAction(s2, { type: 'acceptInbox', itemId: item.id })).toThrow();
  });
});

describe('deadlines', () => {
  it('fines a declined mandatory tech-debt item once when the deadline passes', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(1), 'techdebt', undefined, 'mandatory');
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'declineInbox', itemId: item.id });
    s2.weekIndex = item.deadlineWeek! + 1;
    const cash = s2.cash;
    checkDeadlines(s2);
    expect(s2.cash).toBe(cash - SDK_FINE_EXPECTED);
    checkDeadlines(s2); // no double fine
    expect(s2.cash).toBe(cash - SDK_FINE_EXPECTED);
  });

  it('fines an accepted-but-unfinished mandatory tech-debt ticket at the deadline', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(2), 'techdebt', undefined, 'mandatory');
    item.requiredLevel = 1;
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const task = s2.tickets.find((t) => t.type === 'Tech Debt')!;
    expect(task.deadlineWeek).toBe(item.deadlineWeek);
    s2.weekIndex = item.deadlineWeek! + 1;
    const cash = s2.cash;
    checkDeadlines(s2);
    expect(s2.cash).toBe(cash - SDK_FINE_EXPECTED);
    expect(s2.tickets.find((t) => t.type === 'Tech Debt')!.deadlineWeek).toBeNull();
  });

  it('expires stale opportunities', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(3), 'opportunity');
    s.inbox.push(item);
    s.weekIndex = item.deadlineWeek! + 1;
    checkDeadlines(s);
    expect(s.inbox.find((i) => i.id === item.id)!.status).toBe('done');
  });
});

describe('generateWeeklyInbox', () => {
  it('adds 1-3 pending items deterministically', () => {
    const run = () => {
      const s = newGame(5);
      const before = s.inbox.length;
      generateWeeklyInbox(s, new Rng(5));
      return s.inbox.slice(before).map((i) => i.kind + i.title);
    };
    const a = run();
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(a).toEqual(run());
  });
});
