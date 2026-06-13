// src/engine/__tests__/report-history.test.ts
import { newGame } from '../newGame';
import { endWeek } from '../endWeek';
import { REPORT_HISTORY_CAP } from '../constants';

describe('report history', () => {
  it('accumulates the just-finished report and caps at REPORT_HISTORY_CAP', () => {
    let s = newGame(3);
    expect(s.reportHistory).toEqual([]);
    s = endWeek(s);
    expect(s.reportHistory).toHaveLength(1);
    expect(s.reportHistory[0].cwLabel).toBe(s.lastReport!.cwLabel);
    for (let i = 0; i < REPORT_HISTORY_CAP + 5 && s.status === 'playing'; i++) s = endWeek(s);
    expect(s.reportHistory.length).toBeLessThanOrEqual(REPORT_HISTORY_CAP);
    // newest is last
    expect(s.reportHistory[s.reportHistory.length - 1].cwLabel).toBe(s.lastReport!.cwLabel);
  });
});
