// src/ui/screens/ReportsScreen.tsx
import { useState } from 'react';
import { useGame } from '../store';
import { fmtMoney } from '../format';
import { WeeklyReportModal } from '../components/WeeklyReportModal';
import type { WeeklyReport } from '../../engine';

export function ReportsScreen() {
  const s = useGame();
  const [open, setOpen] = useState<WeeklyReport | null>(null);
  const reports = [...s.reportHistory].reverse(); // newest first
  return (
    <div className="screen">
      <h2>Reports</h2>
      <p className="sub">Your last {s.reportHistory.length} weekly reports. Click one to re-read it.</p>
      {reports.length === 0 && <p className="sub">No reports yet — end a week.</p>}
      {reports.map((r, i) => {
        const net = r.cashEnd - r.cashStart;
        return (
          <div className="panel" key={`${r.cwLabel}-${i}`} style={{ cursor: 'pointer' }} onClick={() => setOpen(r)}>
            <div className="row">
              <strong>{r.cwLabel}</strong>
              <span className={`right num ${net >= 0 ? 'pos' : 'neg'}`}>{fmtMoney(net)}</span>
            </div>
            <p className="sub">{r.events.length} event(s) · click to read</p>
          </div>
        );
      })}
      {open && <WeeklyReportModal report={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
