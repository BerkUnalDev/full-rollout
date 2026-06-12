// src/engine/week.ts
import { START_CW, START_YEAR, WEEKS_PER_YEAR } from './constants';

export function weekToCW(weekIndex: number): { week: number; year: number } {
  const total = START_CW + weekIndex; // 1-based CW within the start year
  const yearOffset = Math.floor((total - 1) / WEEKS_PER_YEAR);
  const week = ((((total - 1) % WEEKS_PER_YEAR) + WEEKS_PER_YEAR) % WEEKS_PER_YEAR) + 1;
  return { week, year: START_YEAR + yearOffset };
}

export function cwLabel(weekIndex: number): string {
  const { week, year } = weekToCW(weekIndex);
  return `CW ${week}/${year}`;
}
