// src/engine/studio.ts
import { Rng } from './rng';
import {
  GATE_GRACE_WEEKS, LEVEL_WINDOW_ABOVE, LEVEL_WINDOW_SPAN, ROLE_CAP_BASE,
  STUDIO_GAME_REQ, STUDIO_LEVEL_CAP, STUDIO_MAX_GAMES_PER_LEVEL, STUDIO_UPGRADE_COSTS,
  WEEKS_PER_REQ_BUMP,
} from './constants';
import type { GameState, Role } from './types';

export function maxGamesFor(level: number): number {
  return level * STUDIO_MAX_GAMES_PER_LEVEL;
}

/** Cost to go from `level` to `level+1`; null if at the cap. */
export function nextUpgradeCost(level: number): number | null {
  if (level >= STUDIO_LEVEL_CAP) return null;
  return STUDIO_UPGRADE_COSTS[level - 1];
}

/** Games you must own to upgrade from `level`; Infinity at the cap. */
export function studioGameRequirement(level: number): number {
  if (level >= STUDIO_LEVEL_CAP) return Infinity;
  return STUDIO_GAME_REQ[level - 1];
}

/** Per-role hire cap at a studio level. */
export function roleCapacity(role: Role, level: number): number {
  return ROLE_CAP_BASE[role] + level;
}

/** Required studio level for a generated feature / tech-debt item.
 *  - Grace forces Lv 1.
 *  - `accessibleChance` (features only): chance to land at ≤ studioLevel so the
 *    game never permanently locks. Tech-debt passes 0 (pure rising floor).
 *  - Otherwise a rising floor (+1 every WEEKS_PER_REQ_BUMP after grace) with a
 *    ~5-level spread, reaching up to studioLevel+2 if the player is ahead. */
export function rollRequiredLevel(s: GameState, rng: Rng, accessibleChance = 0): number {
  if (s.weekIndex < GATE_GRACE_WEEKS) return 1;
  if (accessibleChance > 0 && rng.chance(accessibleChance)) return rng.int(1, s.studioLevel);
  const timeFloor = 1 + Math.floor((s.weekIndex - GATE_GRACE_WEEKS) / WEEKS_PER_REQ_BUMP);
  const floor = Math.min(STUDIO_LEVEL_CAP, timeFloor);
  const ceiling = Math.min(STUDIO_LEVEL_CAP, Math.max(s.studioLevel + LEVEL_WINDOW_ABOVE, floor + LEVEL_WINDOW_SPAN - 1));
  const span = ceiling - floor;
  const offset = Math.min(rng.int(0, span), rng.int(0, span)); // triangular → floor
  return floor + offset;
}
