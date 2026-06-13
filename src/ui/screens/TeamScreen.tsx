// src/ui/screens/TeamScreen.tsx
import { useDispatch, useGame } from '../store';
import { memberStats, roleCapacity } from '../../engine';
import { SEVERANCE_WEEKS } from '../../engine/constants';
import { fmtMoney } from '../format';

export function TeamScreen() {
  const s = useGame();
  const d = useDispatch();
  return (
    <div className="screen">
      <h2>Team</h2>
      <div className="panel">
        <h3>Roster</h3>
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Skill</th><th>Stats</th><th className="num">Salary/wk</th><th>Working on</th><th></th></tr>
          </thead>
          <tbody>
            {s.team.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.role}</td>
                <td>{'⭐'.repeat(m.skill)}</td>
                <td className="sub">{memberStats(m.role, m.skill).join(' · ')}</td>
                <td className="num">{fmtMoney(m.salary)}</td>
                <td>{m.outWeeks && m.outWeeks > 0
                  ? <span className="chip warn">🌴 out {m.outWeeks}w</span>
                  : (m.ticketKey ?? <span className="sub">—</span>)}</td>
                <td className="num">
                  <button
                    className="btn red"
                    onClick={() => { if (window.confirm(`Fire ${m.name}? Severance ${fmtMoney(m.salary * SEVERANCE_WEEKS)}.`)) d.act({ type: 'fireMember', memberId: m.id }); }}
                  >
                    Fire ({fmtMoney(m.salary * SEVERANCE_WEEKS)})
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Candidates</h3>
        <p className="sub">Fresh faces every week. Signing fee = 2 weeks of salary.</p>
        <p className="sub">
          Capacity — 👨‍💻 {s.team.filter((m) => m.role === 'Developer').length}/{roleCapacity('Developer', s.studioLevel)} ·
          🧪 {s.team.filter((m) => m.role === 'QA').length}/{roleCapacity('QA', s.studioLevel)} ·
          🚀 {s.team.filter((m) => m.role === 'Release Manager').length}/{roleCapacity('Release Manager', s.studioLevel)}.
          Upgrade the studio to raise caps.
        </p>
        {s.market.candidates.map((c) => (
          <div className="row" key={c.id} style={{ padding: '8px 0', alignItems: 'flex-start' }}>
            <div>
              <div><strong>{c.name}</strong> <span className="pill">{c.role}</span> {'⭐'.repeat(c.skill)}</div>
              <div className="sub">{memberStats(c.role, c.skill).join(' · ')} · {fmtMoney(c.salary)}/wk</div>
            </div>
            <span className="right">
              <button
                className="btn blue"
                disabled={
                  s.cash < c.signingFee || s.status !== 'playing' ||
                  s.team.filter((m) => m.role === c.role).length >= roleCapacity(c.role, s.studioLevel)
                }
                onClick={() => d.act({ type: 'hire', candidateId: c.id })}
              >
                Hire ({fmtMoney(c.signingFee)})
              </button>
            </span>
          </div>
        ))}
        {s.market.candidates.length === 0 && <p className="sub">Nobody this week.</p>}
      </div>
    </div>
  );
}
