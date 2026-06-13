// src/engine/studio.ts
import { Rng } from './rng';
import {
  GATE_GRACE_WEEKS, LEVEL_WINDOW_ABOVE, LEVEL_WINDOW_SPAN,
  STUDIO_LEVEL_CAP, STUDIO_MAX_GAMES_PER_LEVEL, STUDIO_UPGRADE_COSTS,
} from './constants';
import type { GameState } from './types';

export function maxGamesFor(level: number): number {
  return level * STUDIO_MAX_GAMES_PER_LEVEL;
}

/** Cost to go from `level` to `level+1`; null if already at the cap. */
export function nextUpgradeCost(level: number): number | null {
  if (level >= STUDIO_LEVEL_CAP) return null;
  return STUDIO_UPGRADE_COSTS[level - 1];
}

/** Required studio level for a generated feature / tech-debt item.
 *  Grace period forces Lv 1; otherwise a ~5-level window around the studio
 *  level, skewed toward the accessible floor, reaching up to studioLevel+2. */
export function rollRequiredLevel(s: GameState, rng: Rng): number {
  if (s.weekIndex < GATE_GRACE_WEEKS) return 1;
  const ceiling = Math.min(STUDIO_LEVEL_CAP, s.studioLevel + LEVEL_WINDOW_ABOVE);
  const floor = Math.max(1, ceiling - LEVEL_WINDOW_SPAN + 1);
  const span = ceiling - floor; // max 0-based offset
  const offset = Math.min(rng.int(0, span), rng.int(0, span)); // triangular → floor
  return floor + offset;
}
