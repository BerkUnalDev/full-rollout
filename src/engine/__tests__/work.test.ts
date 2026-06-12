// src/engine/__tests__/work.test.ts
import { Rng } from '../rng';
import { runDevPhase } from '../work';
import { makeState, addMember, addTicket, assignTo } from './helpers';

describe('runDevPhase', () => {
  it('applies speed points per week and finishes into AWAITING_QA', () => {
    const s = makeState();
    const dev = addMember(s, 'Developer', 3); // speed 4
    const t = addTicket(s, { effortTotal: 8, effort: 8, phaseEffort: 8 });
    assignTo(s, t, dev);
    const rng = new Rng(1);

    runDevPhase(s, rng);
    expect(t.effort).toBe(4);
    expect(t.status).toBe('IN_DEVELOPMENT');
    expect(t.pointsWorked).toBe(4);
    expect(t.devSkillSum).toBe(12); // 4 points × skill 3

    runDevPhase(s, rng);
    expect(t.status).toBe('AWAITING_QA');
    expect(t.assigneeId).toBeNull();
    expect(dev.ticketKey).toBeNull();
  });

  it('injects hidden bugs on completion, more for low-skill devs', () => {
    // skill 1 dev, effort 8: expected bugs = 8 × 5 × 0.04 = 1.6 → 1 or 2
    const s = makeState();
    const dev = addMember(s, 'Developer', 1); // speed 2
    const t = addTicket(s, { effortTotal: 8, effort: 8, phaseEffort: 8 });
    assignTo(s, t, dev);
    const rng = new Rng(7);
    for (let i = 0; i < 4; i++) runDevPhase(s, rng);
    expect(t.status).toBe('AWAITING_QA');
    expect([1, 2]).toContain(t.hiddenBugs);
  });

  it('is deterministic for the same rng seed', () => {
    const run = () => {
      const s = makeState();
      const dev = addMember(s, 'Developer', 2);
      const t = addTicket(s, { effortTotal: 6, effort: 6, phaseEffort: 6 });
      assignTo(s, t, dev);
      const rng = new Rng(42);
      runDevPhase(s, rng);
      runDevPhase(s, rng);
      return { bugs: t.hiddenBugs, status: t.status, rngState: rng.state };
    };
    expect(run()).toEqual(run());
  });

  it('ignores devs with dangling assignments', () => {
    const s = makeState();
    const dev = addMember(s, 'Developer', 3);
    dev.ticketKey = 'GIM-9999'; // ticket does not exist
    expect(() => runDevPhase(s, new Rng(1))).not.toThrow();
    expect(dev.ticketKey).toBeNull();

    const t = addTicket(s, { status: 'AWAITING_QA' });
    dev.ticketKey = t.key; // stale pointer to a non-dev-phase ticket
    expect(() => runDevPhase(s, new Rng(1))).not.toThrow();
    expect(dev.ticketKey).toBeNull();
  });
});
