// src/engine/inbox.ts
import { Rng } from './rng';
import {
  DECLINED_BUG_RATING_HIT, FEATURE_ACCESSIBLE_CHANCE, FEATURE_CAP_PER_GAME,
  FEATURING_ACCEPT_COST, FEATURING_DEADLINE_WEEKS, FEATURING_REWARD_PCT, GENRE_FIT,
  INBOX_PER_WEEK, TECHDEBT_ACCESSIBLE_CHANCE, TECHDEBT_DEADLINE_WEEKS, TECHDEBT_EFFORT,
  TECHDEBT_FINE, TECHDEBT_REFILL_CHANCE, TECH_INVEST_REVENUE_PCT,
} from './constants';
import { OPPORTUNITY_BODIES, TECHDEBT_INVESTMENT_TITLES, TECHDEBT_MANDATORY_TITLES } from './data';
import { cwLabel } from './week';
import { createTicket, genId, genStoryConcept, genBugTitle, effortFor } from './generators';
import { rollRequiredLevel } from './studio';
import type { GameState, InboxItem, InboxItemKind, TechSubtype } from './types';

/** Ensure a freshly-generated ticket/inbox title doesn't duplicate one that's
 *  already open (pending inbox item or non-DONE ticket); suffix " (2)", " (3)"… */
function uniqueTitle(s: GameState, base: string): string {
  const taken = new Set<string>([
    ...s.inbox.filter((i) => i.status === 'pending').map((i) => i.title),
    ...s.tickets.filter((t) => t.status !== 'DONE').map((t) => t.title),
  ]);
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})`;
    if (!taken.has(candidate)) return candidate;
  }
}

/** Create one inbox item of the given kind for a random (or given) game. */
export function generateInboxItem(
  s: GameState,
  rng: Rng,
  kind: InboxItemKind,
  gameId?: string,
  forcedSubtype?: TechSubtype,
): InboxItem {
  // Tech-debt is studio-wide (no game); only game-scoped kinds need a game.
  // Guard rng.pick against an empty portfolio (player can sell all their games).
  const game = gameId
    ? s.games.find((g) => g.id === gameId)!
    : s.games.length > 0
      ? rng.pick(s.games)
      : undefined;
  const base = {
    id: genId(s, 'inbox'),
    gameId: game ? game.id : '',
    weekCreated: s.weekIndex,
    status: 'pending' as const,
  };
  if (kind !== 'techdebt' && !game) {
    throw new Error('generateInboxItem: a game-scoped item needs a game');
  }
  if (kind === 'feature') {
    const { title, tag } = genStoryConcept(rng, game!.genre, GENRE_FIT[game!.genre]);
    const predicted = {
      revenuePct: Math.round(rng.range(4, 12) * 10) / 10,
      ratingBonus: Math.round(rng.range(0, 0.2) * 100) / 100,
    };
    const actual = {
      revenuePct: Math.round(predicted.revenuePct * rng.range(0.5, 1.4) * 10) / 10,
      ratingBonus: Math.round(predicted.ratingBonus * rng.range(0.5, 1.4) * 100) / 100,
    };
    return {
      ...base, kind, title: uniqueTitle(s, `${game!.name} - ${title}`),
      body: `Players are asking for it. Predicted: +${predicted.revenuePct}% revenue.`,
      predictedImpact: predicted, actualImpact: actual, tags: [tag],
      effort: effortFor(rng, 'Story'),
      requiredLevel: rollRequiredLevel(s, rng, FEATURE_ACCESSIBLE_CHANCE),
    };
  }
  if (kind === 'bug') {
    const title = genBugTitle(rng);
    return {
      ...base, kind, title: uniqueTitle(s, `${game!.name} - ${title}`),
      body: 'Players are reporting this in reviews. Ignoring it will hurt the rating.',
      effort: effortFor(rng, 'Bug'),
    };
  }
  if (kind === 'opportunity') {
    const deadlineWeek = s.weekIndex + rng.int(FEATURING_DEADLINE_WEEKS[0], FEATURING_DEADLINE_WEEKS[1]);
    const body = rng.pick(OPPORTUNITY_BODIES)
      .replace('{game}', game!.name)
      .replace('{deadline}', cwLabel(deadlineWeek));
    return {
      ...base, kind, title: `Featuring opportunity: ${game!.name}`,
      body, deadlineWeek, rewardPlayersPct: FEATURING_REWARD_PCT,
    };
  }
  // techdebt (studio-wide; replaces the old per-game SDK task)
  const subtype: TechSubtype = forcedSubtype ?? (rng.next() < 0.55 ? 'mandatory' : 'investment');
  const requiredLevel = rollRequiredLevel(s, rng, TECHDEBT_ACCESSIBLE_CHANCE);
  const effort = rng.int(TECHDEBT_EFFORT[0], TECHDEBT_EFFORT[1]);
  const deadlineWeek = s.weekIndex + TECHDEBT_DEADLINE_WEEKS;
  if (subtype === 'mandatory') {
    return {
      ...base, gameId: '', kind: 'techdebt', techSubtype: 'mandatory', requiredLevel,
      title: uniqueTitle(s, rng.pick(TECHDEBT_MANDATORY_TITLES)),
      body: `Compliance work for the whole studio. Ship by ${cwLabel(deadlineWeek)} or pay a $${TECHDEBT_FINE.toLocaleString('en-US')} fine. A junior dev may botch it even on time.`,
      deadlineWeek, fineUsd: TECHDEBT_FINE, effort,
    };
  }
  const benefitRevenuePct = Math.round(rng.range(TECH_INVEST_REVENUE_PCT[0], TECH_INVEST_REVENUE_PCT[1]) * 10) / 10;
  return {
    ...base, gameId: '', kind: 'techdebt', techSubtype: 'investment', requiredLevel,
    title: uniqueTitle(s, rng.pick(TECHDEBT_INVESTMENT_TITLES)),
    body: `Engineering upgrade. Ship by ${cwLabel(deadlineWeek)} → permanent +${benefitRevenuePct}% revenue on every game; miss it → $${TECHDEBT_FINE.toLocaleString('en-US')} fine. A junior dev may botch it.`,
    benefitRevenuePct, deadlineWeek, fineUsd: TECHDEBT_FINE, effort,
  };
}

/** Mutates s: player accepts an inbox item. */
export function acceptInboxItem(s: GameState, itemId: string): void {
  const item = s.inbox.find((i) => i.id === itemId);
  if (!item) throw new Error('No such inbox item');
  if (item.status !== 'pending') throw new Error('Already handled');
  if ((item.kind === 'feature' || item.kind === 'techdebt') &&
      item.requiredLevel && s.studioLevel < item.requiredLevel) {
    throw new Error(`Requires Studio Level ${item.requiredLevel}`);
  }
  if (item.kind === 'feature') {
    createTicket(s, {
      type: 'Story', gameId: item.gameId, title: item.title, effort: item.effort!,
      tags: item.tags, predictedImpact: item.predictedImpact, impact: item.actualImpact,
    });
  } else if (item.kind === 'bug') {
    createTicket(s, { type: 'Bug', gameId: item.gameId, title: item.title, effort: item.effort! });
  } else if (item.kind === 'techdebt') {
    createTicket(s, {
      type: 'Tech Debt', gameId: '', title: item.title, effort: item.effort!,
      deadlineWeek: item.deadlineWeek, // both subtypes carry a hard deadline → fined if unfinished
      techSubtype: item.techSubtype, benefitRevenuePct: item.benefitRevenuePct,
    });
  }
  // opportunities are just tracked; payout happens on full rollout (releases.ts)
  if (item.kind === 'opportunity') {
    s.cash -= FEATURING_ACCEPT_COST;
    s.pendingDeltas.push({ label: `Featuring fee: ${item.title}`, amount: -FEATURING_ACCEPT_COST });
  }
  item.status = 'accepted';
}

/** Mutates s: player declines an inbox item. Declined bugs dent the rating. */
export function declineInboxItem(s: GameState, itemId: string): void {
  const item = s.inbox.find((i) => i.id === itemId);
  if (!item) throw new Error('No such inbox item');
  if (item.status !== 'pending') throw new Error('Already handled');
  if (item.kind === 'techdebt') throw new Error("Tech debt can't be declined — it must be handled");
  if (item.kind === 'bug') {
    const g = s.games.find((x) => x.id === item.gameId)!;
    g.declinedBugs += 1;
    g.rating = Math.max(1, Math.round((g.rating - DECLINED_BUG_RATING_HIT * g.declinedBugs) * 100) / 100);
    s.pendingEvents.push(`📉 Ignored a bug in ${g.name} — rating slipped`);
  }
  item.status = 'declined';
}

/** Mutates s: 1-3 new events for the new week. At most one mandatory tech-debt chore in flight. */
export function generateWeeklyInbox(s: GameState, rng: Rng): void {
  const featureCap = s.games.length * FEATURE_CAP_PER_GAME;
  const count = rng.int(INBOX_PER_WEEK[0], INBOX_PER_WEEK[1]);
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    let kind: InboxItemKind =
      roll < 0.38 ? 'feature' : roll < 0.60 ? 'bug' : roll < 0.84 ? 'opportunity' : 'techdebt';
    // With no games owned, only studio-wide tech-debt can be generated.
    if (s.games.length === 0) kind = 'techdebt';
    // Feature inbox is capped at games × FEATURE_CAP_PER_GAME; overflow becomes a bug.
    if (kind === 'feature' && s.inbox.filter((it) => it.kind === 'feature' && it.status === 'pending').length >= featureCap) {
      kind = 'bug';
    }
    const mandatoryActive =
      s.inbox.some((it) => it.kind === 'techdebt' && it.techSubtype === 'mandatory' &&
        (it.status === 'pending' || it.status === 'accepted')) ||
      s.tickets.some((t) => t.type === 'Tech Debt' && t.techSubtype === 'mandatory' &&
        t.deadlineWeek !== null && t.status !== 'DONE');
    if (kind === 'techdebt' && mandatoryActive) {
      s.inbox.push(generateInboxItem(s, rng, 'techdebt', undefined, 'investment'));
    } else {
      s.inbox.push(generateInboxItem(s, rng, kind));
    }
  }
  // Cadence guarantee: if no tech-debt is pending or in-flight, likely inject one.
  const techActive =
    s.inbox.some((it) => it.kind === 'techdebt' && it.status === 'pending') ||
    s.tickets.some((t) => t.type === 'Tech Debt' && t.status !== 'DONE');
  if (!techActive && rng.chance(TECHDEBT_REFILL_CHANCE)) {
    s.inbox.push(generateInboxItem(s, rng, 'techdebt'));
  }
}

/** Mutates s: tech-debt fines and opportunity expiry. Run after the week advances. */
export function checkDeadlines(s: GameState): void {
  for (const item of s.inbox) {
    if (item.deadlineWeek == null) continue;
    const past = item.deadlineWeek < s.weekIndex;
    if (!past) continue;
    if (item.kind === 'techdebt' &&
        (item.status === 'pending' || item.status === 'declined')) {
      // Tech-debt fines you even when it's locked above your level — that's the
      // pressure to upgrade and be able to handle it next time.
      s.cash -= item.fineUsd!;
      s.pendingDeltas.push({ label: `Missed deadline: ${item.title}`, amount: -item.fineUsd! });
      s.pendingEvents.push(`🚨 Missed ${item.title} deadline — fined $${item.fineUsd!.toLocaleString('en-US')}`);
      item.status = 'done';
    } else if (item.kind === 'opportunity' && (item.status === 'pending' || item.status === 'accepted')) {
      item.status = 'done';
      s.pendingEvents.push(`⌛ Featuring window for ${s.games.find((g) => g.id === item.gameId)!.name} closed`);
    }
  }
  for (const t of s.tickets) {
    if (
      t.type === 'Tech Debt' && t.deadlineWeek !== null &&
      t.deadlineWeek < s.weekIndex && t.status !== 'DONE'
    ) {
      s.cash -= TECHDEBT_FINE;
      s.pendingDeltas.push({ label: `Missed deadline: ${t.title}`, amount: -TECHDEBT_FINE });
      s.pendingEvents.push(`🚨 ${t.title} missed its deadline — fined $${TECHDEBT_FINE.toLocaleString('en-US')}`);
      t.deadlineWeek = null;
    }
  }
}
