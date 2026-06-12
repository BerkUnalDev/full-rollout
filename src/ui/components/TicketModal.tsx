// src/ui/components/TicketModal.tsx
import { useDispatch, useGame } from '../store';
import { signedPct, signedNum } from '../format';

export function TicketModal({ ticketKey, onClose }: { ticketKey: string; onClose: () => void }) {
  const s = useGame();
  const d = useDispatch();
  const t = s.tickets.find((x) => x.key === ticketKey);
  if (!t) return null;
  const game = s.games.find((g) => g.id === t.gameId);
  const devPhase = t.status === 'TODO' || t.status === 'IN_DEVELOPMENT';
  const qaPhase = t.status === 'AWAITING_QA' || t.status === 'IN_QA';
  const assignable = t.type !== 'Release Ticket' && (devPhase || qaPhase);
  const pool = s.team.filter((m) => m.role === (devPhase ? 'Developer' : 'QA'));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t.title}</h3>
        <p className="sub">
          {t.key} · {t.type} · {game?.name} · {t.status.replaceAll('_', ' ')}
        </p>
        {t.type === 'Story' && (
          <p>
            Predicted impact: 💰 {signedPct(t.predictedImpact.revenuePct)} revenue,
            ⭐ {signedNum(t.predictedImpact.ratingBonus)} rating
            <br />
            <span className="sub">(predictions can lie — you'll see the truth in the report card)</span>
          </p>
        )}
        {devPhase ? (
          <p>
            Effort: {t.phaseEffort - t.effort}/{t.phaseEffort} points done
            {/* hidden bugs stay hidden — never render t.hiddenBugs! */}
          </p>
        ) : qaPhase ? (
          <p className="sub">
            🔬 Pick a tester below. How long testing takes is anyone's guess —
            you'll know when they're done. {/* qaEffort stays hidden — that's the thrill */}
          </p>
        ) : null}
        {assignable && (
          <select
            className="assign"
            value={t.assigneeId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') d.act({ type: 'unassign', ticketKey: t.key });
              else d.act({ type: 'assign', ticketKey: t.key, memberId: v });
            }}
          >
            <option value="">Unassigned</option>
            {pool.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {'⭐'.repeat(m.skill)}{m.ticketKey && m.ticketKey !== t.key ? ' — busy (will switch)' : ''}
              </option>
            ))}
          </select>
        )}
        {t.status === 'QA_COMPLETE' && <p className="sub">Waiting to be bundled into the next release (Releases screen).</p>}
        <div className="foot">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
