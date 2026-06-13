// src/ui/components/TopBar.tsx
import { useGame } from '../store';
import { cwLabel, roleCapacity } from '../../engine';
import { fmtMoney } from '../format';

export function TopBar({ onEndWeek }: { onEndWeek: () => void }) {
  const s = useGame();
  const count = (role: Parameters<typeof roleCapacity>[0]) => s.team.filter((m) => m.role === role).length;
  const idle = (role: Parameters<typeof roleCapacity>[0]) =>
    s.team.filter((m) => m.role === role && !m.ticketKey).length;
  return (
    <header className="topbar">
      <div className="logo">
        🚀 Full Rollout <span>ship or sink</span>
      </div>
      <div className="team-strip">
        <span className="tm-chip" title="Developers hired / capacity · idle">
          👨‍💻 {count('Developer')}/{roleCapacity('Developer', s.studioLevel)}
          {idle('Developer') ? ` ·${idle('Developer')} free` : ''}
        </span>
        <span className="tm-chip" title="QA hired / capacity · idle">
          🧪 {count('QA')}/{roleCapacity('QA', s.studioLevel)}
          {idle('QA') ? ` ·${idle('QA')} free` : ''}
        </span>
        <span className="tm-chip" title="Release managers hired / capacity">
          🚀 {count('Release Manager')}/{roleCapacity('Release Manager', s.studioLevel)}
        </span>
      </div>
      <div className="spacer" />
      <div className="stat-chip">🏢 Lv {s.studioLevel}</div>
      <div className={`stat-chip ${s.cash < 5000 ? 'low' : ''}`}>{fmtMoney(s.cash)}</div>
      <div className="stat-chip">{cwLabel(s.weekIndex)}</div>
      <button className="btn primary" onClick={onEndWeek} disabled={s.status !== 'playing'}>
        End Week ▸
      </button>
    </header>
  );
}
