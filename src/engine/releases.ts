// src/engine/releases.ts
import { Rng } from './rng';
import { computeQuality, deriveReportCard } from './quality';
import { createTicket, genId } from './generators';
import { cwLabel } from './week';
import type { GameState, PortfolioGame, Release, Ticket } from './types';

export function qaCompleteFor(s: GameState, gameId: string): Ticket[] {
  const locked = new Set(s.releases.flatMap((r) => (r.status === 'decided' ? [] : r.ticketKeys)));
  return s.tickets.filter(
    (t) => t.gameId === gameId && t.status === 'QA_COMPLETE' && !locked.has(t.key),
  );
}

export function computeNextVersion(game: PortfolioGame, included: Ticket[]): string {
  const [maj, min, pat] = game.version.split('.').map(Number);
  return included.some((t) => t.type === 'Story')
    ? `${maj}.${min + 1}.0`
    : `${maj}.${min}.${pat + 1}`;
}

export function canCutRelease(
  s: GameState,
  gameId: string,
): { ok: boolean; reason?: string; nextVersion?: string } {
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, reason: 'No such game' };
  if (s.releases.some((r) => r.gameId === gameId && r.status !== 'decided')) {
    return { ok: false, reason: 'A release is already in flight for this game' };
  }
  const included = qaCompleteFor(s, gameId);
  if (included.length === 0) return { ok: false, reason: 'No QA-complete tickets for this game' };
  const rmCount = s.team.filter((m) => m.role === 'Release Manager').length;
  const cutting = s.releases.filter((r) => r.status === 'cutting').length;
  if (cutting >= rmCount) return { ok: false, reason: 'All release managers are busy this week' };
  return { ok: true, nextVersion: computeNextVersion(game, included) };
}

/** Mutates s. Called from the cutRelease action handler after validation. */
export function performCut(s: GameState, rng: Rng, gameId: string): Release {
  const check = canCutRelease(s, gameId);
  if (!check.ok) throw new Error(check.reason);
  const game = s.games.find((g) => g.id === gameId)!;
  const included = qaCompleteFor(s, gameId);
  const version = check.nextVersion!;
  const { quality, missedBugs } = computeQuality(included, game, rng);
  const impact = {
    revenuePct: included.reduce((a, t) => a + t.impact.revenuePct, 0) + game.pendingImpact.revenuePct,
    ratingBonus: included.reduce((a, t) => a + t.impact.ratingBonus, 0) + game.pendingImpact.ratingBonus,
  };
  game.pendingImpact = { revenuePct: 0, ratingBonus: 0 };
  const label = cwLabel(s.weekIndex);
  const releaseTicket = createTicket(s, {
    type: 'Release Ticket', gameId, title: `${game.name} - ${label} / ${version}`,
    effort: 0, releaseVersion: version,
  });
  releaseTicket.status = 'IN_DEVELOPMENT'; // visible as "RM preparing" on the board
  const release: Release = {
    id: genId(s, 'rel'), gameId, version, cwLabel: label,
    ticketKeys: included.map((t) => t.key), releaseTicketKey: releaseTicket.key,
    quality, missedBugs, impact, status: 'cutting', shippedWeek: null,
    reportCard: null, decision: null,
  };
  s.releases.push(release);
  s.pendingEvents.push(`📦 Cut ${releaseTicket.title} (soft launch goes out this week)`);
  return release;
}

/** Mutates s: all 'cutting' releases go to 10% soft launch; their tickets are DONE. */
export function shipCuttingReleases(s: GameState): void {
  for (const r of s.releases) {
    if (r.status !== 'cutting') continue;
    r.status = 'soft';
    r.shippedWeek = s.weekIndex;
    for (const key of [...r.ticketKeys, r.releaseTicketKey]) {
      const t = s.tickets.find((x) => x.key === key);
      if (t) {
        t.status = 'DONE';
        t.assigneeId = null;
      }
    }
  }
}

/** Mutates s: soft releases shipped in an earlier week get their report card. Returns arrived ids. */
export function arriveReports(s: GameState, rng: Rng): string[] {
  const arrived: string[] = [];
  for (const r of s.releases) {
    if (r.status === 'soft' && !r.reportCard && r.shippedWeek !== null && r.shippedWeek < s.weekIndex) {
      r.reportCard = deriveReportCard(r, rng);
      arrived.push(r.id);
    }
  }
  return arrived;
}
