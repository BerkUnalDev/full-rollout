// src/ui/screens/ReleasesScreen.tsx
import { useDispatch, useGame } from '../store';
import { canCutRelease, qaCompleteFor } from '../../engine';
import { fmtMoney, fmtPlayers, stars, HAPPY, signedPct, signedNum } from '../format';
import type { Release } from '../../engine';

function ReportCardView({ r }: { r: Release }) {
  const card = r.reportCard!;
  const h = HAPPY[card.happiness];
  return (
    <div className="report-grid">
      <div className="metric"><div className="big">{h.emoji}</div><div className="lbl">{h.label}</div></div>
      <div className="metric"><div className="big">🐛 {card.bugReports}</div><div className="lbl">Bug reports</div></div>
      <div className="metric">
        <div className={`big ${card.revenueImpactPct >= 0 ? 'pos' : 'neg'}`}>{signedPct(card.revenueImpactPct)}</div>
        <div className="lbl">Revenue</div>
      </div>
      <div className="metric">
        <div className={`big ${card.ratingDelta >= 0 ? 'pos' : 'neg'}`}>{signedNum(card.ratingDelta)}★</div>
        <div className="lbl">Rating</div>
      </div>
    </div>
  );
}

export function ReleasesScreen() {
  const s = useGame();
  const d = useDispatch();
  return (
    <div className="screen">
      <h2>Releases</h2>
      {s.games.map((g) => {
        const pending = s.releases.find((r) => r.gameId === g.id && r.status !== 'decided');
        const history = s.releases.filter((r) => r.gameId === g.id && r.status === 'decided').slice(-5).reverse();
        const check = canCutRelease(s, g.id);
        const ready = qaCompleteFor(s, g.id).length;
        return (
          <div className="panel" key={g.id}>
            <div className="row">
              <h3>{g.name}</h3>
              <span className="pill">{g.genre}</span>
              <span className="sub">v{g.version}</span>
              <span className="right sub">
                {g.players > 0
                  ? <>👤 {fmtPlayers(g.players)} · {stars(g.rating)} · {fmtMoney(Math.round(g.players * g.revenuePerPlayer))}/wk</>
                  : 'in development — no players yet'}
              </span>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="sub">{ready} ticket(s) ready for release</span>
              <span className="right">
                <button
                  className="btn blue"
                  disabled={!check.ok}
                  title={check.ok ? '' : check.reason}
                  onClick={() => d.act({ type: 'cutRelease', gameId: g.id })}
                >
                  Cut Release{check.nextVersion ? ` v${check.nextVersion}` : ''}
                </button>
              </span>
            </div>
            {pending && (
              <div style={{ marginTop: 12 }}>
                <strong>{pending.cwLabel} / {pending.version}</strong>
                {pending.status === 'cutting' && (
                  <p className="sub">🚧 Release manager is on it — soft launch goes out this week.</p>
                )}
                {pending.status === 'soft' && !pending.reportCard && (
                  <p className="sub">📡 Live at 10%. The report card lands next week.</p>
                )}
                {pending.status === 'soft' && pending.reportCard && (
                  <>
                    <ReportCardView r={pending} />
                    <div className="row">
                      <button className="btn green" onClick={() => d.act({ type: 'fullRollout', releaseId: pending.id })}>
                        ✅ Full Rollout
                      </button>
                      <button className="btn red" onClick={() => d.act({ type: 'pullBack', releaseId: pending.id })}>
                        ↩️ Pull Back & Fix
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {history.length > 0 && (
              <p className="sub" style={{ marginTop: 12 }}>
                History: {history.map((r) => `${r.decision === 'full' ? '✅' : '↩️'} ${r.version}`).join(' · ')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
