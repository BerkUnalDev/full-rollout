// src/ui/components/TicketCard.tsx
import { useState } from 'react';
import { useGame } from '../store';
import { cwLabel } from '../../engine';
import { initials } from '../format';
import type { Ticket } from '../../engine';

const TYPE_META: Record<Ticket['type'], { cls: string; letter: string }> = {
  Story: { cls: 'story', letter: 'S' },
  Bug: { cls: 'bug', letter: 'B' },
  'Release Ticket': { cls: 'release', letter: 'R' },
  Task: { cls: 'task', letter: 'T' },
  'Tech Debt': { cls: 'techdebt', letter: 'D' },
};

export function TicketCard({ t, onOpen }: { t: Ticket; onOpen: (k: string) => void }) {
  const s = useGame();
  const [info, setInfo] = useState(false);
  const assignee = t.assigneeId ? s.team.find((m) => m.id === t.assigneeId) : null;
  const meta = TYPE_META[t.type];
  const lockedInRelease = s.releases.some(
    (r) => r.status !== 'decided' && r.ticketKeys.includes(t.key),
  );
  const devProgress =
    t.status === 'IN_DEVELOPMENT' && t.pointsWorked > 0
      ? Math.round(((t.phaseEffort - t.effort) / t.phaseEffort) * 100)
      : null;
  const isTech = t.type === 'Tech Debt';
  const techGist = !isTech ? null
    : t.techSubtype === 'investment'
      ? `🔧 +${t.benefitRevenuePct}% rev (all games)`
      : '⏰ compliance — fine if late';
  const successText = t.techSubtype === 'investment'
    ? `+${t.benefitRevenuePct}% revenue on every game you own`
    : 'clears the compliance deadline (no fine)';

  return (
    <div className="card" onClick={() => onOpen(t.key)}>
      <div className="title">{t.title}</div>
      <div className="meta">
        <span className={`type-icon ${meta.cls}`}>{meta.letter}</span>
        <span className="key">{t.key}</span>
        {t.deadlineWeek !== null && <span className="chip warn">⏰ {cwLabel(t.deadlineWeek)}</span>}
        {lockedInRelease && t.status === 'QA_COMPLETE' && <span className="chip locked">📦 in release</span>}
        <span className="right">
          {isTech && (
            <button
              className="q-badge"
              title="What happens on success / failure"
              onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
            >
              ?
            </button>
          )}
          {assignee && <span className="avatar" title={assignee.name}>{initials(assignee.name)}</span>}
        </span>
      </div>
      {techGist && <div className="chip" style={{ marginTop: 6 }}>{techGist}</div>}
      {devProgress !== null && (
        <div className="progress"><div style={{ width: `${devProgress}%` }} /></div>
      )}
      {isTech && info && (
        <div className="popover" onClick={(e) => e.stopPropagation()}>
          <p><strong>If it ships:</strong> {successText}</p>
          <p><strong>If it fails:</strong> bounces back for rework + $500. Lower-skill devs hit technical errors more often.</p>
        </div>
      )}
    </div>
  );
}
