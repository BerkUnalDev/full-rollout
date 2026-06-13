// src/engine/inbox.ts
import { Rng } from './rng';
import {
  DECLINED_BUG_RATING_HIT, FEATURING_DEADLINE_WEEKS, FEATURING_REWARD_PCT,
  GENRE_FIT, INBOX_PER_WEEK, TECHDEBT_DEADLINE_WEEKS, TECHDEBT_EFFORT,
  TECHDEBT_FINE, TECH_INVEST_REVENUE_PCT,
} from './constants';
import { OPPORTUNITY_BODIES, TECHDEBT_INVESTMENT_TITLES, TECHDEBT_MANDATORY_TITLES } from './data';
import { cwLabel } from './week';
import { createTicket, genId, genStoryConcept, genBugTitle, effortFor } from './generators';
import { rollRequiredLevel } from './studio';
import type { GameState, InboxItem, InboxItemKind, TechSubtype } from './types';

/** Create one inbox item of the given kind for a random (or given) game. */
export function generateInboxItem(
  s: GameState,
  rng: Rng,
  kind: InboxItemKind,
  gameId?: string,
  forcedSubtype?: TechSubtype,
): InboxItem {
  const game = gameId
    ? s.games.find((g) => g.id === gameId)!
    : rng.pick(s.games);
  const base = {
    id: genId(s, 'inbox'),
    gameId: game.id,
    weekCreated: s.weekIndex,
    status: 'pending' as const,
  };
  if (kind === 'feature') {
    const { title, tag } = genStoryConcept(rng, game.genre, GENRE_FIT[game.genre]);
    const predicted = {
      revenuePct: Math.round(rng.range(4, 12) * 10) / 10,
      ratingBonus: Math.round(rng.range(0, 0.2) * 100) / 100,
    };
    const actual = {
      revenuePct: Math.round(predicted.revenuePct * rng.range(0.5, 1.4) * 10) / 10,
      ratingBonus: Math.round(predicted.ratingBonus * rng.range(0.5, 1.4) * 100) / 100,
    };
    return {
      ...base, kind, title: `${game.name} - ${title}`,
      body: `Players are asking for it. Predicted: +${predicted.revenuePct}% revenue.`,
      predictedImpact: predicted, actualImpact: actual, tags: [tag],
      effort: effortFor(rng, 'Story'),
      requiredLevel: rollRequiredLevel(s, rng),
    };
  }
  if (kind === 'bug') {
    const title = genBugTitle(rng);
    return {
      ...base, kind, title: `${game.name} - ${title}`,
      body: 'Players are reporting this in reviews. Ignoring it will hurt the rating.',
      effort: effortFor(rng, 'Bug'),
    };
  }
  if (kind === 'opportunity') {
    const deadlineWeek = s.weekIndex + rng.int(FEATURING_DEADLINE_WEEKS[0], FEATURING_DEADLINE_WEEKS[1]);
    const body = rng.pick(OPPORTUNITY_BODIES)
      .replace('{game}', game.name)
      .replace('{deadline}', cwLabel(deadlineWeek));
    return {
      ...base, kind, title: `Featuring opportunity: ${game.name}`,
      body, deadlineWeek, rewardPlayersPct: FEATURING_REWARD_PCT,
    };
  }
  // techdebt (studio-wide; replaces the old per-game SDK task)
  const subtype: TechSubtype = forcedSubtype ?? (rng.next() < 0.55 ? 'mandatory' : 'investment');
  const requiredLevel = rollRequiredLevel(s, rng);
  const effort = rng.int(TECHDEBT_EFFORT[0], TECHDEBT_EFFORT[1]);
  if (subtype === 'mandatory') {
    const deadlineWeek = s.weekIndex + TECHDEBT_DEADLINE_WEEKS;
    return {
      ...base, gameId: '', kind: 'techdebt', techSubtype: 'mandatory', requiredLevel,
      title: rng.pick(TECHDEBT_MANDATORY_TITLES),
      body: `Compliance work for the whole studio. Ship by ${cwLabel(deadlineWeek)} or pay a $${TECHDEBT_FINE.toLocaleString('en-US')} fine. A junior dev may botch it even on time.`,
      deadlineWeek, fineUsd: TECHDEBT_FINE, effort,
    };
  }
  const benefitRevenuePct = Math.round(rng.range(TECH_INVEST_REVENUE_PCT[0], TECH_INVEST_REVENUE_PCT[1]) * 10) / 10;
  return {
    ...base, gameId: '', kind: 'techdebt', techSubtype: 'investment', requiredLevel,
    title: rng.pick(TECHDEBT_INVESTMENT_TITLES),
    body: `Optional engineering investment. Ships → permanent +${benefitRevenuePct}% revenue on every game you own. A junior dev may botch it.`,
    benefitRevenuePct, effort,
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
      deadlineWeek: item.techSubtype === 'mandatory' ? item.deadlineWeek : null,
      techSubtype: item.techSubtype, benefitRevenuePct: item.benefitRevenuePct,
    });
  }
  // opportunities are just tracked; payout happens on full rollout (releases.ts)
  item.status = 'accepted';
}

/** Mutates s: player declines an inbox item. Declined bugs dent the rating. */
export function declineInboxItem(s: GameState, itemId: string): void {
  const item = s.inbox.find((i) => i.id === itemId);
  if (!item) throw new Error('No such inbox item');
  if (item.status !== 'pending') throw new Error('Already handled');
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
  const count = rng.int(INBOX_PER_WEEK[0], INBOX_PER_WEEK[1]);
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const kind: InboxItemKind =
      roll < 0.45 ? 'feature' : roll < 0.75 ? 'bug' : roll < 0.9 ? 'opportunity' : 'techdebt';
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
}

/** Mutates s: tech-debt fines and opportunity expiry. Run after the week advances. */
export function checkDeadlines(s: GameState): void {
  for (const item of s.inbox) {
    if (item.deadlineWeek == null) continue;
    const past = item.deadlineWeek < s.weekIndex;
    if (!past) continue;
    if (item.kind === 'techdebt' && item.techSubtype === 'mandatory' &&
        (item.status === 'pending' || item.status === 'declined')) {
      s.cash -= item.fineUsd!;
      s.pendingDeltas.push({ label: `Compliance fine: ${item.title}`, amount: -item.fineUsd! });
      s.pendingEvents.push(`🚨 Missed compliance deadline — fined $${item.fineUsd!.toLocaleString('en-US')}`);
      item.status = 'done';
    } else if (item.kind === 'opportunity' && (item.status === 'pending' || item.status === 'accepted')) {
      item.status = 'done';
      s.pendingEvents.push(`⌛ Featuring window for ${s.games.find((g) => g.id === item.gameId)!.name} closed`);
    }
  }
  for (const t of s.tickets) {
    if (
      t.type === 'Tech Debt' && t.techSubtype === 'mandatory' && t.deadlineWeek !== null &&
      t.deadlineWeek < s.weekIndex && t.status !== 'DONE'
    ) {
      s.cash -= TECHDEBT_FINE;
      s.pendingDeltas.push({ label: `Compliance fine: ${t.title}`, amount: -TECHDEBT_FINE });
      s.pendingEvents.push(`🚨 ${t.title} missed its deadline — fined $${TECHDEBT_FINE.toLocaleString('en-US')}`);
      t.deadlineWeek = null; // fined once
    }
  }
}
