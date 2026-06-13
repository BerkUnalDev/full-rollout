// src/ui/components/WeeklyReportModal.tsx
import { useGame } from '../store';
import { fmtMoney } from '../format';
import type { WeeklyReport } from '../../engine';

const BAD = ['⚠️', '🚨', '📉', '🔁', '↩️', '⌛', '💀'];
const isBad = (e: string) => BAD.some((m) => e.startsWith(m));

export function WeeklyReportModal({ report, onClose }: { report?: WeeklyReport; onClose: () => void }) {
  const s = useGame();
  const r = report ?? s.lastReport;
  if (!r) return null;
  const net = r.cashEnd - r.cashStart;
  const good = r.events.filter((e) => !isBad(e));
  const bad = r.events.filter(isBad);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Weekly report — {r.cwLabel}</h3>
        <table className="table" style={{ marginTop: 10 }}>
          <tbody>
            {r.deltas.map((dl, i) => (
              <tr key={i}>
                <td>{dl.label}</td>
                <td className={`num ${dl.amount >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(dl.amount)}</td>
              </tr>
            ))}
            <tr>
              <td><strong>Net</strong></td>
              <td className={`num ${net >= 0 ? 'pos' : 'neg'}`}><strong>{fmtMoney(net)}</strong></td>
            </tr>
          </tbody>
        </table>
        {good.length > 0 && (
          <>
            <div className="nav-head" style={{ paddingLeft: 0 }}>🟢 Good week</div>
            <ul style={{ lineHeight: 1.8, margin: 0 }}>{good.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </>
        )}
        {bad.length > 0 && (
          <>
            <div className="nav-head" style={{ paddingLeft: 0 }}>🔴 Needs attention</div>
            <ul style={{ lineHeight: 1.8, margin: 0 }}>{bad.map((e, i) => <li key={i}>{e}</li>)}</ul>
          </>
        )}
        <div className="foot">
          <button className="btn blue" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
