// Round-4 behaviours: one-shot featuring + disruption events
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { endWeek } from '../endWeek';
import { runEconomy } from '../economy';
import { runDisruptions } from '../disruptions';
import { canCutRelease } from '../releases';
import { generateInboxItem } from '../inbox';
import { makeState, addMember, addTicket } from './helpers';

describe('featuring opportunity is one-shot (take it the week it appears)', () => {
  it('a pending, un-accepted opportunity is gone the next week', () => {
    const s = makeState();
    const opp = generateInboxItem(s, new Rng(1), 'opportunity', s.games[0].id);
    s.inbox.push(opp);
    const s2 = endWeek(s);
    expect(s2.inbox.find((i) => i.id === opp.id)?.status).not.toBe('pending');
  });

  it('an accepted opportunity is kept (you used your one shot)', () => {
    const s = newGame(1);
    const opp = generateInboxItem(s, new Rng(2), 'opportunity', s.games[0].id);
    opp.deadlineWeek = s.weekIndex + 5;
    s.inbox.push(opp);
    const accepted = applyAction(s, { type: 'acceptInbox', itemId: opp.id });
    const s2 = endWeek(accepted);
    expect(s2.inbox.find((i) => i.id === opp.id)?.status).toBe('accepted');
  });
});

describe('outage disruption', () => {
  it('a game in outage earns no revenue', () => {
    const s = makeState();
    const g = s.games[0];
    g.outageWeeks = 2;
    runEconomy(s);
    expect(s.pendingDeltas.some((d) => d.label === `${g.name} revenue` && d.amount > 0)).toBe(false);
  });

  it('runDisruptions ticks an outage down and lifts it', () => {
    const s = makeState();
    s.games[0].outageWeeks = 1;
    runDisruptions(s, new Rng(999));
    expect(s.games[0].outageWeeks).toBe(0);
    expect(s.pendingEvents.some((e) => e.includes('back online'))).toBe(true);
  });
});

describe('employee-out disruption', () => {
  it('an out member cannot be assigned', () => {
    const s = makeState();
    const dev = addMember(s, 'Developer', 3);
    dev.outWeeks = 2;
    const t = addTicket(s, { status: 'TODO' });
    expect(() => applyAction(s, { type: 'assign', ticketKey: t.key, memberId: dev.id })).toThrow(/out/i);
  });

  it('an out release manager does not count toward release capacity', () => {
    const s = makeState();
    s.team = s.team.filter((m) => m.role !== 'Release Manager');
    const rm = addMember(s, 'Release Manager', 3);
    addTicket(s, { gameId: s.games[0].id, status: 'QA_COMPLETE', pointsWorked: 6, devSkillSum: 18 });
    expect(canCutRelease(s, s.games[0].id).ok).toBe(true);
    rm.outWeeks = 2;
    expect(canCutRelease(s, s.games[0].id).ok).toBe(false);
  });

  it('a new member-out frees that member’s current ticket back to the queue', () => {
    const s = makeState();
    s.team = []; // isolate
    const dev = addMember(s, 'Developer', 3);
    const t = addTicket(s, { status: 'IN_DEVELOPMENT' });
    t.assigneeId = dev.id;
    dev.ticketKey = t.key;
    // force a member-out by running disruptions until someone is out
    for (let i = 0; i < 200 && (dev.outWeeks ?? 0) === 0; i++) runDisruptions(s, new Rng(i));
    if ((dev.outWeeks ?? 0) > 0) {
      expect(dev.ticketKey).toBeNull();
      expect(t.assigneeId).toBeNull();
      expect(t.status).toBe('TODO');
    }
    expect((dev.outWeeks ?? 0)).toBeGreaterThan(0); // disruption did fire within 200 rolls
  });
});
