// src/ui/screens/MarketScreen.tsx
import { useState } from 'react';
import { useDispatch, useGame } from '../store';
import { GENRES, NEW_GAME_COST, STUDIO_LEVEL_CAP, maxGamesFor, nextUpgradeCost, studioGameRequirement } from '../../engine';
import { SELL_PRICE_FLOOR, SELL_PRICE_WEEKS } from '../../engine/constants';
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
            (() => {
              const gamesReq = studioGameRequirement(s.studioLevel);
              const needGames = s.games.length < gamesReq;
              const canAfford = s.cash >= upgradeCost;
              return (
                <>
                  <span className="sub">
                    Next: Level {s.studioLevel + 1} → up to {maxGamesFor(s.studioLevel + 1)} games · needs {gamesReq} games (have {s.games.length})
                  </span>
                  <span className="right">
                    <button
                      className="btn blue"
                      disabled={needGames || !canAfford || s.status !== 'playing'}
                      title={needGames ? `Own ${gamesReq} games first` : (!canAfford ? 'Not enough cash' : '')}
                      onClick={() => d.act({ type: 'upgradeStudio' })}
                    >
                      Upgrade ({fmtMoney(upgradeCost)})
                    </button>
                  </span>
                </>
              );
            })()
          )}
        </div>
      </div>

      <div className="panel">
        <h3>Your games</h3>
        <p className="sub">Sell a title for a one-off cash injection (≈{SELL_PRICE_WEEKS}× its weekly revenue). You can't sell a game mid-release.</p>
        {s.games.map((g) => {
          const weekly = Math.round(g.players * g.revenuePerPlayer);
          const price = Math.max(SELL_PRICE_FLOOR, Math.round(weekly * SELL_PRICE_WEEKS));
          const inFlight = s.releases.some((r) => r.gameId === g.id && r.status !== 'decided');
          return (
            <div className="row" key={g.id} style={{ padding: '8px 0' }}>
              <strong>{g.name}</strong>
              <span className="sub">{fmtMoney(weekly)}/wk</span>
              <span className="right">
                <button
                  className="btn red"
                  disabled={inFlight || s.status !== 'playing'}
                  title={inFlight ? 'Finish the in-flight release first' : ''}
                  onClick={() => { if (window.confirm(`Sell ${g.name} for ${fmtMoney(price)}? Its tickets are removed.`)) d.act({ type: 'sellGame', gameId: g.id }); }}
                >
                  Sell ({fmtMoney(price)})
                </button>
              </span>
            </div>
          );
        })}
        {s.games.length === 0 && <p className="sub">You don't own any games yet.</p>}
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
