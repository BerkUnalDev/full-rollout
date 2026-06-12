// src/ui/store.tsx
import React, { createContext, useContext, useEffect, useReducer } from 'react';
import {
  applyAction, deserialize, endWeek, newGame, serialize, SAVE_KEY,
} from '../engine';
import type { GameState, PlanAction } from '../engine';

interface Dispatch {
  act: (a: PlanAction) => void; // invalid actions are swallowed — UI disables them
  week: () => void;
  restart: () => void;
}

const StateCtx = createContext<GameState | null>(null);
const DispatchCtx = createContext<Dispatch | null>(null);

type Msg = { t: 'act'; a: PlanAction } | { t: 'week' } | { t: 'restart' };

// The engine never touches Math.random — but the UI picking a fresh seed is fine.
const freshSeed = () => Math.floor(Math.random() * 2 ** 31);

function reducer(s: GameState, m: Msg): GameState {
  try {
    if (m.t === 'act') return applyAction(s, m.a);
    if (m.t === 'week') return endWeek(s);
    return newGame(freshSeed());
  } catch (e) {
    console.warn('[full-rollout] rejected:', e);
    return s;
  }
}

function init(): GameState {
  const raw = localStorage.getItem(SAVE_KEY);
  const loaded = raw ? deserialize(raw) : null;
  return loaded ?? newGame(freshSeed());
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  useEffect(() => {
    localStorage.setItem(SAVE_KEY, serialize(state));
  }, [state]);
  const api: Dispatch = {
    act: (a) => dispatch({ t: 'act', a }),
    week: () => dispatch({ t: 'week' }),
    restart: () => dispatch({ t: 'restart' }),
  };
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={api}>{children}</DispatchCtx.Provider>
    </StateCtx.Provider>
  );
}

export function useGame(): GameState {
  return useContext(StateCtx)!;
}
export function useDispatch(): Dispatch {
  return useContext(DispatchCtx)!;
}
