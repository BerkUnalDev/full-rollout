// src/ui/components/TopBar.tsx
import { useGame } from '../store';
import { cwLabel } from '../../engine';
import { fmtMoney } from '../format';

export function TopBar({ onEndWeek }: { onEndWeek: () => void }) {
  const s = useGame();
  return (
    <header className="topbar">
      <div className="logo">
        🚀 Full Rollout <span>ship or sink</span>
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
