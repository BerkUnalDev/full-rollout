// src/ui/screens/MarketScreen.tsx
import { useState } from 'react';
import { useDispatch, useGame } from '../store';
import { GENRES, NEW_GAME_COST, STUDIO_LEVEL_CAP, maxGamesFor, nextUpgradeCost } from '../../engine';
import { fmtMoney, fmtPlayers, stars } from '../format';
import type { Genre } from '../../engine';

export function MarketScreen() {
  const s = useGame();
  const d = useDispatch();
  const [genre, setGenre] = useState<Genre>('Puzzle');
  const upgradeCost = nextUpgradeCost(s.studioLevel);
  const slots = maxGamesFor(s.studioLevel);
  const atGameCap = s.games.length >= slots;
  return (
    <div className="screen">
      <h2>Market</h2>

      <div className="panel">
        <h3>🏢 Studio — Level {s.studioLevel}</h3>
        <p className="sub">
          Games {s.games.length}/{slots}. Higher levels unlock bigger features &amp; tech-debt work and more game slots. Upgrades are instant.
        </p>
        <div className="row">
          {upgradeCost === null ? (
            <span className="sub">Maxed out at Level {STUDIO_LEVEL_CAP} 🎉</span>
          ) : (
            <>
              <span className="sub">Next: Level {s.studioLevel + 1} → up to {maxGamesFor(s.studioLevel + 1)} games</span>
              <span className="right">
                <button
                  className="btn blue"
                  disabled={s.cash < upgradeCost || s.status !== 'playing'}
                  onClick={() => d.act({ type: 'upgradeStudio' })}
                >
                  Upgrade ({fmtMoney(upgradeCost)})
                </button>
              </span>
            </>
          )}
        </div>
      </div>

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
                disabled={s.cash < o.price || atGameCap || s.status !== 'playing'}
                title={atGameCap ? 'Studio at game capacity — upgrade your studio' : ''}
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
            disabled={s.cash < NEW_GAME_COST || atGameCap || s.status !== 'playing'}
            title={atGameCap ? 'Studio at game capacity — upgrade your studio' : ''}
            onClick={() => d.act({ type: 'startNewGame', genre })}
          >
            Start ({fmtMoney(NEW_GAME_COST)})
          </button>
        </div>
      </div>
    </div>
  );
}
