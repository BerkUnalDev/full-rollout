# Full Rollout v2.1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Twelve refinements (spec: `docs/superpowers/specs/2026-06-13-full-rollout-v2.1-features.md`) — studio treadmill, fire, sell games, featuring fee + celebration, tech-debt deadlines/cadence, scaling feature cap, hire caps, game logos, new-game button, readable reports — to the live Full Rollout game.

**Architecture:** Extends the pure-function engine (`src/engine/`, seeded RNG, TDD/vitest) and thin React UI. **No save-schema bump** (`SCHEMA_VERSION` stays 2; only an optional `celebration` field is added). All numbers in `constants.ts`.

**Tech Stack:** Vite + React + TypeScript + vitest.

---

## Conventions (every task)
- Engine entry points clone-first, mutate clone, write `rngState` back. No `Math.random`/`Date` in `src/engine/`.
- Tech-debt tickets are studio-wide (`gameId === ''`). Hidden info never rendered.
- Run `npm test` + `npm run build` green before each commit. Work on branch `feature/v2.1-features` — never checkout SHAs / reset / new branches.

---

### Task 1: Constants, types, studio-module rewrite

**Files:**
- Modify: `src/engine/constants.ts`, `src/engine/types.ts`, `src/engine/studio.ts`, `src/engine/newGame.ts`
- Test: `src/engine/__tests__/studio.test.ts` (extend)

- [ ] **Step 1: Append constants to `src/engine/constants.ts`**

```ts
// v2.1 — treadmill / caps / economy
export const WEEKS_PER_REQ_BUMP = 7; // required-level floor +1 every N weeks after grace
export const FEATURE_ACCESSIBLE_CHANCE = 0.2; // ~20% of features always ≤ studioLevel
export const STUDIO_GAME_REQ: readonly number[] = [3, 5, 7, 10, 13, 16, 20, 24, 28]; // games needed to reach next level (index = level-1)
export const ROLE_CAP_BASE: Record<Role, number> = { Developer: 2, QA: 1, 'Release Manager': 1 }; // roleCap = base + level
export const SEVERANCE_WEEKS = 2;
export const FEATURING_ACCEPT_COST = 1_500;
export const SELL_PRICE_WEEKS = 18;
export const SELL_PRICE_FLOOR = 500;
export const FEATURE_CAP_PER_GAME = 5; // feature inbox cap = games × this
export const TECHDEBT_REFILL_CHANCE = 0.6; // weekly chance to inject tech-debt when none active
```
`ROLE_CAP_BASE` uses `Role` — it's already imported at the top of `constants.ts` (`import type { FeatureTag, Genre, Role } from './types';`). Verify; add `Role` to that import if missing.

- [ ] **Step 2: Extend `src/engine/types.ts`**

In `interface GameState`, after `reportHistory: WeeklyReport[];` add:
```ts
  celebration?: { title: string; body: string } | null; // transient: featuring win popup
```
In `PlanAction`, add three members:
```ts
  | { type: 'fireMember'; memberId: string }
  | { type: 'sellGame'; gameId: string }
  | { type: 'dismissCelebration' }
```

- [ ] **Step 3: Init `celebration` in `src/engine/newGame.ts`**

In the `const s: GameState = { … }` literal, after `reportHistory: [],` add `celebration: null,`.

- [ ] **Step 4: Write the failing studio tests** (append to `src/engine/__tests__/studio.test.ts`)

```ts
import { studioGameRequirement, roleCapacity } from '../studio';
import { WEEKS_PER_REQ_BUMP, GATE_GRACE_WEEKS } from '../constants';

describe('rising floor (v2.1)', () => {
  it('floor climbs +1 every WEEKS_PER_REQ_BUMP after grace', () => {
    const s = makeState();
    s.studioLevel = 1;
    const minAt = (week: number) => {
      s.weekIndex = week;
      let min = 99;
      for (let i = 0; i < 300; i++) min = Math.min(min, rollRequiredLevel(s, new Rng(i))); // no accessible chance
      return min;
    };
    expect(minAt(GATE_GRACE_WEEKS)).toBe(1);
    expect(minAt(GATE_GRACE_WEEKS + WEEKS_PER_REQ_BUMP)).toBe(2);
    expect(minAt(GATE_GRACE_WEEKS + WEEKS_PER_REQ_BUMP * 3)).toBe(4);
  });

  it('feature accessible-chance yields ≤ studioLevel sometimes; tech-debt never gets the guarantee', () => {
    const s = makeState();
    s.studioLevel = 2;
    s.weekIndex = 40; // floor well above 2 without the guarantee
    let featAccessible = 0, techAccessible = 0;
    for (let i = 0; i < 400; i++) {
      if (rollRequiredLevel(s, new Rng(i), 0.2) <= s.studioLevel) featAccessible++;
      if (rollRequiredLevel(s, new Rng(i)) <= s.studioLevel) techAccessible++;
    }
    expect(featAccessible).toBeGreaterThan(40); // ~20% land accessible
    expect(techAccessible).toBe(0); // pure rising floor is above level 2 by week 40
  });
});

describe('studioGameRequirement / roleCapacity', () => {
  it('game requirement by level', () => {
    expect(studioGameRequirement(1)).toBe(3);
    expect(studioGameRequirement(2)).toBe(5);
  });
  it('role capacity = base + level', () => {
    expect(roleCapacity('Developer', 1)).toBe(3);
    expect(roleCapacity('QA', 1)).toBe(2);
    expect(roleCapacity('Release Manager', 3)).toBe(4);
  });
});
```

- [ ] **Step 5: Run → fail**

Run: `npm test src/engine/__tests__/studio.test.ts`
Expected: FAIL — `studioGameRequirement`/`roleCapacity` not exported; rising-floor not implemented.

- [ ] **Step 6: Rewrite `src/engine/studio.ts`**

```ts
// src/engine/studio.ts
import { Rng } from './rng';
import {
  GATE_GRACE_WEEKS, LEVEL_WINDOW_ABOVE, LEVEL_WINDOW_SPAN, ROLE_CAP_BASE,
  STUDIO_GAME_REQ, STUDIO_LEVEL_CAP, STUDIO_MAX_GAMES_PER_LEVEL, STUDIO_UPGRADE_COSTS,
  WEEKS_PER_REQ_BUMP,
} from './constants';
import type { GameState, Role } from './types';

export function maxGamesFor(level: number): number {
  return level * STUDIO_MAX_GAMES_PER_LEVEL;
}

/** Cost to go from `level` to `level+1`; null if at the cap. */
export function nextUpgradeCost(level: number): number | null {
  if (level >= STUDIO_LEVEL_CAP) return null;
  return STUDIO_UPGRADE_COSTS[level - 1];
}

/** Games you must own to upgrade from `level`; Infinity at the cap. */
export function studioGameRequirement(level: number): number {
  if (level >= STUDIO_LEVEL_CAP) return Infinity;
  return STUDIO_GAME_REQ[level - 1];
}

/** Per-role hire cap at a studio level. */
export function roleCapacity(role: Role, level: number): number {
  return ROLE_CAP_BASE[role] + level;
}

/** Required studio level for a generated feature / tech-debt item.
 *  - Grace forces Lv 1.
 *  - `accessibleChance` (features only): chance to land at ≤ studioLevel so the
 *    game never permanently locks. Tech-debt passes 0 (pure rising floor).
 *  - Otherwise a rising floor (+1 every WEEKS_PER_REQ_BUMP after grace) with a
 *    ~5-level spread, reaching up to studioLevel+2 if the player is ahead. */
export function rollRequiredLevel(s: GameState, rng: Rng, accessibleChance = 0): number {
  if (s.weekIndex < GATE_GRACE_WEEKS) return 1;
  if (accessibleChance > 0 && rng.chance(accessibleChance)) return rng.int(1, s.studioLevel);
  const timeFloor = 1 + Math.floor((s.weekIndex - GATE_GRACE_WEEKS) / WEEKS_PER_REQ_BUMP);
  const floor = Math.min(STUDIO_LEVEL_CAP, timeFloor);
  const ceiling = Math.min(STUDIO_LEVEL_CAP, Math.max(s.studioLevel + LEVEL_WINDOW_ABOVE, floor + LEVEL_WINDOW_SPAN - 1));
  const span = ceiling - floor;
  const offset = Math.min(rng.int(0, span), rng.int(0, span)); // triangular → floor
  return floor + offset;
}
```

- [ ] **Step 7: Run → pass**

Run: `npm test` → PASS (studio suite green; existing suites unaffected — inbox still calls `rollRequiredLevel(s, rng)` with the default `accessibleChance=0`). `npm run build` → clean (PlanAction variants without handlers are fine; the registry is `Partial`).

- [ ] **Step 8: Commit**

```bash
git add src/engine/constants.ts src/engine/types.ts src/engine/studio.ts src/engine/newGame.ts src/engine/__tests__/studio.test.ts
git commit -m "feat(engine): v2.1 treadmill constants, types, studio rewrite (rising floor, game req, role cap)"
```

---

### Task 2: Actions — upgrade precondition, hire cap, fire, sell, dismiss

**Files:**
- Modify: `src/engine/actions.ts`
- Test: `src/engine/__tests__/v21-actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/v21-actions.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { SEVERANCE_WEEKS, SELL_PRICE_WEEKS, SELL_PRICE_FLOOR } from '../constants';
import { roleCapacity, studioGameRequirement } from '../studio';

describe('upgrade game precondition', () => {
  it('blocks upgrade until the games requirement is met', () => {
    const s = newGame(1);
    s.cash = 10_000_000; // afford the cash easily
    expect(s.games.length).toBe(2); // L1 needs 3
    expect(() => applyAction(s, { type: 'upgradeStudio' })).toThrow(/games/i);
    s.games.push({ ...s.games[0], id: 'g-x', name: 'Extra' });
    expect(s.games.length).toBe(3);
    const s2 = applyAction(s, { type: 'upgradeStudio' });
    expect(s2.studioLevel).toBe(2);
  });
});

describe('hire role capacity', () => {
  it('blocks hiring past the per-role cap', () => {
    const s = newGame(1);
    s.cash = 10_000_000;
    // L1 Developer cap = 3; start has 2 devs. Hire devs until blocked.
    let st = s;
    const hireDev = () => {
      const c = st.market.candidates.find((x) => x.role === 'Developer');
      if (!c) { // force one onto the market
        st.market.candidates.push({ id: `d${st.nextId++}`, name: 'Dev X', role: 'Developer', skill: 3, salary: 1500, signingFee: 3000 });
      }
      const dev = st.market.candidates.find((x) => x.role === 'Developer')!;
      st = applyAction(st, { type: 'hire', candidateId: dev.id });
    };
    hireDev(); // 3rd dev → ok (cap 3)
    expect(st.team.filter((m) => m.role === 'Developer').length).toBe(3);
    // 4th dev → throws
    st.market.candidates.push({ id: 'dz', name: 'Dev Z', role: 'Developer', skill: 3, salary: 1500, signingFee: 3000 });
    expect(() => applyAction(st, { type: 'hire', candidateId: 'dz' })).toThrow(/capacity/i);
  });
});

describe('fireMember', () => {
  it('pays severance, removes the member, frees their ticket', () => {
    const s = newGame(1);
    const dev = s.team.find((m) => m.role === 'Developer')!;
    // put the dev on a ticket
    const st0 = applyAction(s, { type: 'assign', ticketKey: s.tickets[0].key, memberId: dev.id });
    const cash = st0.cash;
    const st = applyAction(st0, { type: 'fireMember', memberId: dev.id });
    expect(st.team.some((m) => m.id === dev.id)).toBe(false);
    expect(st.cash).toBe(cash - dev.salary * SEVERANCE_WEEKS);
    const t = st.tickets.find((x) => x.key === s.tickets[0].key)!;
    expect(t.assigneeId).toBeNull();
    expect(t.status).toBe('TODO');
  });
});

describe('sellGame', () => {
  it('sells a game for ~SELL_PRICE_WEEKS× weekly revenue and removes it + its tickets', () => {
    const s = newGame(1);
    const g = s.games[0];
    const weekly = Math.round(g.players * g.revenuePerPlayer);
    const expected = Math.max(SELL_PRICE_FLOOR, Math.round(weekly * SELL_PRICE_WEEKS));
    const cash = s.cash;
    const st = applyAction(s, { type: 'sellGame', gameId: g.id });
    expect(st.games.some((x) => x.id === g.id)).toBe(false);
    expect(st.tickets.some((t) => t.gameId === g.id)).toBe(false);
    expect(st.cash).toBe(cash + expected);
  });

  it('refuses to sell a game with an in-flight release', () => {
    const s = newGame(1);
    const g = s.games[0];
    s.releases.push({
      id: 'r1', gameId: g.id, version: '9.9.0', cwLabel: 'CW 24/2026', ticketKeys: [],
      releaseTicketKey: 'GIM-9', quality: 70, missedBugs: 0, impact: { revenuePct: 0, ratingBonus: 0 },
      status: 'soft', shippedWeek: 0, reportCard: null, decision: null,
    });
    expect(() => applyAction(s, { type: 'sellGame', gameId: g.id })).toThrow(/in-flight|release/i);
  });
});

describe('dismissCelebration', () => {
  it('clears the celebration', () => {
    const s = newGame(1);
    s.celebration = { title: 'x', body: 'y' };
    const st = applyAction(s, { type: 'dismissCelebration' });
    expect(st.celebration).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test src/engine/__tests__/v21-actions.test.ts`
Expected: FAIL — new handlers/precondition missing.

- [ ] **Step 3: Edit `src/engine/actions.ts`**

Update the studio import:
```ts
import { maxGamesFor, nextUpgradeCost, roleCapacity, studioGameRequirement } from './studio';
```
Add the constants import (merge with existing `./constants` import):
```ts
import { GENRE_FIT, NEW_GAME_COST, QA_EFFORT_FRACTION, SELL_PRICE_FLOOR, SELL_PRICE_WEEKS, SEVERANCE_WEEKS } from './constants';
```

In `handlers.upgradeStudio`, after the `cost === null` cap check and before the cash check, insert the games precondition:
```ts
  const req = studioGameRequirement(s.studioLevel);
  if (s.games.length < req) throw new Error(`Need ${req} games to upgrade — you have ${s.games.length}`);
```

In `handlers.hire`, after `if (!c) throw …;` and before the cash check, insert:
```ts
  const roleCount = s.team.filter((m) => m.role === c.role).length;
  if (roleCount >= roleCapacity(c.role, s.studioLevel)) {
    throw new Error(`At ${c.role} capacity — upgrade the studio to hire more`);
  }
```

Append three handlers (reuse the existing `returnToQueue` helper for fire):
```ts
handlers.fireMember = ({ s }, a: { memberId: string }) => {
  const m = s.team.find((x) => x.id === a.memberId);
  if (!m) throw new Error('No such team member');
  if (m.ticketKey) {
    const t = s.tickets.find((x) => x.key === m.ticketKey);
    if (t) { t.assigneeId = null; returnToQueue(t); }
    m.ticketKey = null;
  }
  const severance = m.salary * SEVERANCE_WEEKS;
  s.cash -= severance;
  s.pendingDeltas.push({ label: `Severance: ${m.name}`, amount: -severance });
  s.team = s.team.filter((x) => x.id !== m.id);
  s.pendingEvents.push(`👋 Let ${m.name} go (${m.role}) — severance $${severance.toLocaleString('en-US')}`);
};

handlers.sellGame = ({ s }, a: { gameId: string }) => {
  const g = s.games.find((x) => x.id === a.gameId);
  if (!g) throw new Error('No such game');
  if (s.releases.some((r) => r.gameId === g.id && r.status !== 'decided')) {
    throw new Error('Finish the in-flight release before selling this game');
  }
  const weekly = Math.round(g.players * g.revenuePerPlayer);
  const price = Math.max(SELL_PRICE_FLOOR, Math.round(weekly * SELL_PRICE_WEEKS));
  s.cash += price;
  s.pendingDeltas.push({ label: `Sold ${g.name}`, amount: price });
  s.games = s.games.filter((x) => x.id !== g.id);
  s.tickets = s.tickets.filter((t) => t.gameId !== g.id);
  for (const m of s.team) {
    if (m.ticketKey && !s.tickets.some((t) => t.key === m.ticketKey)) m.ticketKey = null;
  }
  s.pendingEvents.push(`💰 Sold ${g.name} for $${price.toLocaleString('en-US')}`);
  s.log.push(`Sold ${g.name} for $${price.toLocaleString('en-US')}`);
};

handlers.dismissCelebration = ({ s }) => {
  s.celebration = null;
};
```

- [ ] **Step 4: Run → pass**

Run: `npm test` → PASS. `npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/actions.ts src/engine/__tests__/v21-actions.test.ts
git commit -m "feat(engine): upgrade game precondition, hire role caps, fireMember, sellGame, dismissCelebration"
```

---

### Task 3: Inbox — feature accessibility + cap, tech-debt deadlines/no-decline/cadence, featuring fee

**Files:**
- Modify: `src/engine/inbox.ts`
- Test: `src/engine/__tests__/v21-inbox.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/v21-inbox.test.ts
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { generateInboxItem, generateWeeklyInbox, declineInboxItem } from '../inbox';
import { FEATURING_ACCEPT_COST, TECHDEBT_DEADLINE_WEEKS, FEATURE_CAP_PER_GAME } from '../constants';
import { makeState } from './helpers';

describe('tech-debt deadlines + no decline', () => {
  it('both subtypes carry a deadline and fine', () => {
    const s = makeState(); s.weekIndex = 20;
    const inv = generateInboxItem(s, new Rng(1), 'techdebt', undefined, 'investment');
    const man = generateInboxItem(s, new Rng(2), 'techdebt', undefined, 'mandatory');
    expect(inv.deadlineWeek).toBe(s.weekIndex + TECHDEBT_DEADLINE_WEEKS);
    expect(inv.fineUsd).toBeGreaterThan(0);
    expect(man.deadlineWeek).toBe(s.weekIndex + TECHDEBT_DEADLINE_WEEKS);
  });
  it('tech-debt cannot be declined', () => {
    const s = makeState(); s.weekIndex = 20;
    const item = generateInboxItem(s, new Rng(3), 'techdebt');
    item.requiredLevel = 1; s.inbox.push(item);
    expect(() => declineInboxItem(s, item.id)).toThrow(/can.?t be declined|tech debt/i);
  });
});

describe('featuring accept fee', () => {
  it('accepting an opportunity costs FEATURING_ACCEPT_COST', () => {
    const s = newGame(1);
    const opp = generateInboxItem(s, new Rng(4), 'opportunity');
    s.inbox.push(opp);
    const cash = s.cash;
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: opp.id });
    expect(s2.cash).toBe(cash - FEATURING_ACCEPT_COST);
    expect(s2.inbox.find((i) => i.id === opp.id)!.status).toBe('accepted');
  });
});

describe('feature cap scales with games', () => {
  it('stops generating features past games × FEATURE_CAP_PER_GAME', () => {
    const s = newGame(5);
    // saturate pending features to the cap
    const cap = s.games.length * FEATURE_CAP_PER_GAME;
    for (let i = 0; i < cap; i++) s.inbox.push(generateInboxItem(s, new Rng(100 + i), 'feature'));
    const before = s.inbox.filter((i) => i.kind === 'feature' && i.status === 'pending').length;
    for (let w = 0; w < 8; w++) generateWeeklyInbox(s, new Rng(200 + w));
    const after = s.inbox.filter((i) => i.kind === 'feature' && i.status === 'pending').length;
    expect(after).toBe(before); // never exceeds the cap (excess rolls become bugs)
  });
});

describe('tech-debt refill', () => {
  it('eventually generates tech-debt even across many weeks (never dries up)', () => {
    let s = newGame(9);
    let sawTechdebt = false;
    for (let w = 0; w < 15 && !sawTechdebt; w++) {
      generateWeeklyInbox(s, new Rng(300 + w));
      if (s.inbox.some((i) => i.kind === 'techdebt' && i.status === 'pending')) sawTechdebt = true;
    }
    expect(sawTechdebt).toBe(true);
  });
});
```

- [ ] **Step 2: Run → fail**

Run: `npm test src/engine/__tests__/v21-inbox.test.ts`
Expected: FAIL — investment lacks deadline; decline doesn't throw; no accept fee; no scaling cap.

- [ ] **Step 3: Edit `src/engine/inbox.ts`**

Update the constants import (merge):
```ts
import {
  DECLINED_BUG_RATING_HIT, FEATURE_ACCESSIBLE_CHANCE, FEATURE_CAP_PER_GAME,
  FEATURING_ACCEPT_COST, FEATURING_DEADLINE_WEEKS, FEATURING_REWARD_PCT, GENRE_FIT,
  INBOX_PER_WEEK, TECHDEBT_DEADLINE_WEEKS, TECHDEBT_EFFORT, TECHDEBT_FINE,
  TECHDEBT_REFILL_CHANCE, TECH_INVEST_REVENUE_PCT,
} from './constants';
```

**Feature requiredLevel** — in the `feature` branch of `generateInboxItem`, change the `requiredLevel` call to pass the accessible chance:
```ts
      requiredLevel: rollRequiredLevel(s, rng, FEATURE_ACCESSIBLE_CHANCE),
```

**Investment gets a deadline + fine** — in the techdebt investment return object, add `deadlineWeek` and `fineUsd`. Compute the deadline once for both subtypes; restructure the tail so both branches set `deadlineWeek = s.weekIndex + TECHDEBT_DEADLINE_WEEKS` and `fineUsd: TECHDEBT_FINE`. The investment return becomes:
```ts
  const deadlineWeek = s.weekIndex + TECHDEBT_DEADLINE_WEEKS;
  if (subtype === 'mandatory') {
    return {
      ...base, gameId: '', kind: 'techdebt', techSubtype: 'mandatory', requiredLevel,
      title: rng.pick(TECHDEBT_MANDATORY_TITLES),
      body: `Compliance work for the whole studio. Ship by ${cwLabel(deadlineWeek)} or pay a $${TECHDEBT_FINE.toLocaleString('en-US')} fine. A junior dev may botch it even on time.`,
      deadlineWeek, fineUsd: TECHDEBT_FINE, effort,
    };
  }
  const benefitRevenuePct = Math.round(rng.range(TECH_INVEST_REVENUE_PCT[0], TECH_INVEST_REVENUE_PCT[1]) * 10) / 10;
  return {
    ...base, gameId: '', kind: 'techdebt', techSubtype: 'investment', requiredLevel,
    title: rng.pick(TECHDEBT_INVESTMENT_TITLES),
    body: `Engineering upgrade. Ship by ${cwLabel(deadlineWeek)} → permanent +${benefitRevenuePct}% revenue on every game; miss it → $${TECHDEBT_FINE.toLocaleString('en-US')} fine. A junior dev may botch it.`,
    benefitRevenuePct, deadlineWeek, fineUsd: TECHDEBT_FINE, effort,
  };
```
(Keep `const subtype`, `const requiredLevel`, `const effort` as they are above this block; just move/duplicate the `deadlineWeek` const above the `if`.)

**Featuring accept fee** — in `acceptInboxItem`, the `opportunity` is "just tracked"; add the fee. After the gate check and before/within handling, for opportunities:
```ts
  if (item.kind === 'opportunity') {
    s.cash -= FEATURING_ACCEPT_COST;
    s.pendingDeltas.push({ label: `Featuring fee: ${item.title}`, amount: -FEATURING_ACCEPT_COST });
  }
```
Place this right before `item.status = 'accepted';` (the existing feature/bug/sdk→techdebt `if/else` chain doesn't cover opportunity, so add this as a separate `if`).

**No decline for tech-debt** — at the top of `declineInboxItem`, after the pending check, add:
```ts
  if (item.kind === 'techdebt') throw new Error("Tech debt can't be declined — it must be handled");
```

**Feature cap + tech-debt refill** — replace `generateWeeklyInbox` with:
```ts
export function generateWeeklyInbox(s: GameState, rng: Rng): void {
  const featureCap = s.games.length * FEATURE_CAP_PER_GAME;
  const count = rng.int(INBOX_PER_WEEK[0], INBOX_PER_WEEK[1]);
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    let kind: InboxItemKind =
      roll < 0.42 ? 'feature' : roll < 0.70 ? 'bug' : roll < 0.82 ? 'opportunity' : 'techdebt';
    // Feature inbox is capped at games × FEATURE_CAP_PER_GAME; overflow becomes a bug.
    if (kind === 'feature' && s.inbox.filter((it) => it.kind === 'feature' && it.status === 'pending').length >= featureCap) {
      kind = 'bug';
    }
    const mandatoryActive =
      s.inbox.some((it) => it.kind === 'techdebt' && it.techSubtype === 'mandatory' &&
        (it.status === 'pending' || it.status === 'accepted')) ||
      s.tickets.some((t) => t.type === 'Tech Debt' && t.techSubtype === 'mandatory' &&
        t.deadlineWeek !== null && t.status !== 'DONE');
    if (kind === 'techdebt' && mandatoryActive) {
      s.inbox.push(generateInboxItem(s, rng, 'techdebt', undefined, 'investment'));
    } else {
      s.inbox.push(generateInboxItem(s, rng, kind));
    }
  }
  // Cadence guarantee: if no tech-debt is pending or in-flight, likely inject one.
  const techActive =
    s.inbox.some((it) => it.kind === 'techdebt' && it.status === 'pending') ||
    s.tickets.some((t) => t.type === 'Tech Debt' && t.status !== 'DONE');
  if (!techActive && rng.chance(TECHDEBT_REFILL_CHANCE)) {
    s.inbox.push(generateInboxItem(s, rng, 'techdebt'));
  }
}
```

- [ ] **Step 4: Run → pass**

Run: `npm test` → PASS (new suite + existing inbox suite; note the existing inbox.test mandatory-deadline cases still hold since mandatory still has a deadline). `npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/inbox.ts src/engine/__tests__/v21-inbox.test.ts
git commit -m "feat(engine): feature accessibility+scaling cap, tech-debt deadlines/no-decline/refill, featuring fee"
```

---

### Task 4: Deadlines fine both subtypes; featuring celebration; exports

**Files:**
- Modify: `src/engine/inbox.ts` (`checkDeadlines`), `src/engine/releases.ts` (`applyFullRollout`), `src/engine/index.ts`
- Test: `src/engine/__tests__/v21-celebration.test.ts`, extend `src/engine/__tests__/inbox.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/v21-celebration.test.ts
import { Rng } from '../rng';
import { applyAction } from '../actions';
import { generateInboxItem } from '../inbox';
import { makeState, addTicket } from './helpers';
import type { Release } from '../types';

describe('featuring celebration', () => {
  it('sets state.celebration when a full rollout pays out a featuring', () => {
    const s = makeState();
    const g = s.games[0];
    // accept a featuring opportunity for g
    const opp = generateInboxItem(s, new Rng(1), 'opportunity', g.id);
    opp.deadlineWeek = s.weekIndex + 3;
    s.inbox.push(opp);
    let st = applyAction(s, { type: 'acceptInbox', itemId: opp.id });
    // craft a decidable soft release for g
    const r: Release = {
      id: 'rel-feat', gameId: g.id, version: '9.9.0', cwLabel: 'CW 24/2026', ticketKeys: [],
      releaseTicketKey: 'GIM-9', quality: 80, missedBugs: 0, impact: { revenuePct: 5, ratingBonus: 0.1 },
      status: 'soft', shippedWeek: 0,
      reportCard: { happiness: 'liked', bugReports: 0, revenueImpactPct: 10, ratingDelta: 0.3 }, decision: null,
    };
    st.releases.push(r);
    const s2 = applyAction(st, { type: 'fullRollout', releaseId: r.id });
    expect(s2.celebration).not.toBeNull();
    expect(s2.celebration!.title).toContain(g.name);
  });
});
```

Append to `src/engine/__tests__/inbox.test.ts` (investment now fined too):
```ts
import { generateInboxItem as genItem } from '../inbox';
it('fines a missed investment tech-debt at its deadline', () => {
  const s = makeState();
  const item = genItem(s, new Rng(11), 'techdebt', undefined, 'investment');
  s.inbox.push(item);
  s.weekIndex = item.deadlineWeek! + 1;
  const cash = s.cash;
  checkDeadlines(s);
  expect(s.cash).toBeLessThan(cash); // fined even though it's "investment"
});
```
(If `checkDeadlines`, `makeState`, `Rng` aren't already imported in inbox.test.ts, add them.)

- [ ] **Step 2: Run → fail**

Run: `npm test src/engine/__tests__/v21-celebration.test.ts`
Expected: FAIL — celebration not set; investment not fined.

- [ ] **Step 3: Fine both subtypes in `src/engine/inbox.ts` `checkDeadlines`**

Remove the `it.techSubtype === 'mandatory'` filter so ANY tech-debt is fined when overdue and unfinished. The inbox-item branch becomes:
```ts
    if (item.kind === 'techdebt' &&
        (item.status === 'pending' || item.status === 'declined')) {
      s.cash -= item.fineUsd!;
      s.pendingDeltas.push({ label: `Missed deadline: ${item.title}`, amount: -item.fineUsd! });
      s.pendingEvents.push(`🚨 Missed ${item.title} deadline — fined $${item.fineUsd!.toLocaleString('en-US')}`);
      item.status = 'done';
    } else if (item.kind === 'opportunity' && (item.status === 'pending' || item.status === 'accepted')) {
```
And the ticket branch condition becomes (drop the mandatory filter):
```ts
    if (
      t.type === 'Tech Debt' && t.deadlineWeek !== null &&
      t.deadlineWeek < s.weekIndex && t.status !== 'DONE'
    ) {
      s.cash -= TECHDEBT_FINE;
      s.pendingDeltas.push({ label: `Missed deadline: ${t.title}`, amount: -TECHDEBT_FINE });
      s.pendingEvents.push(`🚨 ${t.title} missed its deadline — fined $${TECHDEBT_FINE.toLocaleString('en-US')}`);
      t.deadlineWeek = null;
    }
```

- [ ] **Step 4: Set celebration in `src/engine/releases.ts` `applyFullRollout`**

Inside the featuring payout loop, after `s.log.push(\`${r.cwLabel}: ${g.name} featured…\`);`, add:
```ts
      s.celebration = {
        title: `${g.name} got featured! 🎉`,
        body: `The platform spotlight gave ${g.name} a +${Math.round((item.rewardPlayersPct ?? 0) * 100)}% player spike.`,
      };
```

- [ ] **Step 5: Export helpers — `src/engine/index.ts`**

Change the studio export line to add the two helpers, and add the constants the UI needs:
```ts
export { maxGamesFor, nextUpgradeCost, roleCapacity, studioGameRequirement } from './studio';
```
and extend the constants export:
```ts
export { DECAY_GRACE_WEEKS, GENRES, NEW_GAME_COST, STUDIO_LEVEL_CAP, FEATURE_CAP_PER_GAME } from './constants';
```

- [ ] **Step 6: Run → pass**

Run: `npm test` → PASS. `npm run build` → clean. This finishes the engine.

- [ ] **Step 7: Commit**

```bash
git add src/engine/inbox.ts src/engine/releases.ts src/engine/index.ts src/engine/__tests__/v21-celebration.test.ts src/engine/__tests__/inbox.test.ts
git commit -m "feat(engine): fine both tech-debt subtypes on miss, featuring celebration, v2.1 exports"
```

---

### Task 5: UI — top-bar team-capacity strip

**Files:** Modify `src/ui/components/TopBar.tsx`, `src/ui/theme.css`

- [ ] **Step 1: Replace `src/ui/components/TopBar.tsx`**

```tsx
// src/ui/components/TopBar.tsx
import { useGame } from '../store';
import { cwLabel, roleCapacity } from '../../engine';
import { fmtMoney } from '../format';

export function TopBar({ onEndWeek }: { onEndWeek: () => void }) {
  const s = useGame();
  const count = (role: Parameters<typeof roleCapacity>[0]) => s.team.filter((m) => m.role === role).length;
  const idle = (role: Parameters<typeof roleCapacity>[0]) =>
    s.team.filter((m) => m.role === role && !m.ticketKey).length;
  return (
    <header className="topbar">
      <div className="logo">
        🚀 Full Rollout <span>ship or sink</span>
      </div>
      <div className="team-strip">
        <span className="tm-chip" title="Developers hired / capacity · idle">
          👨‍💻 {count('Developer')}/{roleCapacity('Developer', s.studioLevel)}
          {idle('Developer') ? ` ·${idle('Developer')} free` : ''}
        </span>
        <span className="tm-chip" title="QA hired / capacity · idle">
          🧪 {count('QA')}/{roleCapacity('QA', s.studioLevel)}
          {idle('QA') ? ` ·${idle('QA')} free` : ''}
        </span>
        <span className="tm-chip" title="Release managers hired / capacity">
          🚀 {count('Release Manager')}/{roleCapacity('Release Manager', s.studioLevel)}
        </span>
      </div>
      <div className="spacer" />
      <div className="stat-chip">🏢 Lv {s.studioLevel}</div>
      <div className={`stat-chip ${s.cash < 5000 ? 'low' : ''}`}>{fmtMoney(s.cash)}</div>
      <div className="stat-chip">{cwLabel(s.weekIndex)}</div>
      <button className="btn primary" onClick={onEndWeek} disabled={s.status !== 'playing'}>
        End Week ▸
      </button>
    </header>
  );
}
```

- [ ] **Step 2: Append CSS to `src/ui/theme.css`**

```css
/* v2.1: top-bar team strip */
.team-strip { display: flex; gap: 6px; margin-left: 16px; }
.tm-chip {
  background: rgba(255, 255, 255, 0.14); border-radius: var(--radius);
  padding: 4px 8px; font-size: 12px; font-weight: 600; white-space: nowrap;
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run build` (clean), `npm test` (still green). Commit:
```bash
git add src/ui/components/TopBar.tsx src/ui/theme.css
git commit -m "feat(ui): top-bar per-role team capacity + idle strip"
```

---

### Task 6: UI — game logos, dual inbox badge, New Game button

**Files:** Modify `src/ui/format.ts`, `src/ui/components/Sidebar.tsx`, `src/ui/theme.css`

- [ ] **Step 1: Add `gameLogo` to `src/ui/format.ts`** (append)

```ts
const GAME_LOGOS = [
  '🎮', '🕹️', '🧩', '🎲', '🃏', '🎯', '🎰', '🏰', '🐉', '🦄',
  '🍭', '🍩', '🚀', '⚽', '🏎️', '🪀', '🎨', '🐢', '🦊', '🌋',
] as const;

/** Deterministic unique-ish emoji logo for a game, derived from its id. */
export function gameLogo(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return GAME_LOGOS[h % GAME_LOGOS.length];
}
```

- [ ] **Step 2: Replace `src/ui/components/Sidebar.tsx`**

```tsx
// src/ui/components/Sidebar.tsx
import { useDispatch, useGame } from '../store';
import { fmtPlayers, gameLogo } from '../format';
import { DECAY_GRACE_WEEKS } from '../../engine';
import type { Screen } from '../App';

interface Props {
  screen: Screen;
  setScreen: (s: Screen) => void;
  gameFilter: string | null;
  setGameFilter: (id: string | null) => void;
}

export function Sidebar({ screen, setScreen, gameFilter, setGameFilter }: Props) {
  const s = useGame();
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending').length;
  const techPending = s.inbox.filter((i) => i.status === 'pending' && i.kind === 'techdebt').length;
  const nav = (id: Screen, label: string, badge?: number) => (
    <button className={`nav-item ${screen === id ? 'active' : ''}`} onClick={() => setScreen(id)}>
      {label}
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="nav-head">Studio</div>
      {nav('board', '📋 Board')}
      {nav('releases', '📦 Releases')}
      <button className={`nav-item ${screen === 'inbox' ? 'active' : ''}`} onClick={() => setScreen('inbox')}>
        📨 Inbox
        <span className="right" style={{ display: 'flex', gap: 4 }}>
          {techPending ? <span className="badge tech" title="Tech debt waiting">{techPending}</span> : null}
          {pending ? <span className="badge">{pending}</span> : null}
        </span>
      </button>
      {nav('team', '👥 Team')}
      {nav('market', '🛒 Market')}
      {nav('reports', '📜 Reports')}
      <div className="nav-head">Games</div>
      <button
        className={`nav-item ${gameFilter === null ? 'active' : ''}`}
        onClick={() => { setGameFilter(null); setScreen('board'); }}
      >
        All games
      </button>
      {s.games.map((g) => {
        const stale = s.weekIndex - g.lastRolloutWeek > DECAY_GRACE_WEEKS && g.players > 0;
        return (
          <button
            key={g.id}
            className={`nav-item ${gameFilter === g.id ? 'active' : ''}`}
            onClick={() => { setGameFilter(g.id); setScreen('board'); }}
          >
            <span className="game-logo">{gameLogo(g.id)}</span>
            {g.name} {stale ? '🔻' : ''}
            <span className="muted">{g.players > 0 ? fmtPlayers(g.players) : 'dev'}</span>
          </button>
        );
      })}
      <div style={{ flex: 1 }} />
      <button
        className="btn subtle"
        style={{ margin: '12px 8px 4px', width: 'calc(100% - 16px)' }}
        onClick={() => { if (window.confirm('Start a new studio? Current progress is lost.')) d.restart(); }}
      >
        ↻ New game
      </button>
    </aside>
  );
}
```

- [ ] **Step 3: Append CSS to `src/ui/theme.css`**

```css
/* v2.1: dual inbox badge + game logo */
.badge.tech { background: var(--yellow); color: #5b4300; }
.game-logo { font-size: 14px; flex-shrink: 0; }
```
(The sidebar already lays items vertically; the `flex:1` spacer pushes New game to the bottom — if `.sidebar` isn't already `display:flex; flex-direction:column`, add those two properties to the existing `.sidebar` rule.)

- [ ] **Step 4: Verify + commit**

Run: `npm run build` (clean), `npm test` (green). Commit:
```bash
git add src/ui/format.ts src/ui/components/Sidebar.tsx src/ui/theme.css
git commit -m "feat(ui): game logos, tech-debt inbox badge, new-game button"
```

---

### Task 7: UI — Market upgrade requirement + sell-your-games panel

**Files:** Modify `src/ui/screens/MarketScreen.tsx`

- [ ] **Step 1: Edit the Studio panel + add a "Your games" panel**

In `src/ui/screens/MarketScreen.tsx`:
- Extend the engine import to include `studioGameRequirement`:
  ```ts
  import { GENRES, NEW_GAME_COST, STUDIO_LEVEL_CAP, maxGamesFor, nextUpgradeCost, studioGameRequirement } from '../../engine';
  ```
- In the Studio panel, compute the games requirement and reflect it in the button. Replace the `upgradeCost === null ? … : …` block's non-cap branch with one that also checks games:
  ```tsx
  {(() => {
    const gamesReq = studioGameRequirement(s.studioLevel);
    const needGames = s.games.length < gamesReq;
    const canAfford = s.cash >= upgradeCost!;
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
            Upgrade ({fmtMoney(upgradeCost!)})
          </button>
        </span>
      </>
    );
  })()}
  ```
  (Keep the `upgradeCost === null` "Maxed out" branch as-is.)

- Add a new "Your games" panel after the Studio panel and before "Games for sale". It lists owned games with a Sell button (price = max(SELL_PRICE_FLOOR, round(weekly × SELL_PRICE_WEEKS)) — but the UI doesn't need the constants; show the engine-agnostic estimate by importing the same constants OR just label the button "Sell"). To show the price, import the two constants:
  ```ts
  import { SELL_PRICE_FLOOR, SELL_PRICE_WEEKS } from '../../engine/constants';
  ```
  Panel:
  ```tsx
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
  </div>
  ```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` (clean), `npm test` (green). Commit:
```bash
git add src/ui/screens/MarketScreen.tsx
git commit -m "feat(ui): market shows upgrade game requirement + sell-your-games panel"
```

---

### Task 8: UI — fire buttons + hire capacity on the Team screen

**Files:** Modify `src/ui/screens/TeamScreen.tsx`

- [ ] **Step 1: Edit `src/ui/screens/TeamScreen.tsx`**

- Extend imports:
  ```ts
  import { memberStats, roleCapacity } from '../../engine';
  import { SEVERANCE_WEEKS } from '../../engine/constants';
  ```
- Add an **Action** column to the roster table header (`<th></th>`) and a Fire button cell per row:
  ```tsx
  <td className="num">
    <button
      className="btn red"
      onClick={() => { if (window.confirm(`Fire ${m.name}? Severance ${fmtMoney(m.salary * SEVERANCE_WEEKS)}.`)) d.act({ type: 'fireMember', memberId: m.id }); }}
    >
      Fire ({fmtMoney(m.salary * SEVERANCE_WEEKS)})
    </button>
  </td>
  ```
- In the Candidates panel, show role capacity so the player understands the hire gate. Under the `<h3>Candidates</h3>`, add a per-role capacity line:
  ```tsx
  <p className="sub">
    Capacity — 👨‍💻 {s.team.filter((m) => m.role === 'Developer').length}/{roleCapacity('Developer', s.studioLevel)} ·
    🧪 {s.team.filter((m) => m.role === 'QA').length}/{roleCapacity('QA', s.studioLevel)} ·
    🚀 {s.team.filter((m) => m.role === 'Release Manager').length}/{roleCapacity('Release Manager', s.studioLevel)}.
    Upgrade the studio to raise caps.
  </p>
  ```
- Disable a candidate's Hire button when its role is at capacity (in addition to the existing cash/status checks):
  ```tsx
  disabled={
    s.cash < c.signingFee || s.status !== 'playing' ||
    s.team.filter((m) => m.role === c.role).length >= roleCapacity(c.role, s.studioLevel)
  }
  ```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` (clean), `npm test` (green). Commit:
```bash
git add src/ui/screens/TeamScreen.tsx
git commit -m "feat(ui): fire button with severance + per-role hire capacity on team screen"
```

---

### Task 9: UI — inbox: no-decline tech-debt, scaling feature cap, clear featuring stakes

**Files:** Replace `src/ui/screens/InboxScreen.tsx`

- [ ] **Step 1: Replace `src/ui/screens/InboxScreen.tsx`**

```tsx
// src/ui/screens/InboxScreen.tsx
import { useDispatch, useGame } from '../store';
import { cwLabel, FEATURE_CAP_PER_GAME } from '../../engine';
import { signedPct } from '../format';
import type { InboxItem } from '../../engine';

const KIND_EMOJI: Record<InboxItem['kind'], string> = {
  feature: '💡', bug: '🐞', opportunity: '🌟', techdebt: '🛠️',
};

export function InboxScreen() {
  const s = useGame();
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending');
  const tracked = s.inbox.filter((i) => i.kind === 'opportunity' && i.status === 'accepted');
  const resolved = s.inbox.filter((i) => i.status !== 'pending').slice(-6).reverse();
  const featureCap = s.games.length * FEATURE_CAP_PER_GAME;
  const featureCount = pending.filter((i) => i.kind === 'feature').length;

  const renderItem = (i: InboxItem) => {
    const locked = !!(i.requiredLevel && s.studioLevel < i.requiredLevel);
    const isTech = i.kind === 'techdebt';
    return (
      <div className="panel" key={i.id}>
        <div className="row">
          <h3 style={{ margin: 0 }}>{KIND_EMOJI[i.kind]} {i.title}</h3>
          {locked && <span className="chip locked">🔒 Studio Lv {i.requiredLevel}</span>}
        </div>
        <p className="sub">{i.body}</p>
        {i.kind === 'feature' && i.predictedImpact && (
          <p>Predicted: 💰 {signedPct(i.predictedImpact.revenuePct)} revenue</p>
        )}
        {isTech && i.techSubtype === 'investment' && (
          <p>🔧 Ships → +{i.benefitRevenuePct}% revenue on every game</p>
        )}
        {i.kind === 'opportunity' && (
          <p className="sub">
            🎯 Reward: +{Math.round((i.rewardPlayersPct ?? 0) * 100)}% players if you full-roll {gameName(i.gameId)} by {i.deadlineWeek != null ? cwLabel(i.deadlineWeek) : '—'} · 💵 costs $1,500 to accept · ❌ miss = lose the boost (no penalty)
          </p>
        )}
        {i.deadlineWeek != null && i.kind !== 'opportunity' && <p>⏰ Deadline: {cwLabel(i.deadlineWeek)}</p>}
        <div className="row">
          <button
            className="btn green"
            disabled={locked}
            title={locked ? `Requires Studio Level ${i.requiredLevel}` : ''}
            onClick={() => d.act({ type: 'acceptInbox', itemId: i.id })}
          >
            Accept
          </button>
          {isTech ? (
            <span className="sub">mandatory engineering — can't decline; fine if the deadline lapses</span>
          ) : (
            <button className="btn" onClick={() => d.act({ type: 'declineInbox', itemId: i.id })}>
              Decline
            </button>
          )}
        </div>
      </div>
    );
  };

  function gameName(id: string) {
    return s.games.find((g) => g.id === id)?.name ?? 'the game';
  }

  const sections: { kind: InboxItem['kind']; title: string }[] = [
    { kind: 'feature', title: `💡 Feature requests (${featureCount}/${featureCap})` },
    { kind: 'bug', title: '🐞 Bug reports' },
    { kind: 'techdebt', title: '🛠️ Tech debt' },
    { kind: 'opportunity', title: '🌟 Opportunities' },
  ];

  return (
    <div className="screen">
      <h2>Inbox</h2>
      {pending.length === 0 && <p className="sub">All clear. End the week to see what comes in.</p>}
      {sections.map(({ kind, title }) => {
        const items = pending.filter((i) => i.kind === kind);
        if (items.length === 0 && kind !== 'feature') return null;
        return (
          <div key={kind}>
            <div className="nav-head" style={{ paddingLeft: 0 }}>{title}</div>
            {kind === 'feature' && featureCount >= featureCap && (
              <p className="sub">Full — decline some to make room for new requests (or buy/start a game to raise the cap).</p>
            )}
            {items.map(renderItem)}
          </div>
        );
      })}
      {tracked.length > 0 && (
        <div className="panel">
          <h3>🌟 Tracked featuring</h3>
          {tracked.map((i) => (
            <p key={i.id} className="sub">
              {gameName(i.gameId)} — full-roll by {i.deadlineWeek != null ? cwLabel(i.deadlineWeek) : '—'} → +{Math.round((i.rewardPlayersPct ?? 0) * 100)}% players · miss = no penalty
            </p>
          ))}
        </div>
      )}
      {resolved.length > 0 && (
        <div className="panel">
          <h3>Recent</h3>
          {resolved.map((i) => (
            <p key={i.id} className="sub">{KIND_EMOJI[i.kind]} {i.title} — {i.status}</p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` (clean — note `FEATURE_CAP_PER_GAME` must be exported from the engine index, done in Task 4 Step 5), `npm test` (green). Commit:
```bash
git add src/ui/screens/InboxScreen.tsx
git commit -m "feat(ui): no-decline tech-debt, scaling feature cap header, clear featuring stakes"
```

---

### Task 10: UI — game logo on ticket cards

**Files:** Modify `src/ui/components/TicketCard.tsx`

- [ ] **Step 1: Edit `src/ui/components/TicketCard.tsx`**

- Add `gameLogo` to the format import: `import { initials, gameLogo } from '../format';`
- In the `.meta` row, right after the `type-icon` span and before the `key` span, render the game logo for game-scoped tickets (tech-debt has `gameId===''` → show a 🏢):
  ```tsx
  <span className="game-logo" title="game">{t.gameId ? gameLogo(t.gameId) : '🏢'}</span>
  ```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` (clean), `npm test` (green). Commit:
```bash
git add src/ui/components/TicketCard.tsx
git commit -m "feat(ui): game logo on ticket cards"
```

---

### Task 11: UI — featuring celebration popup

**Files:** Create `src/ui/components/CelebrationModal.tsx`; modify `src/ui/App.tsx`

- [ ] **Step 1: Create `src/ui/components/CelebrationModal.tsx`**

```tsx
// src/ui/components/CelebrationModal.tsx
export function CelebrationModal({
  title, body, onClose,
}: { title: string; body: string; onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" style={{ textAlign: 'center', width: 460 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: 52 }}>🎉</div>
        <h3 style={{ marginTop: 8 }}>{title}</h3>
        <p>{body}</p>
        <div className="foot" style={{ justifyContent: 'center' }}>
          <button className="btn green" onClick={onClose}>Nice!</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `src/ui/App.tsx`**

- Import it: `import { CelebrationModal } from './components/CelebrationModal';`
- Render it (it should sit above other modals; place it last inside the `.app` div, after the game-over line):
  ```tsx
  {s.celebration && (
    <CelebrationModal
      title={s.celebration.title}
      body={s.celebration.body}
      onClose={() => d.act({ type: 'dismissCelebration' })}
    />
  )}
  ```

- [ ] **Step 3: Verify + commit**

Run: `npm run build` (clean), `npm test` (green). Commit:
```bash
git add src/ui/components/CelebrationModal.tsx src/ui/App.tsx
git commit -m "feat(ui): featuring success celebration popup"
```

---

### Task 12: UI — readable good/bad weekly report

**Files:** Replace `src/ui/components/WeeklyReportModal.tsx`

- [ ] **Step 1: Replace `src/ui/components/WeeklyReportModal.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` (clean), `npm test` (green). Commit:
```bash
git add src/ui/components/WeeklyReportModal.tsx
git commit -m "feat(ui): split weekly report into good / needs-attention groups"
```

---

### Task 13: Final integration, preview verification, review, merge, deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Full suite + build** — `npm test` (all green) + `npm run build` (clean).

- [ ] **Step 2: Preview a full v2.1 loop** (preview tools, not Bash). Free port 5173 if a stale server holds it; start `full-rollout-dev`; `localStorage.clear()` once (the existing v2 save loads fine, but clear to test fresh). Verify:
  - Top-bar team strip shows per-role `hired/cap` + idle; 🏢 Lv chip.
  - Market: Studio panel shows "needs N games (have M)"; Upgrade disabled until games + cash met; upgrading is instant. "Your games" panel sells a game (cash up, game + tickets gone); sell blocked during an in-flight release.
  - Team: Fire button pays severance and removes the member; hire disabled at role cap with the capacity line shown.
  - Inbox: feature header shows `N/(games×5)`, fills and blocks new features until declined; tech-debt has no Decline and shows a deadline; opportunity shows reward + $1,500 cost + "no penalty"; accept deducts $1,500.
  - Accept a featuring, full-roll the game by the deadline → 🎉 celebration popup; dismiss clears it.
  - Sidebar: each game shows a unique emoji logo; ticket cards show the game logo; Inbox nav shows the amber tech-debt badge; "↻ New game" confirms then restarts.
  - Tech-debt keeps appearing across ~20 weeks (cadence); rising floor eventually locks new feature/tech-debt until you upgrade, but ~20% of features stay acceptable and bugs always come (no permanent lock).
  - Weekly report splits into 🟢 / 🔴 groups.
  - `preview_console_logs` level=error → none.
  Fix any issue in source, re-run from Step 1.

- [ ] **Step 3: Final whole-branch review** (dispatch a reviewer subagent over `git diff main...HEAD`): determinism (no Math.random/Date in engine), save still loads v2 (no schema bump; `celebration` optional), no permanent-lock invariant holds, hidden-info rule, sell/fire don't corrupt state (orphaned assignees, in-flight release guard), featuring fee/celebration correctness, feature-cap + tech-debt-cadence math. Fix Critical/Important findings.

- [ ] **Step 4: Merge to main**
```bash
git checkout main
git merge --no-ff feature/v2.1-features -m "Merge feature/v2.1-features: treadmill, fire, sell, featuring, logos, report grouping"
npm test   # green on main
git branch -d feature/v2.1-features
git push origin main
```

- [ ] **Step 5: Deploy to the same URL** (gh-pages via plain git — npx gh-pages has a cache-permission issue on this machine):
```bash
npm run build
cd dist && git init -q -b gh-pages && git add -A && git commit -q -m "deploy v2.1" \
  && git push -f -q https://github.com/BerkUnalDev/full-rollout.git gh-pages:gh-pages
cd .. && rm -rf dist/.git
for i in $(seq 1 8); do sleep 15; \
  live=$(curl -s "https://berkunaldev.github.io/full-rollout/?cb=$i" | grep -o 'assets/index-[^"]*\.js' | head -1); \
  local=$(ls dist/assets | grep '\.js$'); \
  [ "assets/$local" = "$live" ] && { echo "LIVE: $live"; break; } || echo "attempt $i: live=$live local=$local"; done
```
Deliverable: the same URL, now on v2.1.

---

## Plan self-review notes (applied)
- **Spec coverage:** §1 treadmill → T1 (rising floor + game req + role cap) + T2 (upgrade precondition, hire cap) + T7/T8 UI; §2 top strip → T5; §3 tech-debt deadlines/no-decline/cadence → T3 + T4 (fine both); §4 inbox badge → T6; §5 fire → T2 + T8; §6 featuring fee/celebration → T3 (fee) + T4 (celebration) + T9 (clarity) + T11 (popup); §7 sell → T2 + T7; §8 feature cap → T3 + T9; §9 logos → T6 + T10; §10 new-game button → T6; §11 report grouping → T12; §12 schema/exports → T1/T4.
- **Type consistency:** `roleCapacity`, `studioGameRequirement`, `rollRequiredLevel(s,rng,accessibleChance?)`, `celebration`, `fireMember`/`sellGame`/`dismissCelebration` actions, `gameLogo`, `FEATURE_CAP_PER_GAME` export — all defined in T1–T4 and used verbatim in UI tasks.
- **No schema bump:** `celebration` is optional; v2 saves load unchanged; deserialize sniff untouched.
- **No-placeholder check:** every code step carries actual code or an exact edit.
