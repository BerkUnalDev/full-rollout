// src/ui/screens/InboxScreen.tsx
import { useDispatch, useGame } from '../store';
import { cwLabel } from '../../engine';
import { signedPct } from '../format';
import type { InboxItem } from '../../engine';

const KIND_EMOJI: Record<InboxItem['kind'], string> = {
  feature: '💡', bug: '🐞', opportunity: '🌟', techdebt: '🛠️',
};

const SECTIONS: { kind: InboxItem['kind']; title: string }[] = [
  { kind: 'feature', title: '💡 Feature requests' },
  { kind: 'bug', title: '🐞 Bug reports' },
  { kind: 'techdebt', title: '🛠️ Tech debt' },
  { kind: 'opportunity', title: '🌟 Opportunities' },
];

export function InboxScreen() {
  const s = useGame();
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending');
  const tracked = s.inbox.filter((i) => i.kind === 'opportunity' && i.status === 'accepted');
  const resolved = s.inbox.filter((i) => i.status !== 'pending').slice(-6).reverse();

  const renderItem = (i: InboxItem) => {
    const locked = !!(i.requiredLevel && s.studioLevel < i.requiredLevel);
    const mandatory = i.kind === 'techdebt' && i.techSubtype === 'mandatory';
    return (
      <div className="panel" key={i.id}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{KIND_EMOJI[i.kind]} {i.title}</h3>
          {locked && <span className="chip locked">🔒 Studio Lv {i.requiredLevel}</span>}
        </div>
        <p className="sub">{i.body}</p>
        {i.kind === 'feature' && i.predictedImpact && (
          <p>Predicted: 💰 {signedPct(i.predictedImpact.revenuePct)} revenue</p>
        )}
        {i.kind === 'techdebt' && i.techSubtype === 'investment' && (
          <p>🔧 Ships → +{i.benefitRevenuePct}% revenue on every game</p>
        )}
        {i.deadlineWeek != null && <p>⏰ Deadline: {cwLabel(i.deadlineWeek)}</p>}
        <div className="row">
          <button
            className="btn green"
            disabled={locked}
            title={locked ? `Requires Studio Level ${i.requiredLevel}` : ''}
            onClick={() => d.act({ type: 'acceptInbox', itemId: i.id })}
          >
            Accept
          </button>
          {mandatory ? (
            <span className="sub">mandatory — declining means a fine at the deadline</span>
          ) : (
            <button className="btn" onClick={() => d.act({ type: 'declineInbox', itemId: i.id })}>
              Decline
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="screen">
      <h2>Inbox</h2>
      {pending.length === 0 && <p className="sub">All clear. End the week to see what comes in.</p>}
      {SECTIONS.map(({ kind, title }) => {
        const items = pending.filter((i) => i.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind}>
            <div className="nav-head" style={{ paddingLeft: 0 }}>{title}</div>
            {items.map(renderItem)}
          </div>
        );
      })}
      {tracked.length > 0 && (
        <div className="panel">
          <h3>Tracked goals</h3>
          {tracked.map((i) => (
            <p key={i.id} className="sub">🌟 {i.title} — full rollout by {cwLabel(i.deadlineWeek!)}</p>
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
