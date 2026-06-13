// v2.1 balance/fairness fixes (from playtest feedback)
import { Rng } from '../rng';
import { generateInboxItem, checkDeadlines } from '../inbox';
import { makeState } from './helpers';

describe('locked tech-debt is not fined — you could not accept it', () => {
  it('a pending tech-debt above your studio level expires with NO fine', () => {
    const s = makeState(); // studioLevel 1
    const item = generateInboxItem(s, new Rng(1), 'techdebt');
    item.requiredLevel = 5; // far above level 1 → locked, impossible to accept
    item.deadlineWeek = s.weekIndex;
    s.inbox.push(item);
    s.weekIndex += 1; // deadline now passed
    const cash = s.cash;
    checkDeadlines(s);
    expect(s.cash).toBe(cash); // NOT fined
    expect(s.inbox.find((i) => i.id === item.id)!.status).toBe('done'); // expired quietly
  });

  it('an acceptable (≤ level) tech-debt you ignored IS still fined', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(2), 'techdebt');
    item.requiredLevel = 1; // doable at level 1 → ignoring it is on you
    item.deadlineWeek = s.weekIndex;
    s.inbox.push(item);
    s.weekIndex += 1;
    const cash = s.cash;
    checkDeadlines(s);
    expect(s.cash).toBe(cash - item.fineUsd!);
  });
});

describe('no identical-named tickets are generated', () => {
  it('25 bugs for one game all get unique titles', () => {
    const s = makeState();
    const g = s.games[0];
    for (let i = 0; i < 25; i++) s.inbox.push(generateInboxItem(s, new Rng(100 + i), 'bug', g.id));
    const titles = s.inbox.filter((i) => i.kind === 'bug').map((i) => i.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('features dedupe against existing tickets too', () => {
    const s = makeState();
    const g = s.games[0];
    for (let i = 0; i < 20; i++) s.inbox.push(generateInboxItem(s, new Rng(200 + i), 'feature', g.id));
    const titles = s.inbox.filter((i) => i.kind === 'feature').map((i) => i.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('tech-debt is not all far-future levels', () => {
  it('a meaningful fraction is doable at the current level even late-game', () => {
    const s = makeState();
    s.studioLevel = 3;
    s.weekIndex = 40;
    let accessible = 0;
    for (let i = 0; i < 400; i++) {
      if ((generateInboxItem(s, new Rng(i), 'techdebt').requiredLevel ?? 1) <= s.studioLevel) accessible++;
    }
    expect(accessible).toBeGreaterThan(80); // ~accessibleChance, not ~0
  });
});
