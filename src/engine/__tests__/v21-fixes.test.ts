// src/engine/__tests__/v21-fixes.test.ts — regressions from the v2.1 engine review
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { endWeek } from '../endWeek';
import { generateInboxItem, checkDeadlines } from '../inbox';
import { makeState } from './helpers';

describe('selling every game does not crash endWeek (0-game inbox generation)', () => {
  it('survives a week with an empty portfolio (only tech-debt is generated)', () => {
    let s = newGame(1);
    for (const g of [...s.games]) s = applyAction(s, { type: 'sellGame', gameId: g.id });
    expect(s.games.length).toBe(0);
    const s2 = endWeek(s); // previously threw "pick: empty array"
    expect(s2.weekIndex).toBe(s.weekIndex + 1);
    // items generated THIS week (weekCreated === new weekIndex) had no games to
    // attach to, so they must all be studio-wide tech-debt
    const generatedThisWeek = s2.inbox.filter((it) => it.weekCreated === s2.weekIndex);
    expect(generatedThisWeek.length).toBeGreaterThan(0);
    for (const it of generatedThisWeek) expect(it.kind).toBe('techdebt');
  });
});

describe('accepted investment tech-debt is fined if unfinished by its deadline', () => {
  it('copies the deadline onto the ticket and fines it (matches the mandatory rule)', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(2), 'techdebt', undefined, 'investment');
    item.requiredLevel = 1;
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const ticket = s2.tickets.find((t) => t.type === 'Tech Debt')!;
    expect(ticket.deadlineWeek).toBe(item.deadlineWeek); // deadline carried over (was null before the fix)
    s2.weekIndex = item.deadlineWeek! + 1;
    const cash = s2.cash;
    checkDeadlines(s2);
    expect(s2.cash).toBeLessThan(cash); // investment work is fined when missed, just like mandatory
  });
});
