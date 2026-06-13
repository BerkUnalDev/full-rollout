// src/engine/__tests__/team.test.ts
import { memberStats } from '../team';
import { speedOf, QA_CATCH_BASE, QA_CATCH_PER_SKILL } from '../constants';

describe('memberStats', () => {
  it('developer shows build speed and bug-proneness', () => {
    const lines = memberStats('Developer', 5);
    expect(lines[0]).toContain(`${speedOf(5)}`);
    expect(lines.join(' ')).toMatch(/very low/);
    expect(memberStats('Developer', 1).join(' ')).toMatch(/very high/);
  });

  it('QA shows test speed and catch rate %', () => {
    const lines = memberStats('QA', 3);
    const rate = Math.round((QA_CATCH_BASE + QA_CATCH_PER_SKILL * 3) * 100);
    expect(lines.join(' ')).toContain(`${rate}%`);
    expect(lines[0]).toContain(`${speedOf(3)}`);
  });

  it('release manager shows releases/week', () => {
    expect(memberStats('Release Manager', 2).join(' ')).toMatch(/2 releases\/week/);
    expect(memberStats('Release Manager', 1).join(' ')).toMatch(/1 release\/week/);
  });
});
