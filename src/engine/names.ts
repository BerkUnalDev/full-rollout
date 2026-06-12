// src/engine/names.ts
import { Rng } from './rng';
import { NAME_FIRST, NAME_SECOND, PERSON_FIRST, PERSON_LAST, REAL_GIM_NAMES } from './data';

export function generateGameName(rng: Rng, used: readonly string[]): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const name = `${rng.pick(NAME_FIRST)} ${rng.pick(NAME_SECOND)}`;
    const taken = used.includes(name) || (REAL_GIM_NAMES as readonly string[]).includes(name);
    if (!taken) return name;
  }
  // Bank exhausted (400 combos) — extremely long runs only. Suffix a numeral.
  let n = 2;
  const base = `${rng.pick(NAME_FIRST)} ${rng.pick(NAME_SECOND)}`;
  while (used.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function generatePersonName(rng: Rng): string {
  return `${rng.pick(PERSON_FIRST)} ${rng.pick(PERSON_LAST)}`;
}
