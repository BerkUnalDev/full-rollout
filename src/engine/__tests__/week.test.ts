// src/engine/__tests__/week.test.ts
import { weekToCW, cwLabel } from '../week';

describe('week helpers', () => {
  it('weekIndex 0 is CW 24/2026', () => {
    expect(weekToCW(0)).toEqual({ week: 24, year: 2026 });
  });

  it('rolls over the year after CW 52', () => {
    expect(weekToCW(28)).toEqual({ week: 52, year: 2026 });
    expect(weekToCW(29)).toEqual({ week: 1, year: 2027 });
    expect(weekToCW(29 + 52)).toEqual({ week: 1, year: 2028 });
  });

  it('formats labels', () => {
    expect(cwLabel(0)).toBe('CW 24/2026');
    expect(cwLabel(29)).toBe('CW 1/2027');
  });

  it('handles negative weekIndex (lastRolloutWeek before game start)', () => {
    expect(weekToCW(-8)).toEqual({ week: 16, year: 2026 });
    expect(weekToCW(-24)).toEqual({ week: 52, year: 2025 });
  });
});
