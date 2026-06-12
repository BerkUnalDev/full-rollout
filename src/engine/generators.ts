// src/engine/generators.ts
import { Rng } from './rng';
import {
  BUG_EFFORT, CANDIDATES_PER_WEEK, GENRES, OFFERS_PER_WEEK, OFFER_PRICE_NOISE,
  OFFER_PRICE_WEEKS, SALARY_BY_SKILL, SIGNING_FEE_WEEKS, STORY_EFFORT, TASK_EFFORT,
} from './constants';
import { BUG_TITLES, STORY_TEMPLATES } from './data';
import { generateGameName, generatePersonName } from './names';
import type {
  FeatureTag, GameOffer, GameState, Genre, HireCandidate, Impact, Role, Ticket, TicketType,
} from './types';

export function genId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

export function nextTicketKey(s: GameState): string {
  return `GIM-${s.nextTicketNum++}`;
}

interface TicketInit {
  type: TicketType;
  gameId: string;
  title: string;
  effort: number;
  tags?: FeatureTag[];
  predictedImpact?: Impact;
  impact?: Impact;
  deadlineWeek?: number | null;
  releaseVersion?: string | null;
}

/** Create a ticket in TODO and push it onto state. Returns the ticket. */
export function createTicket(s: GameState, init: TicketInit): Ticket {
  const t: Ticket = {
    key: nextTicketKey(s),
    type: init.type,
    gameId: init.gameId,
    title: init.title,
    status: 'TODO',
    assigneeId: null,
    effortTotal: init.effort,
    effort: init.effort,
    phaseEffort: init.effort,
    pointsWorked: 0,
    devSkillSum: 0,
    qaEffort: 0,
    hiddenBugs: 0,
    tags: init.tags ?? [],
    predictedImpact: init.predictedImpact ?? { revenuePct: 0, ratingBonus: 0 },
    impact: init.impact ?? { revenuePct: 0, ratingBonus: 0 },
    deadlineWeek: init.deadlineWeek ?? null,
    createdWeek: s.weekIndex,
    releaseVersion: init.releaseVersion ?? null,
  };
  s.tickets.push(t);
  return t;
}

export function effortFor(rng: Rng, type: TicketType): number {
  const [lo, hi] =
    type === 'Story' ? STORY_EFFORT : type === 'Bug' ? BUG_EFFORT : TASK_EFFORT;
  return rng.int(lo, hi);
}

/** Random story title + tag, biased toward tags that fit the genre (60/25/15). */
export function genStoryConcept(
  rng: Rng,
  _genre: Genre,
  fit: { good: readonly FeatureTag[]; bad: readonly FeatureTag[] },
): { title: string; tag: FeatureTag } {
  const all = Object.keys(STORY_TEMPLATES) as FeatureTag[];
  const neutral = all.filter((t) => !fit.good.includes(t) && !fit.bad.includes(t));
  const roll = rng.next();
  const pool: readonly FeatureTag[] = roll < 0.6 ? fit.good : roll < 0.85 ? neutral : fit.bad;
  const tag = rng.pick(pool.length ? pool : all);
  return { title: rng.pick(STORY_TEMPLATES[tag]), tag };
}

export function genBugTitle(rng: Rng): string {
  return rng.pick(BUG_TITLES);
}

export function genCandidate(s: GameState, rng: Rng): HireCandidate {
  const role: Role = rng.next() < 0.45 ? 'Developer' : rng.next() < 0.55 ? 'QA' : 'Release Manager';
  const skill = rng.int(1, 5);
  const base = SALARY_BY_SKILL[role][skill - 1];
  const salary = Math.round((base * rng.range(0.9, 1.1)) / 50) * 50;
  return {
    id: genId(s, 'cand'),
    name: generatePersonName(rng),
    role,
    skill,
    salary,
    signingFee: salary * SIGNING_FEE_WEEKS,
  };
}

export function genOffer(s: GameState, rng: Rng): GameOffer {
  const name = generateGameName(rng, s.usedNames);
  s.usedNames.push(name);
  const players = rng.int(20, 400) * 1000;
  const revenuePerPlayer = rng.range(0.008, 0.024);
  const weekly = players * revenuePerPlayer;
  const price = Math.round((weekly * OFFER_PRICE_WEEKS * rng.range(1 - OFFER_PRICE_NOISE, 1 + OFFER_PRICE_NOISE)) / 100) * 100;
  return {
    id: genId(s, 'offer'),
    name,
    genre: rng.pick(GENRES),
    players,
    rating: Math.round(rng.range(3.2, 4.7) * 10) / 10,
    revenuePerPlayer: Math.round(revenuePerPlayer * 10000) / 10000,
    price,
  };
}

/** Replace the market with fresh candidates and offers. */
export function refreshMarket(s: GameState, rng: Rng): void {
  const nc = rng.int(CANDIDATES_PER_WEEK[0], CANDIDATES_PER_WEEK[1]);
  const no = rng.int(OFFERS_PER_WEEK[0], OFFERS_PER_WEEK[1]);
  s.market.candidates = Array.from({ length: nc }, () => genCandidate(s, rng));
  s.market.offers = Array.from({ length: no }, () => genOffer(s, rng));
}
