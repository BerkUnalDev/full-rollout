// src/engine/constants.ts
// Every balance number lives here. All "initial balance" — tune freely in playtesting.
import type { FeatureTag, Genre, Role } from './types';

export const SCHEMA_VERSION = 2;
export const DEFAULT_SEED = 20260612;

// Calendar: weekIndex 0 = CW 24/2026.
export const START_CW = 24;
export const START_YEAR = 2026;
export const WEEKS_PER_YEAR = 52;

// Economy
export const STARTING_CASH = 50_000;
export const PLAYER_VALUE = 0.35; // $ per player when computing company value
export const SIGNING_FEE_WEEKS = 2;
export const NEW_GAME_COST = 3_000;
export const NEW_GAME_STORIES = 3;
export const OFFER_PRICE_WEEKS = 25;
export const OFFER_PRICE_NOISE = 0.3;

// Work
export const STORY_EFFORT: readonly [number, number] = [4, 8];
export const BUG_EFFORT: readonly [number, number] = [2, 4];
export const TASK_EFFORT: readonly [number, number] = [3, 5];
export const REWORK_FRACTION = 0.4;
export const QA_EFFORT_FRACTION = 0.5;
export const BUG_RATE_PER_POINT = 0.04; // expected bugs = phaseEffort × (6 − skill) × this
export const QA_CATCH_BASE = 0.5;
export const QA_CATCH_PER_SKILL = 0.09;
/** Work speed (points/week) for both devs and QA. */
export const speedOf = (skill: number) => skill + 1;

// Quality & report card
export const QUALITY_BASE = 55;
export const QUALITY_PER_SKILL = 6; // × avg dev skill (1-5)
export const QUALITY_PER_MISSED_BUG = -12;
export const QUALITY_NOISE = 5;
export const GENRE_FIT_CAP = 10;
export const HAPPINESS_LOVED = 75;
export const HAPPINESS_LIKED = 60;
export const HAPPINESS_MEH = 45;
export const REVENUE_IMPACT_CAP: readonly [number, number] = [-20, 40];
export const RATING_DELTA_CAP = 0.6;
export const GROWTH_DIVISOR = 200; // players ×= 1 + (quality − 55) / this
export const NEW_GAME_SEED_PER_QUALITY = 400; // first rollout of a 0-player game: players = quality × this

// Decay
export const DECAY_GRACE_WEEKS = 6;
export const DECAY_PER_STALE_WEEK = 0.02; // players lost per week beyond grace
export const DECAY_MAX_STALE_WEEKS = 8; // cap the multiplier
export const RATING_DECAY_STALE = 0.03;

// Team
export const SALARY_BY_SKILL: Record<Role, readonly number[]> = {
  Developer: [800, 1100, 1500, 2000, 2600],
  QA: [700, 950, 1200, 1600, 2100],
  'Release Manager': [800, 1000, 1300, 1700, 2200],
};

// Inbox
export const INBOX_PER_WEEK: readonly [number, number] = [1, 3];
export const FEATURING_REWARD_PCT = 0.25;
export const FEATURING_DEADLINE_WEEKS: readonly [number, number] = [5, 8];
export const DECLINED_BUG_RATING_HIT = 0.08; // × (declinedBugs so far + 1)

// Market
export const CANDIDATES_PER_WEEK: readonly [number, number] = [2, 3];
export const OFFERS_PER_WEEK: readonly [number, number] = [1, 2];

// Genre ↔ feature-tag fit: +3 per story with a good tag, −5 per story with a bad tag.
export const GENRE_FIT_GOOD = 3;
export const GENRE_FIT_BAD = -5;
export const GENRE_FIT: Record<Genre, { good: readonly FeatureTag[]; bad: readonly FeatureTag[] }> = {
  Puzzle: { good: ['levels', 'events'], bad: ['monetization'] },
  Merge: { good: ['meta', 'events'], bad: ['social'] },
  Word: { good: ['levels', 'social'], bad: ['meta'] },
  Arcade: { good: ['polish', 'events'], bad: ['meta'] },
  Card: { good: ['social', 'monetization'], bad: ['levels'] },
  Simulation: { good: ['meta', 'monetization'], bad: ['polish'] },
};

export const GENRES: readonly Genre[] = ['Puzzle', 'Merge', 'Word', 'Arcade', 'Card', 'Simulation'];

// Studio level
export const STUDIO_LEVEL_CAP = 10;
export const STUDIO_MAX_GAMES_PER_LEVEL = 4;
// Cost to reach the NEXT level; index = currentLevel - 1 (L1→2 … L9→10).
export const STUDIO_UPGRADE_COSTS: readonly number[] = [
  3_000, 8_000, 16_000, 28_000, 45_000, 70_000, 105_000, 150_000, 210_000,
];
export const GATE_GRACE_WEEKS = 4; // first weeks: every gated item is Lv 1
export const LEVEL_WINDOW_ABOVE = 1; // items may require up to studioLevel + this
export const LEVEL_WINDOW_SPAN = 5; // distinct required-levels visible at once

// Tech debt
export const TECHDEBT_EFFORT: readonly [number, number] = [4, 7];
export const TECH_FAIL_BASE = 0.5;
export const TECH_FAIL_PER_SKILL = 0.09; // failChance = clamp(BASE - PER_SKILL×skill, 0.02, 0.7)
export const TECH_FAIL_MIN = 0.02;
export const TECH_FAIL_MAX = 0.7;
export const TECH_FAIL_PENALTY = 500; // cash ding on a failed tech-debt attempt
export const TECH_REWORK_FRACTION = 0.5; // rework effort = ceil(effortTotal × this)
export const TECH_INVEST_REVENUE_PCT: readonly [number, number] = [3, 6];
export const TECHDEBT_DEADLINE_WEEKS = 3;
export const TECHDEBT_FINE = 4_000;

// Report history
export const REPORT_HISTORY_CAP = 10;

// v2.1 — treadmill / caps / economy
export const WEEKS_PER_REQ_BUMP = 10; // required-level floor +1 every N weeks after grace (gentle)
export const TECHDEBT_ACCESSIBLE_CHANCE = 0.4; // share of tech-debt that lands ≤ studioLevel (doable now)
export const FEATURE_ACCESSIBLE_CHANCE = 0.2; // ~20% of features always ≤ studioLevel
export const STUDIO_GAME_REQ: readonly number[] = [2, 3, 4, 6, 8, 10, 13, 16, 20]; // games needed to reach next level (index = level-1)
export const ROLE_CAP_BASE: Record<Role, number> = { Developer: 2, QA: 1, 'Release Manager': 1 }; // roleCap = base + level
export const SEVERANCE_WEEKS = 2;
export const FEATURING_ACCEPT_COST = 1_500;
export const SELL_PRICE_WEEKS = 18;
export const SELL_PRICE_FLOOR = 500;
export const FEATURE_CAP_PER_GAME = 5; // feature inbox cap = games × this
export const TECHDEBT_REFILL_CHANCE = 0.6; // weekly chance to inject tech-debt when none active

// v2.2 — disruption events
export const DISRUPTION_CHANCE = 0.18; // weekly chance a disruption strikes
export const DISRUPTION_WEEKS: readonly [number, number] = [1, 3];
