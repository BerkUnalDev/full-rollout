// src/engine/__tests__/techdebt-work.test.ts
import { Rng } from '../rng';
import { runDevPhase } from '../work';
import { makeState, addMember, addTicket, assignTo } from './helpers';
import { TECH_REWORK_FRACTION } from '../constants';

function buildTechDebt(skill: number, over = {}) {
  const s = makeState();
  const dev = addMember(s, 'Developer', skill);
  const t = addTicket(s, {
    type: 'Tech Debt', gameId: '', title: 'SDK Upgrade 4.2',
    effortTotal: 4, effort: 4, phaseEffort: 4, techSubtype: 'investment', benefitRevenuePct: 5,
    ...over,
  });
  assignTo(s, t, dev);
  return { s, dev, t };
}

describe('tech-debt completion', () => {
  it('a high-skill dev almost always ships it (DONE) and applies the investment benefit', () => {
    const { s, t } = buildTechDebt(5);
    const before = s.games.map((g) => g.revenuePerPlayer);
    const rng = new Rng(1);
    for (let i = 0; i < 5 && t.status !== 'DONE' && t.status !== 'TODO'; i++) runDevPhase(s, rng);
    expect(t.status).toBe('DONE');
    s.games.forEach((g, i) => expect(g.revenuePerPlayer).toBeGreaterThan(before[i]));
    expect(s.pendingEvents.some((e) => e.includes('shipped'))).toBe(true);
  });

  it('a low-skill dev can fail: ticket bounces to TODO with rework + penalty + event', () => {
    // skill 1 → ~41% fail; find a seed that fails on first completion
    let found = false;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const { s, t } = buildTechDebt(1, { effortTotal: 2, effort: 2, phaseEffort: 2 });
      const cashBefore = s.cash;
      const rng = new Rng(seed);
      for (let i = 0; i < 6 && t.status === 'IN_DEVELOPMENT'; i++) runDevPhase(s, rng);
      if (t.status === 'TODO') {
        found = true;
        expect(t.effort).toBe(Math.max(1, Math.ceil(t.effortTotal * TECH_REWORK_FRACTION)));
        expect(t.assigneeId).toBeNull();
        expect(s.cash).toBeLessThan(cashBefore);
        expect(s.pendingEvents.some((e) => e.includes('technical error'))).toBe(true);
      }
    }
    expect(found).toBe(true);
  });

  it('mandatory success clears the deadline', () => {
    const { s, t } = buildTechDebt(5, { techSubtype: 'mandatory', benefitRevenuePct: undefined, deadlineWeek: 3 });
    const rng = new Rng(1);
    for (let i = 0; i < 5 && t.status === 'IN_DEVELOPMENT'; i++) runDevPhase(s, rng);
    expect(t.status).toBe('DONE');
    expect(t.deadlineWeek).toBeNull();
  });

  it('story/bug completion is unchanged (goes to AWAITING_QA)', () => {
    const s = makeState();
    const dev = addMember(s, 'Developer', 3);
    const t = addTicket(s, { effortTotal: 4, effort: 4, phaseEffort: 4 }); // default Story
    assignTo(s, t, dev);
    for (let i = 0; i < 3 && t.status === 'IN_DEVELOPMENT'; i++) runDevPhase(s, new Rng(1));
    expect(t.status).toBe('AWAITING_QA');
  });
});
