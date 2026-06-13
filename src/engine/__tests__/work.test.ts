// src/engine/__tests__/work.test.ts
import { Rng } from '../rng';
import { runDevPhase, runQaPhase } from '../work';
import { REWORK_FRACTION } from '../constants';
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

describe('runQaPhase', () => {
  it('idle QA members do NOT pull work — testing starts when the player assigns them', () => {
    const s = makeState();
    addMember(s, 'QA', 3);
    const t = addTicket(s, { status: 'AWAITING_QA', effortTotal: 4, effort: 0, phaseEffort: 4, hiddenBugs: 0 });
    runQaPhase(s, new Rng(1));
    expect(t.status).toBe('AWAITING_QA');
    expect(t.assigneeId).toBeNull();
  });

  it('an assigned QA member can finish a small ticket the same week', () => {
    const s = makeState();
    const qa = addMember(s, 'QA', 3); // speed 4
    const t = addTicket(s, { status: 'AWAITING_QA', effortTotal: 4, effort: 0, phaseEffort: 4, hiddenBugs: 0 });
    assignTo(s, t, qa);
    expect(t.status).toBe('IN_QA');
    // qaEffort = ceil(4 × 0.5) = 2 ≤ speed 4 → resolved immediately, no bugs → QA_COMPLETE
    runQaPhase(s, new Rng(1));
    expect(t.status).toBe('QA_COMPLETE');
    expect(t.assigneeId).toBeNull();
    expect(qa.ticketKey).toBeNull();
  });

  it('clean tickets always pass (no catch rolls when hiddenBugs = 0)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = makeState();
      const qa = addMember(s, 'QA', 1);
      const t = addTicket(s, { status: 'AWAITING_QA', effortTotal: 2, hiddenBugs: 0 });
      assignTo(s, t, qa);
      for (let i = 0; i < 5 && t.status !== 'QA_COMPLETE'; i++) runQaPhase(s, new Rng(seed + i));
      expect(t.status).toBe('QA_COMPLETE');
    }
  });

  it('buggy tickets bounce back to TODO for rework, with an event line', () => {
    const s = makeState();
    const qa = addMember(s, 'QA', 5);
    const t = addTicket(s, { status: 'AWAITING_QA', effortTotal: 8, hiddenBugs: 10 });
    assignTo(s, t, qa);
    const rng = new Rng(3);
    for (let i = 0; i < 10 && t.status === 'IN_QA'; i++) runQaPhase(s, rng);
    // skill 5 catch rate is 0.95 — with 10 bugs, bouncing is the only realistic outcome
    expect(t.status).toBe('TODO');
    expect(t.assigneeId).toBeNull();
    expect(qa.ticketKey).toBeNull();
    expect(t.hiddenBugs).toBeLessThan(10);
    expect(t.effort).toBe(Math.max(1, Math.ceil(t.effortTotal * REWORK_FRACTION)));
    expect(t.phaseEffort).toBe(t.effort);
    expect(s.pendingEvents.some((e) => e.includes('sent') && e.includes('back for rework'))).toBe(true);
  });

  it('a QA member works only their own ticket', () => {
    const s = makeState();
    const qa = addMember(s, 'QA', 5); // fast
    const t1 = addTicket(s, { status: 'AWAITING_QA', effortTotal: 2, hiddenBugs: 0 });
    const t2 = addTicket(s, { status: 'AWAITING_QA', effortTotal: 2, hiddenBugs: 0 });
    assignTo(s, t1, qa);
    runQaPhase(s, new Rng(1));
    expect(t1.status).toBe('QA_COMPLETE');
    expect(t2.status).toBe('AWAITING_QA'); // never touched without an assignment
  });
});
