// src/ui/screens/TeamScreen.tsx
import { useDispatch, useGame } from '../store';
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
            <tr><th>Name</th><th>Role</th><th>Skill</th><th className="num">Salary/wk</th><th>Working on</th></tr>
          </thead>
          <tbody>
            {s.team.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.role}</td>
                <td>{'⭐'.repeat(m.skill)}</td>
                <td className="num">{fmtMoney(m.salary)}</td>
                <td>{m.ticketKey ?? <span className="sub">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Candidates</h3>
        <p className="sub">Fresh faces every week. Signing fee = 2 weeks of salary.</p>
        {s.market.candidates.map((c) => (
          <div className="row" key={c.id} style={{ padding: '6px 0' }}>
            <span>{c.name}</span>
            <span className="pill">{c.role}</span>
            <span>{'⭐'.repeat(c.skill)}</span>
            <span className="sub">{fmtMoney(c.salary)}/wk</span>
            <span className="right">
              <button
                className="btn blue"
                disabled={s.cash < c.signingFee || s.status !== 'playing'}
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
