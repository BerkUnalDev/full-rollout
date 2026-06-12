// src/engine/inbox.ts
import { Rng } from './rng';
import {
  DECLINED_BUG_RATING_HIT, FEATURING_DEADLINE_WEEKS, FEATURING_REWARD_PCT,
  GENRE_FIT, INBOX_PER_WEEK, SDK_DEADLINE_WEEKS, SDK_FINE,
} from './constants';
import { OPPORTUNITY_BODIES, SDK_TITLES } from './data';
import { cwLabel } from './week';
import { createTicket, genId, genStoryConcept, genBugTitle, effortFor } from './generators';
import type { GameState, InboxItem, InboxItemKind } from './types';

/** Create one inbox item of the given kind for a random (or given) game. */
export function generateInboxItem(
  s: GameState,
  rng: Rng,
  kind: InboxItemKind,
  gameId?: string,
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
  // sdk
  const deadlineWeek = s.weekIndex + SDK_DEADLINE_WEEKS;
  return {
    ...base, kind: 'sdk', title: rng.pick(SDK_TITLES),
    body: `Compliance requires this in every game. Deadline ${cwLabel(deadlineWeek)} — missing it costs $${SDK_FINE.toLocaleString('en-US')}.`,
    deadlineWeek, fineUsd: SDK_FINE, effort: effortFor(rng, 'Task'),
  };
}

/** Mutates s: player accepts an inbox item. */
export function acceptInboxItem(s: GameState, itemId: string): void {
  const item = s.inbox.find((i) => i.id === itemId);
  if (!item) throw new Error('No such inbox item');
  if (item.status !== 'pending') throw new Error('Already handled');
  const game = s.games.find((g) => g.id === item.gameId)!;
  if (item.kind === 'feature') {
    createTicket(s, {
      type: 'Story', gameId: item.gameId, title: item.title, effort: item.effort!,
      tags: item.tags, predictedImpact: item.predictedImpact, impact: item.actualImpact,
    });
  } else if (item.kind === 'bug') {
    createTicket(s, { type: 'Bug', gameId: item.gameId, title: item.title, effort: item.effort! });
  } else if (item.kind === 'sdk') {
    createTicket(s, {
      type: 'Task', gameId: item.gameId, title: `${game.name} - ${item.title}`,
      effort: item.effort!, deadlineWeek: item.deadlineWeek,
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

/** Mutates s: 1-3 new events for the new week. At most one SDK chore in flight. */
export function generateWeeklyInbox(s: GameState, rng: Rng): void {
  const count = rng.int(INBOX_PER_WEEK[0], INBOX_PER_WEEK[1]);
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    let kind: InboxItemKind =
      roll < 0.45 ? 'feature' : roll < 0.75 ? 'bug' : roll < 0.9 ? 'opportunity' : 'sdk';
    const sdkActive =
      s.inbox.some((it) => it.kind === 'sdk' && (it.status === 'pending' || it.status === 'accepted')) ||
      s.tickets.some((t) => t.type === 'Task' && t.deadlineWeek !== null && t.status !== 'QA_COMPLETE' && t.status !== 'DONE');
    if (kind === 'sdk' && sdkActive) kind = 'feature';
    s.inbox.push(generateInboxItem(s, rng, kind));
  }
}

/** Mutates s: SDK fines and opportunity expiry. Run after the week advances. */
export function checkDeadlines(s: GameState): void {
  for (const item of s.inbox) {
    if (item.deadlineWeek == null) continue;
    const past = item.deadlineWeek < s.weekIndex;
    if (!past) continue;
    if (item.kind === 'sdk' && (item.status === 'pending' || item.status === 'declined')) {
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
      t.type === 'Task' && t.deadlineWeek !== null && t.deadlineWeek < s.weekIndex &&
      t.status !== 'QA_COMPLETE' && t.status !== 'DONE'
    ) {
      s.cash -= SDK_FINE;
      s.pendingDeltas.push({ label: `Compliance fine: ${t.title}`, amount: -SDK_FINE });
      s.pendingEvents.push(`🚨 ${t.title} missed its deadline — fined $${SDK_FINE.toLocaleString('en-US')}`);
      t.deadlineWeek = null; // fined once
    }
  }
}
