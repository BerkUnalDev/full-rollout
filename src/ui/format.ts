// src/ui/format.ts
import type { Happiness } from '../engine';

export function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}

export function fmtPlayers(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 100) / 10}k`;
  return String(v);
}

export const stars = (r: number) => `${r.toFixed(1)}★`;

export const HAPPY: Record<Happiness, { emoji: string; label: string }> = {
  loved: { emoji: '😍', label: 'Loved it' },
  liked: { emoji: '🙂', label: 'Liked it' },
  meh: { emoji: '😐', label: 'Meh' },
  hated: { emoji: '😡', label: 'Hated it' },
};

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);

export const signedPct = (v: number) => `${v > 0 ? '+' : ''}${v}%`;
export const signedNum = (v: number) => `${v > 0 ? '+' : ''}${v}`;

const GAME_LOGOS = [
  '🎮', '🕹️', '🧩', '🎲', '🃏', '🎯', '🎰', '🏰', '🐉', '🦄',
  '🍭', '🍩', '🚀', '⚽', '🏎️', '🪀', '🎨', '🐢', '🦊', '🌋',
] as const;

/** Deterministic unique-ish emoji logo for a game, derived from its id. */
export function gameLogo(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GAME_LOGOS[h % GAME_LOGOS.length];
}
