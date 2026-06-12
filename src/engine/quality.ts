// src/engine/quality.ts
import { Rng } from './rng';
import {
  GENRE_FIT, GENRE_FIT_BAD, GENRE_FIT_CAP, GENRE_FIT_GOOD, HAPPINESS_LIKED,
  HAPPINESS_LOVED, HAPPINESS_MEH, QUALITY_BASE, QUALITY_NOISE, QUALITY_PER_MISSED_BUG,
  QUALITY_PER_SKILL, RATING_DELTA_CAP, REVENUE_IMPACT_CAP,
} from './constants';
import type { Happiness, PortfolioGame, Release, ReportCard, Ticket } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Hidden quality of a release computed at cut time from its tickets. */
export function computeQuality(
  included: Ticket[],
  game: PortfolioGame,
  rng: Rng,
): { quality: number; missedBugs: number } {
  const missedBugs = included.reduce((a, t) => a + t.hiddenBugs, 0);
  const points = included.reduce((a, t) => a + t.pointsWorked, 0);
  const skillSum = included.reduce((a, t) => a + t.devSkillSum, 0);
  const avgSkill = points > 0 ? skillSum / points : 3;

  const fitTable = GENRE_FIT[game.genre];
  let fit = 0;
  for (const t of included) {
    if (t.tags.some((tag) => fitTable.good.includes(tag))) fit += GENRE_FIT_GOOD;
    if (t.tags.some((tag) => fitTable.bad.includes(tag))) fit += GENRE_FIT_BAD;
  }
  fit = clamp(fit, -GENRE_FIT_CAP, GENRE_FIT_CAP);

  const quality = clamp(
    QUALITY_BASE + QUALITY_PER_SKILL * avgSkill + fit
      + QUALITY_PER_MISSED_BUG * missedBugs + rng.noise(QUALITY_NOISE),
    0, 100,
  );
  return { quality: Math.round(quality), missedBugs };
}

/** Player-facing report card derived from hidden quality when metrics arrive. */
export function deriveReportCard(release: Release, rng: Rng): ReportCard {
  const q = release.quality;
  const happiness: Happiness =
    q >= HAPPINESS_LOVED ? 'loved' : q >= HAPPINESS_LIKED ? 'liked' : q >= HAPPINESS_MEH ? 'meh' : 'hated';
  const bugReports =
    release.missedBugs === 0
      ? (rng.chance(0.15) ? 1 : 0)
      : Math.round(release.missedBugs * rng.range(1.5, 3.5));
  const revenueImpactPct = clamp(
    round1(release.impact.revenuePct * (q / 70) + (q - QUALITY_BASE) / 5 + rng.noise(2)),
    REVENUE_IMPACT_CAP[0], REVENUE_IMPACT_CAP[1],
  );
  const ratingDelta = clamp(
    round1((q - QUALITY_BASE) / 25 + release.impact.ratingBonus),
    -RATING_DELTA_CAP, RATING_DELTA_CAP,
  );
  return { happiness, bugReports, revenueImpactPct, ratingDelta };
}
