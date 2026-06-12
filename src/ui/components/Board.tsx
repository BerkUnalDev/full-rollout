// src/ui/components/Board.tsx
import { useGame } from '../store';
import { TicketCard } from './TicketCard';
import type { TicketStatus } from '../../engine';

const COLUMNS: Array<[TicketStatus, string]> = [
  ['TODO', 'To Do'],
  ['IN_DEVELOPMENT', 'In Development'],
  ['AWAITING_QA', 'Awaiting QA'],
  ['IN_QA', 'In QA'],
  ['QA_COMPLETE', 'QA Complete'],
  ['DONE', 'Done'],
];
const DONE_SHOWN = 8;

export function Board({ gameFilter, onOpen }: { gameFilter: string | null; onOpen: (k: string) => void }) {
  const s = useGame();
  const tickets = s.tickets.filter((t) => !gameFilter || t.gameId === gameFilter);
  return (
    <div className="board">
      {COLUMNS.map(([status, label]) => {
        let col = tickets.filter((t) => t.status === status);
        let hidden = 0;
        if (status === 'DONE') {
          hidden = Math.max(0, col.length - DONE_SHOWN);
          col = col.slice(-DONE_SHOWN).reverse();
        }
        return (
          <div className="column" key={status}>
            <div className="col-head">{label} · {col.length + hidden}</div>
            {col.map((t) => <TicketCard key={t.key} t={t} onOpen={onOpen} />)}
            {hidden > 0 && <div className="chip">+{hidden} older</div>}
          </div>
        );
      })}
    </div>
  );
}
