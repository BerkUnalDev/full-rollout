// src/ui/components/GameOverScreen.tsx
import { useState } from 'react';
import { useDispatch, useGame } from '../store';
import { companyValue, cwLabel } from '../../engine';
import { fmtMoney } from '../format';

export function GameOverScreen() {
  const s = useGame();
  const d = useDispatch();
  const [copied, setCopied] = useState(false);
  const value = companyValue(s);
  const rollouts = s.releases.filter((r) => r.decision === 'full').length;
  const shareText = [
    '🚀 Full Rollout — bankrupt!',
    `🏢 Final company value: ${fmtMoney(value)}`,
    `📅 Survived ${s.weekIndex} weeks (CW 24/2026 → ${cwLabel(s.weekIndex)})`,
    `🎮 ${s.games.length} games · ✅ ${rollouts} full rollouts`,
    `Play: ${location.href}`,
  ].join('\n');
  return (
    <div className="gameover-backdrop">
      <div className="gameover">
        <div className="skull">💀</div>
        <h2>The studio is bankrupt</h2>
        <div className="score">{fmtMoney(value)}</div>
        <p className="sub">
          final company value · {s.weekIndex} weeks · {s.games.length} games · {rollouts} full rollouts
        </p>
        {s.log.length > 0 && (
          <p className="sub">{s.log.slice(-3).join(' · ')}</p>
        )}
        <div className="share-box">{shareText}</div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            className="btn blue"
            onClick={() => {
              navigator.clipboard.writeText(shareText).then(() => setCopied(true)).catch(() => {});
            }}
          >
            {copied ? 'Copied!' : '📋 Copy score'}
          </button>
          <button className="btn green" onClick={() => d.restart()}>↻ New studio</button>
        </div>
      </div>
    </div>
  );
}
