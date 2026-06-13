// src/engine/__tests__/techdebt-inbox.test.ts
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { generateInboxItem } from '../inbox';
import { makeState } from './helpers';

describe('tech-debt generation', () => {
  it('produces a studio-wide item with a subtype and required level', () => {
    const s = makeState();
    s.weekIndex = 20;
    const item = generateInboxItem(s, new Rng(2), 'techdebt');
    expect(item.kind).toBe('techdebt');
    expect(item.gameId).toBe('');
    expect(item.techSubtype === 'mandatory' || item.techSubtype === 'investment').toBe(true);
    expect(item.requiredLevel).toBeGreaterThanOrEqual(1);
    expect(item.effort).toBeGreaterThan(0);
    if (item.techSubtype === 'mandatory') expect(item.deadlineWeek).toBeGreaterThan(s.weekIndex);
    if (item.techSubtype === 'investment') expect(item.benefitRevenuePct).toBeGreaterThan(0);
  });

  it('can be forced to a subtype', () => {
    const s = makeState();
    s.weekIndex = 20;
    expect(generateInboxItem(s, new Rng(1), 'techdebt', undefined, 'investment').techSubtype).toBe('investment');
  });
});

describe('accept tech-debt + level gate', () => {
  it('accepting creates a studio-wide Tech Debt ticket carrying its subtype', () => {
    const s = newGame(1);
    const item = generateInboxItem(s, new Rng(7), 'techdebt', undefined, 'investment');
    item.requiredLevel = 1;
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const t = s2.tickets.find((x) => x.title === item.title)!;
    expect(t.type).toBe('Tech Debt');
    expect(t.gameId).toBe('');
    expect(t.techSubtype).toBe('investment');
    expect(t.benefitRevenuePct).toBe(item.benefitRevenuePct);
  });

  it('throws when studio level is below the item requiredLevel', () => {
    const s = newGame(1); // studioLevel 1
    const item = generateInboxItem(s, new Rng(3), 'techdebt');
    item.requiredLevel = 4;
    s.inbox.push(item);
    expect(() => applyAction(s, { type: 'acceptInbox', itemId: item.id })).toThrow(/Studio Level/i);
  });

  it('feature items are gated too, bugs are not', () => {
    const s = newGame(1);
    const feat = generateInboxItem(s, new Rng(5), 'feature');
    feat.requiredLevel = 6;
    const bug = generateInboxItem(s, new Rng(6), 'bug'); // bugs carry no requiredLevel
    s.inbox.push(feat, bug);
    expect(() => applyAction(s, { type: 'acceptInbox', itemId: feat.id })).toThrow(/Studio Level/i);
    expect(() => applyAction(s, { type: 'acceptInbox', itemId: bug.id })).not.toThrow();
  });
});
