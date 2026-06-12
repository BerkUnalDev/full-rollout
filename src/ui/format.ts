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
