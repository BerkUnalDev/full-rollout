// src/engine/endWeek.ts
import { Rng } from './rng';
import { cwLabel } from './week';
import { runDevPhase, runQaPhase } from './work';
import { arriveReports, shipCuttingReleases } from './releases';
import { runEconomy } from './economy';
import { checkDeadlines, generateWeeklyInbox } from './inbox';
import { refreshMarket } from './generators';
import type { GameState } from './types';

/** Pure: resolve the current week and hand back the next one. */
export function endWeek(state: GameState): GameState {
  if (state.status !== 'playing') throw new Error('Game over');
  const s = structuredClone(state);
  const rng = new Rng(s.rngState);
  const cashStart = s.cash;
  const resolvedLabel = cwLabel(s.weekIndex);

  runDevPhase(s, rng);          // 1. devs work
  runQaPhase(s, rng);           // 2. QA tests
  shipCuttingReleases(s);       // 3. cut releases go to 10% soft launch
  runEconomy(s);                // 4. revenue, decay, payroll
  s.weekIndex += 1;             // 5. the calendar turns
  const arrivedIds = arriveReports(s, rng); // 6. last week's soft launches report in
  for (const id of arrivedIds) {
    const r = s.releases.find((x) => x.id === id)!;
    const g = s.games.find((x) => x.id === r.gameId)!;
    s.pendingEvents.push(`📊 Report card arrived: ${g.name} ${r.version} — check Releases`);
  }
  checkDeadlines(s);            // 7. fines & expiries
  generateWeeklyInbox(s, rng);  // 8. fresh requests
  refreshMarket(s, rng);        // 9. fresh candidates & offers

  if (s.cash < 0) {
    s.status = 'bankrupt';
    s.log.push(`${cwLabel(s.weekIndex)}: 💀 Out of cash — the studio is bankrupt`);
  }

  s.lastReport = {
    cwLabel: resolvedLabel,
    cashStart,
    cashEnd: s.cash,
    deltas: s.pendingDeltas,
    events: s.pendingEvents,
    arrivedReleaseIds: arrivedIds,
  };
  s.pendingDeltas = [];
  s.pendingEvents = [];
  s.rngState = rng.state;
  return s;
}
