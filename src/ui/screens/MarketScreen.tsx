// src/ui/screens/MarketScreen.tsx
import { useState } from 'react';
import { useDispatch, useGame } from '../store';
import { GENRES, NEW_GAME_COST } from '../../engine';
import { fmtMoney, fmtPlayers, stars } from '../format';
import type { Genre } from '../../engine';

export function MarketScreen() {
  const s = useGame();
  const d = useDispatch();
  const [genre, setGenre] = useState<Genre>('Puzzle');
  return (
    <div className="screen">
      <h2>Market</h2>
      <div className="panel">
        <h3>Games for sale</h3>
        <p className="sub">Studios offload titles every week. Buy one and it joins your board.</p>
        {s.market.offers.map((o) => (
          <div className="row" key={o.id} style={{ padding: '8px 0' }}>
            <strong>{o.name}</strong>
            <span className="pill">{o.genre}</span>
            <span className="sub">
              👤 {fmtPlayers(o.players)} · {stars(o.rating)} · {fmtMoney(Math.round(o.players * o.revenuePerPlayer))}/wk
            </span>
            <span className="right">
              <button
                className="btn blue"
                disabled={s.cash < o.price || s.status !== 'playing'}
                onClick={() => d.act({ type: 'buyGame', offerId: o.id })}
              >
                Buy ({fmtMoney(o.price)})
              </button>
            </span>
          </div>
        ))}
        {s.market.offers.length === 0 && <p className="sub">Nothing on the market this week.</p>}
      </div>
      <div className="panel">
        <h3>Start a new game</h3>
        <p className="sub">
          {fmtMoney(NEW_GAME_COST)} for a prototype. Build its 1.0.0 stories, ship the first release,
          and quality decides how many players show up.
        </p>
        <div className="row">
          <select className="assign" style={{ width: 200 }} value={genre} onChange={(e) => setGenre(e.target.value as Genre)}>
            {GENRES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button
            className="btn green"
            disabled={s.cash < NEW_GAME_COST || s.status !== 'playing'}
            onClick={() => d.act({ type: 'startNewGame', genre })}
          >
            Start ({fmtMoney(NEW_GAME_COST)})
          </button>
        </div>
      </div>
    </div>
  );
}
