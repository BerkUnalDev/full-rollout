// src/ui/components/WeeklyReportModal.tsx
import { useGame } from '../store';
import { fmtMoney } from '../format';
import type { WeeklyReport } from '../../engine';

export function WeeklyReportModal({ report, onClose }: { report?: WeeklyReport; onClose: () => void }) {
  const s = useGame();
  const r = report ?? s.lastReport;
  if (!r) return null;
  const net = r.cashEnd - r.cashStart;
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
        {r.events.length > 0 && (
          <ul style={{ lineHeight: 1.8, marginTop: 12 }}>
            {r.events.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        )}
        <div className="foot">
          <button className="btn blue" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
