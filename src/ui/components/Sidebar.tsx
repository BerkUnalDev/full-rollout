// src/ui/components/Sidebar.tsx
import { useGame } from '../store';
import { fmtPlayers } from '../format';
import { DECAY_GRACE_WEEKS } from '../../engine';
import type { Screen } from '../App';

interface Props {
  screen: Screen;
  setScreen: (s: Screen) => void;
  gameFilter: string | null;
  setGameFilter: (id: string | null) => void;
}

export function Sidebar({ screen, setScreen, gameFilter, setGameFilter }: Props) {
  const s = useGame();
  const pending = s.inbox.filter((i) => i.status === 'pending').length;
  const nav = (id: Screen, label: string, badge?: number) => (
    <button
      className={`nav-item ${screen === id ? 'active' : ''}`}
      onClick={() => setScreen(id)}
    >
      {label}
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="nav-head">Studio</div>
      {nav('board', '📋 Board')}
      {nav('releases', '📦 Releases')}
      {nav('inbox', '📨 Inbox', pending)}
      {nav('team', '👥 Team')}
      {nav('market', '🛒 Market')}
      {nav('reports', '📜 Reports')}
      <div className="nav-head">Games</div>
      <button
        className={`nav-item ${gameFilter === null ? 'active' : ''}`}
        onClick={() => { setGameFilter(null); setScreen('board'); }}
      >
        All games
      </button>
      {s.games.map((g) => {
        const stale = s.weekIndex - g.lastRolloutWeek > DECAY_GRACE_WEEKS && g.players > 0;
        return (
          <button
            key={g.id}
            className={`nav-item ${gameFilter === g.id ? 'active' : ''}`}
            onClick={() => { setGameFilter(g.id); setScreen('board'); }}
          >
            <span className="dot" />
            {g.name} {stale ? '🔻' : ''}
            <span className="muted">{g.players > 0 ? fmtPlayers(g.players) : 'dev'}</span>
          </button>
        );
      })}
    </aside>
  );
}
