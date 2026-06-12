// src/engine/inbox.ts
import { Rng } from './rng';
import {
  FEATURING_DEADLINE_WEEKS, FEATURING_REWARD_PCT, GENRE_FIT, SDK_DEADLINE_WEEKS, SDK_FINE,
} from './constants';
import { OPPORTUNITY_BODIES, SDK_TITLES } from './data';
import { cwLabel } from './week';
import { genId, genStoryConcept, genBugTitle, effortFor } from './generators';
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
