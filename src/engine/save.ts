// src/engine/save.ts
import { SCHEMA_VERSION } from './constants';
import type { GameState } from './types';

export const SAVE_KEY = 'full-rollout-save';

export function serialize(state: GameState): string {
  return JSON.stringify({ v: SCHEMA_VERSION, state });
}

/** Returns null for corrupt or version-mismatched saves (caller starts fresh). */
export function deserialize(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json) as { v?: number; state?: GameState };
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.state) return null;
    const st = parsed.state;
    if (
      typeof st.weekIndex !== 'number' || !Array.isArray(st.tickets) ||
      typeof st.studioLevel !== 'number' || !Array.isArray(st.reportHistory)
    ) return null;
    return st;
  } catch {
    return null;
  }
}
