// src/ui/components/TicketCard.tsx
import { useGame } from '../store';
import { cwLabel } from '../../engine';
import { initials } from '../format';
import type { Ticket } from '../../engine';

const TYPE_META: Record<Ticket['type'], { cls: string; letter: string }> = {
  Story: { cls: 'story', letter: 'S' },
  Bug: { cls: 'bug', letter: 'B' },
  'Release Ticket': { cls: 'release', letter: 'R' },
  Task: { cls: 'task', letter: 'T' },
  'Tech Debt': { cls: 'task', letter: 'D' },
};

export function TicketCard({ t, onOpen }: { t: Ticket; onOpen: (k: string) => void }) {
  const s = useGame();
  const assignee = t.assigneeId ? s.team.find((m) => m.id === t.assigneeId) : null;
  const meta = TYPE_META[t.type];
  const lockedInRelease = s.releases.some(
    (r) => r.status !== 'decided' && r.ticketKeys.includes(t.key),
  );
  const devProgress =
    t.status === 'IN_DEVELOPMENT' && t.pointsWorked > 0
      ? Math.round(((t.phaseEffort - t.effort) / t.phaseEffort) * 100)
      : null;
  return (
    <div className="card" onClick={() => onOpen(t.key)}>
      <div className="title">{t.title}</div>
      <div className="meta">
        <span className={`type-icon ${meta.cls}`}>{meta.letter}</span>
        <span className="key">{t.key}</span>
        {t.deadlineWeek !== null && <span className="chip warn">⏰ {cwLabel(t.deadlineWeek)}</span>}
        {lockedInRelease && t.status === 'QA_COMPLETE' && <span className="chip locked">📦 in release</span>}
        <span className="right">
          {assignee && <span className="avatar" title={assignee.name}>{initials(assignee.name)}</span>}
        </span>
      </div>
      {devProgress !== null && (
        <div className="progress"><div style={{ width: `${devProgress}%` }} /></div>
      )}
    </div>
  );
}
