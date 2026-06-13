// src/ui/screens/InboxScreen.tsx
import { useDispatch, useGame } from '../store';
import { cwLabel } from '../../engine';
import { signedPct } from '../format';
import type { InboxItem } from '../../engine';

const KIND_EMOJI: Record<InboxItem['kind'], string> = {
  feature: '💡', bug: '🐞', opportunity: '🌟', techdebt: '🛠️',
};

export function InboxScreen() {
  const s = useGame();
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending').reverse();
  const tracked = s.inbox.filter((i) => i.kind === 'opportunity' && i.status === 'accepted');
  const resolved = s.inbox.filter((i) => i.status !== 'pending').slice(-6).reverse();
  return (
    <div className="screen">
      <h2>Inbox</h2>
      {pending.length === 0 && <p className="sub">All clear. End the week to see what comes in.</p>}
      {pending.map((i) => (
        <div className="panel" key={i.id}>
          <h3>{KIND_EMOJI[i.kind]} {i.title}</h3>
          <p className="sub">{i.body}</p>
          {i.kind === 'feature' && i.predictedImpact && (
            <p>Predicted: 💰 {signedPct(i.predictedImpact.revenuePct)} revenue</p>
          )}
          {i.deadlineWeek != null && <p>⏰ Deadline: {cwLabel(i.deadlineWeek)}</p>}
          <div className="row">
            <button className="btn green" onClick={() => d.act({ type: 'acceptInbox', itemId: i.id })}>
              Accept
            </button>
            {i.kind !== 'techdebt' ? (
              <button className="btn" onClick={() => d.act({ type: 'declineInbox', itemId: i.id })}>
                Decline
              </button>
            ) : (
              <span className="sub">mandatory — declining means a fine at the deadline</span>
            )}
          </div>
        </div>
      ))}
      {tracked.length > 0 && (
        <div className="panel">
          <h3>Tracked goals</h3>
          {tracked.map((i) => (
            <p key={i.id} className="sub">
              🌟 {i.title} — full rollout by {cwLabel(i.deadlineWeek!)}
            </p>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="panel">
          <h3>Recent</h3>
          {resolved.map((i) => (
            <p key={i.id} className="sub">{KIND_EMOJI[i.kind]} {i.title} — {i.status}</p>
          ))}
        </div>
      )}
    </div>
  );
}
