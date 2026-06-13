// src/ui/screens/InboxScreen.tsx
import { useDispatch, useGame } from '../store';
import { cwLabel, FEATURE_CAP_PER_GAME } from '../../engine';
import { signedPct } from '../format';
import type { InboxItem } from '../../engine';

const KIND_EMOJI: Record<InboxItem['kind'], string> = {
  feature: '💡', bug: '🐞', opportunity: '🌟', techdebt: '🛠️',
};

export function InboxScreen() {
  const s = useGame();
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending');
  const tracked = s.inbox.filter((i) => i.kind === 'opportunity' && i.status === 'accepted');
  const resolved = s.inbox.filter((i) => i.status !== 'pending').slice(-6).reverse();
  const featureCap = s.games.length * FEATURE_CAP_PER_GAME;
  const featureCount = pending.filter((i) => i.kind === 'feature').length;

  const renderItem = (i: InboxItem) => {
    const locked = !!(i.requiredLevel && s.studioLevel < i.requiredLevel);
    const isTech = i.kind === 'techdebt';
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
        {isTech && i.techSubtype === 'investment' && (
          <p>🔧 Ships → +{i.benefitRevenuePct}% revenue on every game</p>
        )}
        {i.kind === 'opportunity' && (
          <p className="sub">
            🎯 Reward: +{Math.round((i.rewardPlayersPct ?? 0) * 100)}% players if you full-roll {gameName(i.gameId)} by {i.deadlineWeek != null ? cwLabel(i.deadlineWeek) : '—'} · 💵 costs $1,500 to accept · ❌ miss = lose the boost (no penalty)
          </p>
        )}
        {i.deadlineWeek != null && i.kind !== 'opportunity' && <p>⏰ Deadline: {cwLabel(i.deadlineWeek)}</p>}
        <div className="row">
          <button
            className="btn green"
            disabled={locked}
            title={locked ? `Requires Studio Level ${i.requiredLevel}` : ''}
            onClick={() => d.act({ type: 'acceptInbox', itemId: i.id })}
          >
            Accept
          </button>
          {isTech ? (
            <span className="sub">mandatory engineering — can't decline; fine if the deadline lapses</span>
          ) : (
            <button className="btn" onClick={() => d.act({ type: 'declineInbox', itemId: i.id })}>
              Decline
            </button>
          )}
        </div>
      </div>
    );
  };

  function gameName(id: string) {
    return s.games.find((g) => g.id === id)?.name ?? 'the game';
  }

  const sections: { kind: InboxItem['kind']; title: string }[] = [
    { kind: 'feature', title: `💡 Feature requests (${featureCount}/${featureCap})` },
    { kind: 'bug', title: '🐞 Bug reports' },
    { kind: 'techdebt', title: '🛠️ Tech debt' },
    { kind: 'opportunity', title: '🌟 Opportunities' },
  ];

  return (
    <div className="screen">
      <h2>Inbox</h2>
      {pending.length === 0 && <p className="sub">All clear. End the week to see what comes in.</p>}
      {sections.map(({ kind, title }) => {
        const items = pending.filter((i) => i.kind === kind);
        if (items.length === 0 && kind !== 'feature') return null;
        return (
          <div key={kind}>
            <div className="nav-head" style={{ paddingLeft: 0 }}>{title}</div>
            {kind === 'feature' && featureCount >= featureCap && (
              <p className="sub">Full — decline some to make room for new requests (or buy/start a game to raise the cap).</p>
            )}
            {items.map(renderItem)}
          </div>
        );
      })}
      {tracked.length > 0 && (
        <div className="panel">
          <h3>🌟 Tracked featuring</h3>
          {tracked.map((i) => (
            <p key={i.id} className="sub">
              {gameName(i.gameId)} — full-roll by {i.deadlineWeek != null ? cwLabel(i.deadlineWeek) : '—'} → +{Math.round((i.rewardPlayersPct ?? 0) * 100)}% players · miss = no penalty
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
