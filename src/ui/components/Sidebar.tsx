// src/ui/components/Sidebar.tsx
import { useDispatch, useGame } from '../store';
import { fmtPlayers, gameLogo } from '../format';
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
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending').length;
  const techPending = s.inbox.filter((i) => i.status === 'pending' && i.kind === 'techdebt').length;
  const nav = (id: Screen, label: string, badge?: number) => (
    <button className={`nav-item ${screen === id ? 'active' : ''}`} onClick={() => setScreen(id)}>
      {label}
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="nav-head">Studio</div>
      {nav('board', '📋 Board')}
      {nav('releases', '📦 Releases')}
      <button className={`nav-item ${screen === 'inbox' ? 'active' : ''}`} onClick={() => setScreen('inbox')}>
        📨 Inbox
        <span className="right" style={{ display: 'flex', gap: 4 }}>
          {techPending ? <span className="badge tech" title="Tech debt waiting">{techPending}</span> : null}
          {pending ? <span className="badge">{pending}</span> : null}
        </span>
      </button>
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
        const hasOpenBug = s.tickets.some((t) => t.gameId === g.id && t.type === 'Bug' && t.status !== 'DONE');
        const stale = s.weekIndex - g.lastRolloutWeek > DECAY_GRACE_WEEKS && g.players > 0;
        const outage = (g.outageWeeks ?? 0) > 0;
        return (
          <button
            key={g.id}
            className={`nav-item ${gameFilter === g.id ? 'active' : ''}`}
            onClick={() => { setGameFilter(g.id); setScreen('board'); }}
          >
            <span className="game-logo">{gameLogo(g.id)}</span>
            {g.name}
            {hasOpenBug ? <span title="open bug hurting this game"> 🔻</span> : null}
            {stale ? <span title="no rollout in a while — players decaying"> 💤</span> : null}
            {outage ? <span title="server outage — no revenue"> 🔌</span> : null}
            <span className="muted">{g.players > 0 ? fmtPlayers(g.players) : 'dev'}</span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button
        className="btn subtle"
        style={{ margin: '12px 8px 4px', width: 'calc(100% - 16px)' }}
        onClick={() => { if (window.confirm('Start a new studio? Current progress is lost.')) d.restart(); }}
      >
        ↻ New game
      </button>
    </aside>
  );
}
