# Full Rollout v2 Features — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Studio Level, Tech Debt, RM-per-star capacity, employee info, and a detailed weekly report + history to the live Full Rollout game (spec: `docs/superpowers/specs/2026-06-13-full-rollout-v2-features.md`).

**Architecture:** Extends the existing pure-function engine (`src/engine/`, seeded RNG, TDD via vitest) and thin React UI (`src/ui/`). Two small new engine modules (`studio.ts`, `team.ts`) keep new logic focused. Save schema bumps to v2 (v1 saves reset to a fresh game on load).

**Tech Stack:** Vite + React + TypeScript + vitest (no new deps).

---

## Conventions (apply to every task)

- Engine entry points (`newGame`/`applyAction`/`endWeek`) are pure: clone-first, mutate the clone, write `rngState` back. Internal phase helpers mutate the state passed in.
- All randomness flows through the `Rng` carried in state — never `Math.random`/`Date` in `src/engine/`.
- New balance numbers go in `src/engine/constants.ts`; new content strings in `src/engine/data.ts`.
- Tech-debt tickets are studio-wide: `gameId === ''`.
- Hidden info (exact fail chance, hidden bugs, qaEffort) is never rendered in the UI.
- Run `npm test` and `npm run build` before every commit; both must be green.

## File structure (what changes)

```
src/engine/
├── constants.ts   — MODIFY: SCHEMA_VERSION→2, studio/techdebt/report constants
├── data.ts        — MODIFY: tech-debt title banks
├── types.ts       — MODIFY: TicketType, InboxItemKind, TechSubtype, new fields, PlanAction
├── studio.ts      — CREATE: maxGamesFor, nextUpgradeCost, rollRequiredLevel
├── team.ts        — CREATE: memberStats
├── generators.ts  — MODIFY: TicketInit gains techSubtype/benefitRevenuePct
├── newGame.ts     — MODIFY: init studioLevel, reportHistory
├── inbox.ts       — MODIFY: requiredLevel, techdebt kind, accept-gate, deadlines
├── actions.ts     — MODIFY: upgradeStudio, games-cap on buy/start
├── releases.ts    — MODIFY: canCutRelease RM star capacity
├── work.ts        — MODIFY: tech-debt fail roll, named report events
├── endWeek.ts     — MODIFY: reportHistory push+trim
├── save.ts        — MODIFY: v2 structural sniff
└── index.ts       — MODIFY: export studio/team helpers + TechSubtype
src/ui/
├── App.tsx                       — MODIFY: 'reports' screen
├── components/TopBar.tsx         — MODIFY: studio level chip
├── components/Sidebar.tsx        — MODIFY: Reports nav
├── components/TicketCard.tsx     — MODIFY: tech-debt gist + ? popover
├── components/TicketModal.tsx    — MODIFY: tech-debt success/fail block
├── components/WeeklyReportModal.tsx — MODIFY: accept an optional report prop
├── screens/MarketScreen.tsx      — MODIFY: Studio upgrade panel
├── screens/InboxScreen.tsx       — MODIFY: grouped sections + locked badges
├── screens/TeamScreen.tsx        — MODIFY: employee info lines
├── screens/ReportsScreen.tsx     — CREATE: report history list
├── format.ts                     — MODIFY: (if needed) shared label helpers
└── theme.css                     — MODIFY: type-icon.techdebt, .popover, chips
```

---

### Task 1: Schema v2 foundation — constants, data, types

**Files:**
- Modify: `src/engine/constants.ts`, `src/engine/data.ts`, `src/engine/types.ts`

No test of its own (compile-checked; later tasks test behavior). This task only adds declarations so everything else compiles.

- [ ] **Step 1: Bump schema + add constants in `src/engine/constants.ts`**

Change `export const SCHEMA_VERSION = 1;` to `= 2;`. Then append at the end of the file:

```ts
// Studio level
export const STUDIO_LEVEL_CAP = 10;
export const STUDIO_MAX_GAMES_PER_LEVEL = 4;
// Cost to reach the NEXT level; index = currentLevel - 1 (L1→2 … L9→10).
export const STUDIO_UPGRADE_COSTS: readonly number[] = [
  4_000, 12_000, 25_000, 45_000, 75_000, 120_000, 180_000, 260_000, 360_000,
];
export const GATE_GRACE_WEEKS = 4; // first weeks: every gated item is Lv 1
export const LEVEL_WINDOW_ABOVE = 2; // items may require up to studioLevel + this
export const LEVEL_WINDOW_SPAN = 5; // distinct required-levels visible at once

// Tech debt
export const TECHDEBT_EFFORT: readonly [number, number] = [4, 7];
export const TECH_FAIL_BASE = 0.5;
export const TECH_FAIL_PER_SKILL = 0.09; // failChance = clamp(BASE - PER_SKILL×skill, 0.02, 0.7)
export const TECH_FAIL_MIN = 0.02;
export const TECH_FAIL_MAX = 0.7;
export const TECH_FAIL_PENALTY = 500; // cash ding on a failed tech-debt attempt
export const TECH_REWORK_FRACTION = 0.5; // rework effort = ceil(effortTotal × this)
export const TECH_INVEST_REVENUE_PCT: readonly [number, number] = [3, 6];
export const TECHDEBT_DEADLINE_WEEKS = 3;
export const TECHDEBT_FINE = 4_000;

// Report history
export const REPORT_HISTORY_CAP = 10;
```

- [ ] **Step 2: Add tech-debt title banks in `src/engine/data.ts`**

Append at the end:

```ts
export const TECHDEBT_MANDATORY_TITLES = [
  'SDK Upgrade 4.2',
  'Privacy Compliance Update',
  'Ad Mediation SDK Upgrade',
  'OS Target API Bump',
] as const;

export const TECHDEBT_INVESTMENT_TITLES = [
  'Game Engine v9 Migration',
  'AI Automation Pipeline',
  'Build Pipeline Overhaul',
  'Crash Analytics Revamp',
  'Live-Ops Tooling Upgrade',
] as const;
```

- [ ] **Step 3: Extend `src/engine/types.ts`**

Apply these edits:

```ts
// TicketType: add 'Tech Debt'
export type TicketType = 'Story' | 'Bug' | 'Release Ticket' | 'Task' | 'Tech Debt';

// InboxItemKind: swap 'sdk' → 'techdebt'
export type InboxItemKind = 'feature' | 'bug' | 'opportunity' | 'techdebt';

// New: add right after InboxItemKind
export type TechSubtype = 'mandatory' | 'investment';
```

In `interface Ticket`, after `releaseVersion: string | null;` add:

```ts
  techSubtype?: TechSubtype; // Tech Debt tickets only
  benefitRevenuePct?: number; // investment tech-debt: +% revenue on success
```

In `interface InboxItem`, replace the `// sdk fields` block (`fineUsd?: number;`) with:

```ts
  // sdk/techdebt fields
  fineUsd?: number;
  requiredLevel?: number; // feature & techdebt only (studio-level gate)
  techSubtype?: TechSubtype;
  benefitRevenuePct?: number; // investment subtype
```

In `interface GameState`, after `status: 'playing' | 'bankrupt';` add:

```ts
  studioLevel: number;
```
and after `lastReport: WeeklyReport | null;` add:

```ts
  reportHistory: WeeklyReport[]; // most recent first-N (capped)
```

In `PlanAction`, add a member:

```ts
  | { type: 'upgradeStudio' }
```

- [ ] **Step 4: Verify it compiles**

Run: `npm run build`
Expected: FAILS — existing code (newGame, save sniff, generators, inbox) doesn't yet set `studioLevel`/`reportHistory` and still references `'sdk'`. That's expected; later tasks fix each. To confirm only the *expected* breakages, run:

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: errors about missing `studioLevel`/`reportHistory` in `newGame.ts` and the `'sdk'` kind in `inbox.ts` — no syntax errors in `constants.ts`/`data.ts`/`types.ts`.

(Do not commit yet — the tree doesn't build. Task 2 restores green. If you prefer a green commit here, temporarily add `studioLevel: 1, reportHistory: []` to `newGame.ts`'s state literal now; Task 2 covers it formally.)

- [ ] **Step 5: Make `newGame` set the new fields so the tree builds, then commit**

In `src/engine/newGame.ts`, in the `const s: GameState = { … }` literal, add `studioLevel: 1,` after `status: 'playing',` and `reportHistory: [],` after `lastReport: null,`.

Run: `npm test` — Expected: PASS (78 tests; new fields are additive, existing behavior unchanged). If `inbox.ts` still references `'sdk'` and breaks the build/tests, that is fixed in Task 4 — but `'sdk'` removal from the *type* will surface here. To keep this task green, in `src/engine/inbox.ts` temporarily leave the `'sdk'` branch but change the type reference: the `generateWeeklyInbox` literal `roll < 0.9 ? 'opportunity' : 'sdk'` will now be a type error. **Fix forward instead:** do Task 4 in the same sitting if the build is red. Simplest: commit Tasks 1+4 together if needed.

```bash
git add src/engine/constants.ts src/engine/data.ts src/engine/types.ts src/engine/newGame.ts
git commit -m "feat(engine): v2 schema — studio/techdebt/report types, constants, data"
```

> **Implementer note:** Tasks 1 and 4 are tightly coupled through the `'sdk'`→`'techdebt'` type rename. If the build is red after Task 1, proceed directly to Task 4 before committing; otherwise the temporary green via the note above is fine.

---

### Task 2: Studio module — maxGamesFor, nextUpgradeCost, rollRequiredLevel

**Files:**
- Create: `src/engine/studio.ts`
- Test: `src/engine/__tests__/studio.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/studio.test.ts
import { Rng } from '../rng';
import { maxGamesFor, nextUpgradeCost, rollRequiredLevel } from '../studio';
import { STUDIO_LEVEL_CAP, STUDIO_UPGRADE_COSTS, LEVEL_WINDOW_SPAN } from '../constants';
import { makeState } from './helpers';

describe('maxGamesFor', () => {
  it('is level × 4', () => {
    expect(maxGamesFor(1)).toBe(4);
    expect(maxGamesFor(10)).toBe(40);
  });
});

describe('nextUpgradeCost', () => {
  it('returns the indexed cost, null at cap', () => {
    expect(nextUpgradeCost(1)).toBe(STUDIO_UPGRADE_COSTS[0]);
    expect(nextUpgradeCost(9)).toBe(STUDIO_UPGRADE_COSTS[8]);
    expect(nextUpgradeCost(STUDIO_LEVEL_CAP)).toBeNull();
  });
});

describe('rollRequiredLevel', () => {
  it('forces level 1 during the grace period', () => {
    const s = makeState();
    s.weekIndex = 0;
    s.studioLevel = 5;
    for (let i = 0; i < 50; i++) expect(rollRequiredLevel(s, new Rng(i))).toBe(1);
  });

  it('post-grace stays within a clamped window around studioLevel', () => {
    const s = makeState();
    s.weekIndex = 20;
    s.studioLevel = 5; // ceiling = 7, floor = 3
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rollRequiredLevel(s, new Rng(i)));
    const levels = [...seen];
    expect(Math.min(...levels)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...levels)).toBeLessThanOrEqual(7);
    expect(Math.max(...levels) - Math.min(...levels)).toBeLessThanOrEqual(LEVEL_WINDOW_SPAN - 1);
    expect(levels).toContain(3); // lower levels always present (skewed toward floor)
  });

  it('never exceeds the cap even at high studio level', () => {
    const s = makeState();
    s.weekIndex = 20;
    s.studioLevel = 10;
    for (let i = 0; i < 200; i++) {
      const lv = rollRequiredLevel(s, new Rng(i));
      expect(lv).toBeLessThanOrEqual(STUDIO_LEVEL_CAP);
      expect(lv).toBeGreaterThanOrEqual(1);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/__tests__/studio.test.ts`
Expected: FAIL — `Cannot find module '../studio'`.

- [ ] **Step 3: Create `src/engine/studio.ts`**

```ts
// src/engine/studio.ts
import { Rng } from './rng';
import {
  GATE_GRACE_WEEKS, LEVEL_WINDOW_ABOVE, LEVEL_WINDOW_SPAN,
  STUDIO_LEVEL_CAP, STUDIO_MAX_GAMES_PER_LEVEL, STUDIO_UPGRADE_COSTS,
} from './constants';
import type { GameState } from './types';

export function maxGamesFor(level: number): number {
  return level * STUDIO_MAX_GAMES_PER_LEVEL;
}

/** Cost to go from `level` to `level+1`; null if already at the cap. */
export function nextUpgradeCost(level: number): number | null {
  if (level >= STUDIO_LEVEL_CAP) return null;
  return STUDIO_UPGRADE_COSTS[level - 1];
}

/** Required studio level for a generated feature / tech-debt item.
 *  Grace period forces Lv 1; otherwise a ~5-level window around the studio
 *  level, skewed toward the accessible floor, reaching up to studioLevel+2. */
export function rollRequiredLevel(s: GameState, rng: Rng): number {
  if (s.weekIndex < GATE_GRACE_WEEKS) return 1;
  const ceiling = Math.min(STUDIO_LEVEL_CAP, s.studioLevel + LEVEL_WINDOW_ABOVE);
  const floor = Math.max(1, ceiling - LEVEL_WINDOW_SPAN + 1);
  const span = ceiling - floor; // max 0-based offset
  const offset = Math.min(rng.int(0, span), rng.int(0, span)); // triangular → floor
  return floor + offset;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/__tests__/studio.test.ts`
Expected: PASS. Then `npm test` (full) — expected: PASS (78 + 3).

- [ ] **Step 5: Commit**

```bash
git add src/engine/studio.ts src/engine/__tests__/studio.test.ts
git commit -m "feat(engine): studio module — game cap, upgrade cost, required-level window"
```

---

### Task 3: upgradeStudio action + games-cap gate

**Files:**
- Modify: `src/engine/actions.ts`
- Test: `src/engine/__tests__/studio-actions.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/studio-actions.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { nextUpgradeCost, maxGamesFor } from '../studio';
import { STUDIO_LEVEL_CAP } from '../constants';

describe('upgradeStudio', () => {
  it('deducts cash, raises level instantly, logs a delta', () => {
    const s = newGame(1);
    const cost = nextUpgradeCost(s.studioLevel)!;
    const s2 = applyAction(s, { type: 'upgradeStudio' });
    expect(s2.studioLevel).toBe(2);
    expect(s2.cash).toBe(s.cash - cost);
    expect(s2.pendingDeltas.some((d) => d.amount === -cost)).toBe(true);
    expect(s.studioLevel).toBe(1); // input untouched
  });

  it('throws when cash is short or at cap', () => {
    const s = newGame(1);
    s.cash = 0;
    expect(() => applyAction(s, { type: 'upgradeStudio' })).toThrow();
    const maxed = newGame(1);
    maxed.studioLevel = STUDIO_LEVEL_CAP;
    maxed.cash = 10_000_000;
    expect(() => applyAction(maxed, { type: 'upgradeStudio' })).toThrow();
  });
});

describe('games cap', () => {
  it('blocks startNewGame and buyGame beyond maxGamesFor(level)', () => {
    const s = newGame(1);
    s.cash = 10_000_000;
    // L1 → max 4 games; start at 2, add 2 → 4, third should throw
    let st = applyAction(s, { type: 'startNewGame', genre: 'Puzzle' });
    st = applyAction(st, { type: 'startNewGame', genre: 'Card' });
    expect(st.games.length).toBe(maxGamesFor(1));
    expect(() => applyAction(st, { type: 'startNewGame', genre: 'Word' })).toThrow();
    const offerId = st.market.offers[0]?.id;
    if (offerId) expect(() => applyAction(st, { type: 'buyGame', offerId })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/__tests__/studio-actions.test.ts`
Expected: FAIL — `Unknown action upgradeStudio` and no games-cap throw.

- [ ] **Step 3: Wire the handler and the cap in `src/engine/actions.ts`**

Add to the imports from `./studio`:
```ts
import { maxGamesFor, nextUpgradeCost } from './studio';
```

Append a new handler (next to the others):
```ts
handlers.upgradeStudio = ({ s }) => {
  const cost = nextUpgradeCost(s.studioLevel);
  if (cost === null) throw new Error('Studio is already at max level');
  if (s.cash < cost) throw new Error('Not enough cash to upgrade the studio');
  s.cash -= cost;
  s.pendingDeltas.push({ label: `Studio upgrade → Lv ${s.studioLevel + 1}`, amount: -cost });
  s.studioLevel += 1;
  s.pendingEvents.push(`🏢 Studio upgraded to Level ${s.studioLevel} — up to ${maxGamesFor(s.studioLevel)} games`);
  s.log.push(`Studio reached Level ${s.studioLevel}`);
};
```

In `handlers.buyGame`, immediately after the `const o = …; if (!o) throw …;` lookup and before the cash check, add:
```ts
  if (s.games.length >= maxGamesFor(s.studioLevel)) {
    throw new Error('Studio level too low — upgrade to manage more games');
  }
```

In `handlers.startNewGame`, as the first line of the handler body, add:
```ts
  if (s.games.length >= maxGamesFor(s.studioLevel)) {
    throw new Error('Studio level too low — upgrade to manage more games');
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/__tests__/studio-actions.test.ts` → PASS. Then `npm test` (full) → PASS. Then `npm run build` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/engine/actions.ts src/engine/__tests__/studio-actions.test.ts
git commit -m "feat(engine): upgradeStudio action + games-cap gate on buy/start"
```

---

### Task 4: Tech-debt inbox kind + accept (creates studio-wide ticket, applies the level gate)

**Files:**
- Modify: `src/engine/generators.ts` (TicketInit fields), `src/engine/inbox.ts` (generation + accept + gate)
- Test: `src/engine/__tests__/techdebt-inbox.test.ts`

This task also completes the `'sdk'`→`'techdebt'` rename started in Task 1.

- [ ] **Step 1: Extend `TicketInit` + `createTicket` in `src/engine/generators.ts`**

In `interface TicketInit`, add:
```ts
  techSubtype?: import('./types').TechSubtype;
  benefitRevenuePct?: number;
```
In `createTicket`'s returned object literal, add (after `releaseVersion: …,`):
```ts
    techSubtype: init.techSubtype,
    benefitRevenuePct: init.benefitRevenuePct,
```

- [ ] **Step 2: Write the failing test**

```ts
// src/engine/__tests__/techdebt-inbox.test.ts
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { generateInboxItem } from '../inbox';
import { makeState } from './helpers';

describe('tech-debt generation', () => {
  it('produces a studio-wide item with a subtype and required level', () => {
    const s = makeState();
    s.weekIndex = 20;
    const item = generateInboxItem(s, new Rng(2), 'techdebt');
    expect(item.kind).toBe('techdebt');
    expect(item.gameId).toBe('');
    expect(item.techSubtype === 'mandatory' || item.techSubtype === 'investment').toBe(true);
    expect(item.requiredLevel).toBeGreaterThanOrEqual(1);
    expect(item.effort).toBeGreaterThan(0);
    if (item.techSubtype === 'mandatory') expect(item.deadlineWeek).toBeGreaterThan(s.weekIndex);
    if (item.techSubtype === 'investment') expect(item.benefitRevenuePct).toBeGreaterThan(0);
  });

  it('can be forced to a subtype', () => {
    const s = makeState();
    s.weekIndex = 20;
    expect(generateInboxItem(s, new Rng(1), 'techdebt', undefined, 'investment').techSubtype).toBe('investment');
  });
});

describe('accept tech-debt + level gate', () => {
  it('accepting creates a studio-wide Tech Debt ticket carrying its subtype', () => {
    const s = newGame(1);
    const item = generateInboxItem(s, new Rng(7), 'techdebt', undefined, 'investment');
    item.requiredLevel = 1;
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const t = s2.tickets.find((x) => x.title === item.title)!;
    expect(t.type).toBe('Tech Debt');
    expect(t.gameId).toBe('');
    expect(t.techSubtype).toBe('investment');
    expect(t.benefitRevenuePct).toBe(item.benefitRevenuePct);
  });

  it('throws when studio level is below the item requiredLevel', () => {
    const s = newGame(1); // studioLevel 1
    const item = generateInboxItem(s, new Rng(3), 'techdebt');
    item.requiredLevel = 4;
    s.inbox.push(item);
    expect(() => applyAction(s, { type: 'acceptInbox', itemId: item.id })).toThrow(/Studio Level/i);
  });

  it('feature items are gated too, bugs are not', () => {
    const s = newGame(1);
    const feat = generateInboxItem(s, new Rng(5), 'feature');
    feat.requiredLevel = 6;
    const bug = generateInboxItem(s, new Rng(6), 'bug'); // bugs carry no requiredLevel
    s.inbox.push(feat, bug);
    expect(() => applyAction(s, { type: 'acceptInbox', itemId: feat.id })).toThrow(/Studio Level/i);
    expect(() => applyAction(s, { type: 'acceptInbox', itemId: bug.id })).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test src/engine/__tests__/techdebt-inbox.test.ts`
Expected: FAIL — `'techdebt'` not handled / no gate.

- [ ] **Step 4: Rewrite generation + accept in `src/engine/inbox.ts`**

Update the imports:
```ts
import {
  DECLINED_BUG_RATING_HIT, FEATURING_DEADLINE_WEEKS, FEATURING_REWARD_PCT,
  GENRE_FIT, INBOX_PER_WEEK, TECHDEBT_DEADLINE_WEEKS, TECHDEBT_EFFORT,
  TECHDEBT_FINE, TECH_INVEST_REVENUE_PCT,
} from './constants';
import { OPPORTUNITY_BODIES, TECHDEBT_INVESTMENT_TITLES, TECHDEBT_MANDATORY_TITLES } from './data';
import { cwLabel } from './week';
import { createTicket, genId, genStoryConcept, genBugTitle, effortFor } from './generators';
import { rollRequiredLevel } from './studio';
import type { GameState, InboxItem, InboxItemKind, TechSubtype } from './types';
```

Change `generateInboxItem`'s signature to accept a forced subtype:
```ts
export function generateInboxItem(
  s: GameState,
  rng: Rng,
  kind: InboxItemKind,
  gameId?: string,
  forcedSubtype?: TechSubtype,
): InboxItem {
```

In the `feature` branch, add `requiredLevel: rollRequiredLevel(s, rng),` to the returned object (call it once; place the `rollRequiredLevel(s, rng)` result in a const if you prefer, but a direct call in the literal is fine).

Replace the entire `// sdk` tail (from `// sdk` to the end of the function) with:
```ts
  // techdebt (studio-wide; replaces the old per-game SDK task)
  const subtype: TechSubtype = forcedSubtype ?? (rng.next() < 0.55 ? 'mandatory' : 'investment');
  const requiredLevel = rollRequiredLevel(s, rng);
  const effort = rng.int(TECHDEBT_EFFORT[0], TECHDEBT_EFFORT[1]);
  if (subtype === 'mandatory') {
    const deadlineWeek = s.weekIndex + TECHDEBT_DEADLINE_WEEKS;
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
    body: `Optional engineering investment. Ships → permanent +${benefitRevenuePct}% revenue on every game you own. A junior dev may botch it.`,
    benefitRevenuePct, effort,
  };
```

In `acceptInboxItem`, add the gate right after `if (item.status !== 'pending') throw …;`:
```ts
  if ((item.kind === 'feature' || item.kind === 'techdebt') &&
      item.requiredLevel && s.studioLevel < item.requiredLevel) {
    throw new Error(`Requires Studio Level ${item.requiredLevel}`);
  }
```
Replace the `else if (item.kind === 'sdk') { … }` branch with:
```ts
  } else if (item.kind === 'techdebt') {
    createTicket(s, {
      type: 'Tech Debt', gameId: '', title: item.title, effort: item.effort!,
      deadlineWeek: item.techSubtype === 'mandatory' ? item.deadlineWeek : null,
      techSubtype: item.techSubtype, benefitRevenuePct: item.benefitRevenuePct,
    });
  }
```
(Note: the `game` lookup at the top of `acceptInboxItem` uses `item.gameId`; for tech-debt `gameId===''` so `s.games.find(...)` returns `undefined`. The feature/bug branches don't run for techdebt, and the techdebt branch doesn't use `game`. To avoid an unused-var/`!` hazard, change `const game = s.games.find((g) => g.id === item.gameId)!;` to `const game = s.games.find((g) => g.id === item.gameId);` and, in the bug branch where `game` was used for the title prefix, it already uses `item.title` for the created ticket — verify no `game!` deref remains; the only `game` use is the sdk branch being replaced, so after replacement `game` may be unused → remove the `const game` line entirely if TypeScript flags it.)

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test src/engine/__tests__/techdebt-inbox.test.ts` → PASS. Then `npm run build` → it will still fail in `generateWeeklyInbox` / `checkDeadlines` (they reference `'sdk'`) and in the existing `inbox.test.ts` (sdk cases). Those are fixed in Task 6. If you are committing per-task, do Step 6 of Task 6 before the full `npm test`. For now confirm the new file passes in isolation.

- [ ] **Step 6: Commit (with Task 6 if the tree is red)**

```bash
git add src/engine/generators.ts src/engine/inbox.ts src/engine/__tests__/techdebt-inbox.test.ts
git commit -m "feat(engine): tech-debt inbox kind, studio-wide accept, studio-level gate"
```

---

### Task 5: Tech-debt dev completion — the fail roll

**Files:**
- Modify: `src/engine/work.ts`
- Test: `src/engine/__tests__/techdebt-work.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/techdebt-work.test.ts
import { Rng } from '../rng';
import { runDevPhase } from '../work';
import { makeState, addMember, addTicket, assignTo } from './helpers';
import { TECH_REWORK_FRACTION } from '../constants';

function buildTechDebt(skill: number, over = {}) {
  const s = makeState();
  const dev = addMember(s, 'Developer', skill);
  const t = addTicket(s, {
    type: 'Tech Debt', gameId: '', title: 'SDK Upgrade 4.2',
    effortTotal: 4, effort: 4, phaseEffort: 4, techSubtype: 'investment', benefitRevenuePct: 5,
    ...over,
  });
  assignTo(s, t, dev);
  return { s, dev, t };
}

describe('tech-debt completion', () => {
  it('a high-skill dev almost always ships it (DONE) and applies the investment benefit', () => {
    const { s, t } = buildTechDebt(5);
    const before = s.games.map((g) => g.revenuePerPlayer);
    const rng = new Rng(1);
    for (let i = 0; i < 5 && t.status !== 'DONE' && t.status !== 'TODO'; i++) runDevPhase(s, rng);
    expect(t.status).toBe('DONE');
    s.games.forEach((g, i) => expect(g.revenuePerPlayer).toBeGreaterThan(before[i]));
    expect(s.pendingEvents.some((e) => e.includes('shipped'))).toBe(true);
  });

  it('a low-skill dev can fail: ticket bounces to TODO with rework + penalty + event', () => {
    // skill 1 → ~41% fail; find a seed that fails on first completion
    let found = false;
    for (let seed = 0; seed < 40 && !found; seed++) {
      const { s, t } = buildTechDebt(1, { effortTotal: 2, effort: 2, phaseEffort: 2 });
      const cashBefore = s.cash;
      const rng = new Rng(seed);
      for (let i = 0; i < 6 && t.status === 'IN_DEVELOPMENT'; i++) runDevPhase(s, rng);
      if (t.status === 'TODO') {
        found = true;
        expect(t.effort).toBe(Math.max(1, Math.ceil(t.effortTotal * TECH_REWORK_FRACTION)));
        expect(t.assigneeId).toBeNull();
        expect(s.cash).toBeLessThan(cashBefore);
        expect(s.pendingEvents.some((e) => e.includes('technical error'))).toBe(true);
      }
    }
    expect(found).toBe(true);
  });

  it('mandatory success clears the deadline', () => {
    const { s, t } = buildTechDebt(5, { techSubtype: 'mandatory', benefitRevenuePct: undefined, deadlineWeek: 3 });
    const rng = new Rng(1);
    for (let i = 0; i < 5 && t.status === 'IN_DEVELOPMENT'; i++) runDevPhase(s, rng);
    expect(t.status).toBe('DONE');
    expect(t.deadlineWeek).toBeNull();
  });

  it('story/bug completion is unchanged (goes to AWAITING_QA)', () => {
    const s = makeState();
    const dev = addMember(s, 'Developer', 3);
    const t = addTicket(s, { effortTotal: 4, effort: 4, phaseEffort: 4 }); // default Story
    assignTo(s, t, dev);
    for (let i = 0; i < 3 && t.status === 'IN_DEVELOPMENT'; i++) runDevPhase(s, new Rng(1));
    expect(t.status).toBe('AWAITING_QA');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/__tests__/techdebt-work.test.ts`
Expected: FAIL — tech-debt tickets currently go to AWAITING_QA, no fail roll.

- [ ] **Step 3: Branch `runDevPhase` on ticket type in `src/engine/work.ts`**

Update imports:
```ts
import {
  BUG_RATE_PER_POINT, QA_CATCH_BASE, QA_CATCH_PER_SKILL, REWORK_FRACTION,
  TECH_FAIL_BASE, TECH_FAIL_MAX, TECH_FAIL_MIN, TECH_FAIL_PENALTY, TECH_REWORK_FRACTION,
  speedOf,
} from './constants';
import { clamp } from './quality';
```

Replace the `if (t.effort <= 0) { … }` block inside `runDevPhase` with:
```ts
    if (t.effort <= 0) {
      t.assigneeId = null;
      m.ticketKey = null;
      if (t.type === 'Tech Debt') {
        const devSkill = t.pointsWorked > 0 ? t.devSkillSum / t.pointsWorked : m.skill;
        const failChance = clamp(TECH_FAIL_BASE - TECH_FAIL_PER_SKILL * devSkill, TECH_FAIL_MIN, TECH_FAIL_MAX);
        if (rng.chance(failChance)) {
          const rework = Math.max(1, Math.ceil(t.effortTotal * TECH_REWORK_FRACTION));
          t.effort = rework;
          t.phaseEffort = rework;
          t.status = 'TODO';
          s.cash -= TECH_FAIL_PENALTY;
          s.pendingDeltas.push({ label: `Technical error: ${t.title}`, amount: -TECH_FAIL_PENALTY });
          s.pendingEvents.push(`⚠️ ${m.name} hit a technical error on ${t.title} — needs rework`);
        } else {
          t.status = 'DONE';
          if (t.techSubtype === 'investment' && t.benefitRevenuePct) {
            for (const g of s.games) {
              g.revenuePerPlayer = Math.round(g.revenuePerPlayer * (1 + t.benefitRevenuePct / 100) * 10000) / 10000;
            }
            s.pendingEvents.push(`🔧 ${m.name} shipped ${t.title} — +${t.benefitRevenuePct}% revenue on all games`);
            s.log.push(`Shipped ${t.title} (+${t.benefitRevenuePct}% revenue)`);
          } else {
            t.deadlineWeek = null; // mandatory obligation cleared
            s.pendingEvents.push(`🔧 ${m.name} shipped ${t.title}`);
          }
        }
      } else {
        const expectedBugs = t.phaseEffort * Math.max(0, 6 - m.skill) * BUG_RATE_PER_POINT;
        t.hiddenBugs += rng.count(expectedBugs);
        t.status = 'AWAITING_QA';
        t.qaEffort = 0; // fresh QA phase — sized when a QA member is assigned
        s.pendingEvents.push(`✅ ${m.name} finished ${t.title} → QA`);
      }
    }
```

(Note the `TECH_FAIL_PER_SKILL` import is also needed — add it to the constants import list. The named `✅ … → QA` line is the Task-9 detail event; including it here is fine since it's the same edit site.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/__tests__/techdebt-work.test.ts` → PASS. Then `npm test` (full) — the existing `work.test.ts` dev tests still pass (story path unchanged + a new event line, which they don't assert against).

- [ ] **Step 5: Commit**

```bash
git add src/engine/work.ts src/engine/__tests__/techdebt-work.test.ts
git commit -m "feat(engine): tech-debt dev completion fail roll (dev skill weighted)"
```

---

### Task 6: Tech-debt deadlines + weekly generation (finish the sdk→techdebt rename)

**Files:**
- Modify: `src/engine/inbox.ts` (`generateWeeklyInbox`, `checkDeadlines`)
- Modify: `src/engine/__tests__/inbox.test.ts` (update the sdk-named cases to techdebt)
- Test: reuse `inbox.test.ts`

- [ ] **Step 1: Update `generateWeeklyInbox` in `src/engine/inbox.ts`**

Replace its body with:
```ts
export function generateWeeklyInbox(s: GameState, rng: Rng): void {
  const count = rng.int(INBOX_PER_WEEK[0], INBOX_PER_WEEK[1]);
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    const kind: InboxItemKind =
      roll < 0.45 ? 'feature' : roll < 0.75 ? 'bug' : roll < 0.9 ? 'opportunity' : 'techdebt';
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
}
```

- [ ] **Step 2: Update `checkDeadlines` in `src/engine/inbox.ts`**

Replace the two fine branches:
- The `if (item.kind === 'sdk' && …)` becomes:
```ts
    if (item.kind === 'techdebt' && item.techSubtype === 'mandatory' &&
        (item.status === 'pending' || item.status === 'declined')) {
      s.cash -= item.fineUsd!;
      s.pendingDeltas.push({ label: `Compliance fine: ${item.title}`, amount: -item.fineUsd! });
      s.pendingEvents.push(`🚨 Missed compliance deadline — fined $${item.fineUsd!.toLocaleString('en-US')}`);
      item.status = 'done';
    } else if (item.kind === 'opportunity' && (item.status === 'pending' || item.status === 'accepted')) {
```
- The overdue-ticket loop condition becomes:
```ts
  for (const t of s.tickets) {
    if (
      t.type === 'Tech Debt' && t.techSubtype === 'mandatory' && t.deadlineWeek !== null &&
      t.deadlineWeek < s.weekIndex && t.status !== 'DONE'
    ) {
      s.cash -= TECHDEBT_FINE;
      s.pendingDeltas.push({ label: `Compliance fine: ${t.title}`, amount: -TECHDEBT_FINE });
      s.pendingEvents.push(`🚨 ${t.title} missed its deadline — fined $${TECHDEBT_FINE.toLocaleString('en-US')}`);
      t.deadlineWeek = null; // fined once
    }
  }
```
(Remove the now-unused `SDK_FINE`/`SDK_DEADLINE_WEEKS` imports if present; `TECHDEBT_FINE` is already imported from Task 4.)

- [ ] **Step 3: Update the sdk-named tests in `src/engine/__tests__/inbox.test.ts`**

Find the deadline/SDK tests and adapt them to tech-debt. Replace the `'fines a declined SDK item once when the deadline passes'` and `'fines an accepted-but-unfinished SDK task at the deadline'` tests with:

```ts
  it('fines a declined mandatory tech-debt item once when the deadline passes', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(1), 'techdebt', undefined, 'mandatory');
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'declineInbox', itemId: item.id });
    s2.weekIndex = item.deadlineWeek! + 1;
    const cash = s2.cash;
    checkDeadlines(s2);
    expect(s2.cash).toBe(cash - SDK_FINE_EXPECTED);
    checkDeadlines(s2); // no double fine
    expect(s2.cash).toBe(cash - SDK_FINE_EXPECTED);
  });

  it('fines an accepted-but-unfinished mandatory tech-debt ticket at the deadline', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(2), 'techdebt', undefined, 'mandatory');
    item.requiredLevel = 1;
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const task = s2.tickets.find((t) => t.type === 'Tech Debt')!;
    expect(task.deadlineWeek).toBe(item.deadlineWeek);
    s2.weekIndex = item.deadlineWeek! + 1;
    const cash = s2.cash;
    checkDeadlines(s2);
    expect(s2.cash).toBe(cash - SDK_FINE_EXPECTED);
    expect(s2.tickets.find((t) => t.type === 'Tech Debt')!.deadlineWeek).toBeNull();
  });
```
At the top of `inbox.test.ts`, replace any `import { SDK_FINE } from '../constants';` with `import { TECHDEBT_FINE } from '../constants';` and define `const SDK_FINE_EXPECTED = TECHDEBT_FINE;` (or just use `TECHDEBT_FINE` directly in the assertions). Also update the `generateWeeklyInbox` test that asserts kinds if it referenced `'sdk'`.

- [ ] **Step 4: Run the full suite + build**

Run: `npm test`
Expected: PASS (studio + techdebt + existing suites all green).
Run: `npm run build`
Expected: clean (no remaining `'sdk'` references anywhere).

- [ ] **Step 5: Commit**

```bash
git add src/engine/inbox.ts src/engine/__tests__/inbox.test.ts
git commit -m "feat(engine): tech-debt weekly generation + mandatory deadline fines (sdk→techdebt complete)"
```

---

### Task 7: Release Manager capacity = sum of stars

**Files:**
- Modify: `src/engine/releases.ts` (`canCutRelease`)
- Test: `src/engine/__tests__/rm-capacity.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/rm-capacity.test.ts
import { canCutRelease } from '../releases';
import { applyAction } from '../actions';
import { makeState, addMember, addTicket } from './helpers';
import type { GameState } from '../types';

function readyTicket(s: GameState, gameId: string) {
  return addTicket(s, {
    gameId, status: 'QA_COMPLETE', pointsWorked: 6, devSkillSum: 18, hiddenBugs: 0,
    impact: { revenuePct: 8, ratingBonus: 0.1 },
  });
}

describe('RM capacity = Σ stars', () => {
  it('a single skill-3 RM allows up to 3 simultaneous cuts', () => {
    const s = makeState();
    s.team = s.team.filter((m) => m.role !== 'Release Manager');
    addMember(s, 'Release Manager', 3); // 3 stars → capacity 3
    // need 3 distinct games with QA-complete work; makeState has 2, add a third
    const g3 = { ...s.games[0], id: 'g-extra', name: 'Extra Game' };
    s.games.push(g3);
    for (const g of s.games) readyTicket(s, g.id);
    let st = applyAction(s, { type: 'cutRelease', gameId: s.games[0].id });
    st = applyAction(st, { type: 'cutRelease', gameId: s.games[1].id });
    expect(canCutRelease(st, s.games[2].id).ok).toBe(true); // 2 cutting < 3 capacity
    st = applyAction(st, { type: 'cutRelease', gameId: s.games[2].id });
    expect(st.releases.filter((r) => r.status === 'cutting').length).toBe(3);
  });

  it('blocks once cutting count reaches total RM stars', () => {
    const s = makeState();
    s.team = s.team.filter((m) => m.role !== 'Release Manager');
    addMember(s, 'Release Manager', 1); // capacity 1
    for (const g of s.games) readyTicket(s, g.id);
    const st = applyAction(s, { type: 'cutRelease', gameId: s.games[0].id });
    expect(canCutRelease(st, s.games[1].id).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/__tests__/rm-capacity.test.ts`
Expected: FAIL — capacity currently counts RMs, not stars (skill-3 single RM would be blocked after 1 cut).

- [ ] **Step 3: Change `canCutRelease` in `src/engine/releases.ts`**

Replace:
```ts
  const rmCount = s.team.filter((m) => m.role === 'Release Manager').length;
  const cutting = s.releases.filter((r) => r.status === 'cutting').length;
  if (cutting >= rmCount) return { ok: false, reason: 'All release managers are busy this week' };
```
with:
```ts
  const rmCapacity = s.team
    .filter((m) => m.role === 'Release Manager')
    .reduce((a, m) => a + m.skill, 0);
  const cutting = s.releases.filter((r) => r.status === 'cutting').length;
  if (cutting >= rmCapacity) return { ok: false, reason: 'Release managers are at capacity this week' };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/__tests__/rm-capacity.test.ts` → PASS. Then `npm test` (full) → PASS (the existing release tests use the seeded skill-3 RM; one cut is still allowed, so they stay green).

- [ ] **Step 5: Commit**

```bash
git add src/engine/releases.ts src/engine/__tests__/rm-capacity.test.ts
git commit -m "feat(engine): release-manager weekly capacity = sum of stars"
```

---

### Task 8: memberStats helper

**Files:**
- Create: `src/engine/team.ts`
- Test: `src/engine/__tests__/team.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/team.test.ts
import { memberStats } from '../team';
import { speedOf, QA_CATCH_BASE, QA_CATCH_PER_SKILL } from '../constants';

describe('memberStats', () => {
  it('developer shows build speed and bug-proneness', () => {
    const lines = memberStats('Developer', 5);
    expect(lines[0]).toContain(`${speedOf(5)}`);
    expect(lines.join(' ')).toMatch(/very low/);
    expect(memberStats('Developer', 1).join(' ')).toMatch(/very high/);
  });

  it('QA shows test speed and catch rate %', () => {
    const lines = memberStats('QA', 3);
    const rate = Math.round((QA_CATCH_BASE + QA_CATCH_PER_SKILL * 3) * 100);
    expect(lines.join(' ')).toContain(`${rate}%`);
    expect(lines[0]).toContain(`${speedOf(3)}`);
  });

  it('release manager shows releases/week', () => {
    expect(memberStats('Release Manager', 2).join(' ')).toMatch(/2 releases\/week/);
    expect(memberStats('Release Manager', 1).join(' ')).toMatch(/1 release\/week/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test src/engine/__tests__/team.test.ts`
Expected: FAIL — `Cannot find module '../team'`.

- [ ] **Step 3: Create `src/engine/team.ts`**

```ts
// src/engine/team.ts
import { QA_CATCH_BASE, QA_CATCH_PER_SKILL, speedOf } from './constants';
import type { Role } from './types';

// index by skill 1-5
const BUG_PRONENESS = ['', 'very high', 'high', 'medium', 'low', 'very low'] as const;

/** Human-readable derived stats for a team member / candidate, shown in the UI. */
export function memberStats(role: Role, skill: number): string[] {
  if (role === 'Developer') {
    return [`⚡ ${speedOf(skill)} pts/wk build`, `🐛 ${BUG_PRONENESS[skill]} bug-proneness`];
  }
  if (role === 'QA') {
    const rate = Math.min(99, Math.round((QA_CATCH_BASE + QA_CATCH_PER_SKILL * skill) * 100));
    return [`⚡ ${speedOf(skill)} pts/wk test`, `🎯 ${rate}% catch rate`];
  }
  return [`📦 ${skill} release${skill === 1 ? '' : 's'}/week`];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test src/engine/__tests__/team.test.ts` → PASS. Full `npm test` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/team.ts src/engine/__tests__/team.test.ts
git commit -m "feat(engine): memberStats — human-readable role/skill stats"
```

---

### Task 9: Detailed report events + report history

**Files:**
- Modify: `src/engine/work.ts` (named QA events), `src/engine/endWeek.ts` (history)
- Test: `src/engine/__tests__/report-history.test.ts`

(The named dev/tech-debt events were added in Task 5. This task adds named QA events + history.)

- [ ] **Step 1: Name the QA events in `src/engine/work.ts`**

In `runQaPhase`, replace the bounce line and add a pass line:
```ts
    if (caught > 0) {
      t.hiddenBugs -= caught;
      const rework = Math.max(1, Math.ceil(t.effortTotal * REWORK_FRACTION));
      t.effort = rework;
      t.phaseEffort = rework;
      t.status = 'TODO';
      s.pendingEvents.push(`🔁 ${qa.name} sent ${t.title} back for rework`);
    } else {
      t.status = 'QA_COMPLETE';
      s.pendingEvents.push(`🔬 ${qa.name} passed ${t.title}`);
    }
```

- [ ] **Step 2: Write the failing test**

```ts
// src/engine/__tests__/report-history.test.ts
import { newGame } from '../newGame';
import { endWeek } from '../endWeek';
import { REPORT_HISTORY_CAP } from '../constants';

describe('report history', () => {
  it('accumulates the just-finished report and caps at REPORT_HISTORY_CAP', () => {
    let s = newGame(3);
    expect(s.reportHistory).toEqual([]);
    s = endWeek(s);
    expect(s.reportHistory).toHaveLength(1);
    expect(s.reportHistory[0].cwLabel).toBe(s.lastReport!.cwLabel);
    for (let i = 0; i < REPORT_HISTORY_CAP + 5 && s.status === 'playing'; i++) s = endWeek(s);
    expect(s.reportHistory.length).toBeLessThanOrEqual(REPORT_HISTORY_CAP);
    // newest is last
    expect(s.reportHistory[s.reportHistory.length - 1].cwLabel).toBe(s.lastReport!.cwLabel);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test src/engine/__tests__/report-history.test.ts`
Expected: FAIL — `reportHistory` never grows.

- [ ] **Step 4: Push + trim in `src/engine/endWeek.ts`**

Add the import:
```ts
import { REPORT_HISTORY_CAP } from './constants';
```
After the `s.lastReport = { … };` assignment and before `s.pendingDeltas = [];`, add:
```ts
  s.reportHistory = [...s.reportHistory, s.lastReport].slice(-REPORT_HISTORY_CAP);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test src/engine/__tests__/report-history.test.ts` → PASS. Full `npm test` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine/work.ts src/engine/endWeek.ts src/engine/__tests__/report-history.test.ts
git commit -m "feat(engine): named QA report events + capped weekly report history"
```

---

### Task 10: Save v2 sniff + public exports

**Files:**
- Modify: `src/engine/save.ts`, `src/engine/index.ts`
- Test: `src/engine/__tests__/save.test.ts` (extend)

- [ ] **Step 1: Extend the structural sniff in `src/engine/save.ts`**

Replace the sniff line:
```ts
    if (typeof st.weekIndex !== 'number' || !Array.isArray(st.tickets)) return null;
```
with:
```ts
    if (
      typeof st.weekIndex !== 'number' || !Array.isArray(st.tickets) ||
      typeof st.studioLevel !== 'number' || !Array.isArray(st.reportHistory)
    ) return null;
```

- [ ] **Step 2: Extend exports in `src/engine/index.ts`**

```ts
export { newGame } from './newGame';
export { applyAction } from './actions';
export { endWeek } from './endWeek';
export { serialize, deserialize, SAVE_KEY } from './save';
export { canCutRelease, qaCompleteFor } from './releases';
export { companyValue } from './economy';
export { cwLabel, weekToCW } from './week';
export { maxGamesFor, nextUpgradeCost } from './studio';
export { memberStats } from './team';
export { DECAY_GRACE_WEEKS, GENRES, NEW_GAME_COST, STUDIO_LEVEL_CAP } from './constants';
export type {
  CashDelta, GameOffer, GameState, Genre, Happiness, HireCandidate, Impact,
  InboxItem, PlanAction, PortfolioGame, Release, ReportCard, Role, TeamMember,
  TechSubtype, Ticket, TicketStatus, TicketType, WeeklyReport,
} from './types';
```

- [ ] **Step 3: Add a v2 roundtrip assertion in `src/engine/__tests__/save.test.ts`**

Inside the existing `describe('save/load', …)`, add:
```ts
  it('roundtrips studioLevel and reportHistory', () => {
    let s = newGame(2);
    s = endWeek(s); // populate reportHistory
    s.studioLevel = 3;
    const back = deserialize(serialize(s))!;
    expect(back.studioLevel).toBe(3);
    expect(back.reportHistory).toEqual(s.reportHistory);
  });

  it('rejects a save missing v2 fields', () => {
    const s = newGame(1);
    const bad = JSON.parse(serialize(s));
    delete bad.state.studioLevel;
    expect(deserialize(JSON.stringify(bad))).toBeNull();
  });
```

- [ ] **Step 4: Run test + build**

Run: `npm test` → PASS. `npm run build` → clean. This is the end of the engine work — confirm the whole suite is green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/save.ts src/engine/index.ts src/engine/__tests__/save.test.ts
git commit -m "feat(engine): v2 save sniff + export studio/team helpers"
```

---

### Task 11: UI — studio level chip, Reports nav + screen, report history modal

**Files:**
- Modify: `src/ui/components/TopBar.tsx`, `src/ui/components/Sidebar.tsx`, `src/ui/App.tsx`, `src/ui/components/WeeklyReportModal.tsx`
- Create: `src/ui/screens/ReportsScreen.tsx`

UI tasks have no unit tests; verify with `npm run build` + the preview. Components stay thin.

- [ ] **Step 1: Add the studio-level chip — replace `src/ui/components/TopBar.tsx`**

```tsx
// src/ui/components/TopBar.tsx
import { useGame } from '../store';
import { cwLabel } from '../../engine';
import { fmtMoney } from '../format';

export function TopBar({ onEndWeek }: { onEndWeek: () => void }) {
  const s = useGame();
  return (
    <header className="topbar">
      <div className="logo">
        🚀 Full Rollout <span>ship or sink</span>
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

- [ ] **Step 2: Add the Reports nav — replace the nav block in `src/ui/components/Sidebar.tsx`**

Change the `Screen` import usage by adding the Reports nav line. Replace the Studio nav group:
```tsx
      <div className="nav-head">Studio</div>
      {nav('board', '📋 Board')}
      {nav('releases', '📦 Releases')}
      {nav('inbox', '📨 Inbox', pending)}
      {nav('team', '👥 Team')}
      {nav('market', '🛒 Market')}
      {nav('reports', '📜 Reports')}
```
(only the `{nav('reports', …)}` line is new.)

- [ ] **Step 3: Wire the screen — edit `src/ui/App.tsx`**

Add the import after the other screen imports:
```tsx
import { ReportsScreen } from './screens/ReportsScreen';
```
Extend the `Screen` type:
```tsx
export type Screen = 'board' | 'releases' | 'team' | 'market' | 'inbox' | 'reports';
```
Add the render line after the inbox line in `<main>`:
```tsx
          {screen === 'reports' && <ReportsScreen />}
```

- [ ] **Step 4: Let the report modal show any report — replace `src/ui/components/WeeklyReportModal.tsx`**

```tsx
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
```
(App's existing `<WeeklyReportModal onClose=… />` call still works — `report` is optional and defaults to `lastReport`.)

- [ ] **Step 5: Create `src/ui/screens/ReportsScreen.tsx`**

```tsx
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
```

- [ ] **Step 6: Verify + commit**

Run: `npm run build` → clean. Start the preview, confirm the 🏢 Lv chip shows and the 📜 Reports screen lists nothing yet (empty state).
```bash
git add src/ui/components/TopBar.tsx src/ui/components/Sidebar.tsx src/ui/App.tsx src/ui/components/WeeklyReportModal.tsx src/ui/screens/ReportsScreen.tsx
git commit -m "feat(ui): studio level chip, Reports screen + history modal"
```

---

### Task 12: UI — Studio upgrade panel on the Market screen

**Files:**
- Modify: `src/ui/screens/MarketScreen.tsx`

- [ ] **Step 1: Replace `src/ui/screens/MarketScreen.tsx`**

```tsx
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
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` → clean. Preview: the Studio panel shows level, games used/cap, and an Upgrade button (disabled if cash short); buying/starting disables at the cap with a tooltip.
```bash
git add src/ui/screens/MarketScreen.tsx
git commit -m "feat(ui): studio upgrade panel + game-cap-aware buy/start buttons"
```

---

### Task 13: UI — Inbox grouped into categories with the tech-debt section + lock badges

**Files:**
- Modify: `src/ui/screens/InboxScreen.tsx`

- [ ] **Step 1: Replace `src/ui/screens/InboxScreen.tsx`**

```tsx
// src/ui/screens/InboxScreen.tsx
import { useDispatch, useGame } from '../store';
import { cwLabel } from '../../engine';
import { signedPct } from '../format';
import type { InboxItem } from '../../engine';

const KIND_EMOJI: Record<InboxItem['kind'], string> = {
  feature: '💡', bug: '🐞', opportunity: '🌟', techdebt: '🛠️',
};

const SECTIONS: { kind: InboxItem['kind']; title: string }[] = [
  { kind: 'feature', title: '💡 Feature requests' },
  { kind: 'bug', title: '🐞 Bug reports' },
  { kind: 'techdebt', title: '🛠️ Tech debt' },
  { kind: 'opportunity', title: '🌟 Opportunities' },
];

export function InboxScreen() {
  const s = useGame();
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending');
  const tracked = s.inbox.filter((i) => i.kind === 'opportunity' && i.status === 'accepted');
  const resolved = s.inbox.filter((i) => i.status !== 'pending').slice(-6).reverse();

  const renderItem = (i: InboxItem) => {
    const locked = !!(i.requiredLevel && s.studioLevel < i.requiredLevel);
    const mandatory = i.kind === 'techdebt' && i.techSubtype === 'mandatory';
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
        {i.kind === 'techdebt' && i.techSubtype === 'investment' && (
          <p>🔧 Ships → +{i.benefitRevenuePct}% revenue on every game</p>
        )}
        {i.deadlineWeek != null && <p>⏰ Deadline: {cwLabel(i.deadlineWeek)}</p>}
        <div className="row">
          <button
            className="btn green"
            disabled={locked}
            title={locked ? `Requires Studio Level ${i.requiredLevel}` : ''}
            onClick={() => d.act({ type: 'acceptInbox', itemId: i.id })}
          >
            Accept
          </button>
          {mandatory ? (
            <span className="sub">mandatory — declining means a fine at the deadline</span>
          ) : (
            <button className="btn" onClick={() => d.act({ type: 'declineInbox', itemId: i.id })}>
              Decline
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="screen">
      <h2>Inbox</h2>
      {pending.length === 0 && <p className="sub">All clear. End the week to see what comes in.</p>}
      {SECTIONS.map(({ kind, title }) => {
        const items = pending.filter((i) => i.kind === kind);
        if (items.length === 0) return null;
        return (
          <div key={kind}>
            <div className="nav-head" style={{ paddingLeft: 0 }}>{title}</div>
            {items.map(renderItem)}
          </div>
        );
      })}
      {tracked.length > 0 && (
        <div className="panel">
          <h3>Tracked goals</h3>
          {tracked.map((i) => (
            <p key={i.id} className="sub">🌟 {i.title} — full rollout by {cwLabel(i.deadlineWeek!)}</p>
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

Run: `npm run build` → clean. Preview: inbox shows grouped sections; a tech-debt item appears under 🛠️ Tech debt with its benefit/deadline line; locked feature/tech-debt items show 🔒 and a disabled Accept.
```bash
git add src/ui/screens/InboxScreen.tsx
git commit -m "feat(ui): grouped inbox sections, tech-debt category, studio-level lock badges"
```

---

### Task 14: UI — tech-debt on the board (card gist + ? popover, modal block, styles)

**Files:**
- Modify: `src/ui/components/TicketCard.tsx`, `src/ui/components/TicketModal.tsx`, `src/ui/theme.css`

- [ ] **Step 1: Replace `src/ui/components/TicketCard.tsx`**

```tsx
// src/ui/components/TicketCard.tsx
import { useState } from 'react';
import { useGame } from '../store';
import { cwLabel } from '../../engine';
import { initials } from '../format';
import type { Ticket } from '../../engine';

const TYPE_META: Record<Ticket['type'], { cls: string; letter: string }> = {
  Story: { cls: 'story', letter: 'S' },
  Bug: { cls: 'bug', letter: 'B' },
  'Release Ticket': { cls: 'release', letter: 'R' },
  Task: { cls: 'task', letter: 'T' },
  'Tech Debt': { cls: 'techdebt', letter: 'D' },
};

export function TicketCard({ t, onOpen }: { t: Ticket; onOpen: (k: string) => void }) {
  const s = useGame();
  const [info, setInfo] = useState(false);
  const assignee = t.assigneeId ? s.team.find((m) => m.id === t.assigneeId) : null;
  const meta = TYPE_META[t.type];
  const lockedInRelease = s.releases.some(
    (r) => r.status !== 'decided' && r.ticketKeys.includes(t.key),
  );
  const devProgress =
    t.status === 'IN_DEVELOPMENT' && t.pointsWorked > 0
      ? Math.round(((t.phaseEffort - t.effort) / t.phaseEffort) * 100)
      : null;
  const isTech = t.type === 'Tech Debt';
  const techGist = !isTech ? null
    : t.techSubtype === 'investment'
      ? `🔧 +${t.benefitRevenuePct}% rev (all games)`
      : '⏰ compliance — fine if late';
  const successText = t.techSubtype === 'investment'
    ? `+${t.benefitRevenuePct}% revenue on every game you own`
    : 'clears the compliance deadline (no fine)';

  return (
    <div className="card" onClick={() => onOpen(t.key)}>
      <div className="title">{t.title}</div>
      <div className="meta">
        <span className={`type-icon ${meta.cls}`}>{meta.letter}</span>
        <span className="key">{t.key}</span>
        {t.deadlineWeek !== null && <span className="chip warn">⏰ {cwLabel(t.deadlineWeek)}</span>}
        {lockedInRelease && t.status === 'QA_COMPLETE' && <span className="chip locked">📦 in release</span>}
        <span className="right">
          {isTech && (
            <button
              className="q-badge"
              title="What happens on success / failure"
              onClick={(e) => { e.stopPropagation(); setInfo((v) => !v); }}
            >
              ?
            </button>
          )}
          {assignee && <span className="avatar" title={assignee.name}>{initials(assignee.name)}</span>}
        </span>
      </div>
      {techGist && <div className="chip" style={{ marginTop: 6 }}>{techGist}</div>}
      {devProgress !== null && (
        <div className="progress"><div style={{ width: `${devProgress}%` }} /></div>
      )}
      {isTech && info && (
        <div className="popover" onClick={(e) => e.stopPropagation()}>
          <p><strong>If it ships:</strong> {successText}</p>
          <p><strong>If it fails:</strong> bounces back for rework + $500. Lower-skill devs hit technical errors more often.</p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Tech-debt block + studio-wide name in `src/ui/components/TicketModal.tsx`**

Change the game-name reference in the sub line from `{game?.name}` to `{game?.name ?? 'Studio'}`.

After the effort/qa block (after the `{devPhase ? (…) : qaPhase ? (…) : null}` expression and before the `{assignable && (…)}` select), add:
```tsx
        {t.type === 'Tech Debt' && (
          <div className="panel" style={{ margin: '10px 0', padding: 12 }}>
            <p style={{ margin: '0 0 6px' }}>
              <strong>If it ships:</strong>{' '}
              {t.techSubtype === 'investment'
                ? `+${t.benefitRevenuePct}% revenue on every game you own`
                : 'clears the compliance deadline (no fine)'}
            </p>
            <p style={{ margin: 0 }}>
              <strong>If it fails:</strong> bounces back for rework + $500. Lower-skill devs hit technical errors more often.
            </p>
          </div>
        )}
```

- [ ] **Step 3: Add styles — append to `src/ui/theme.css`**

```css
/* v2: tech-debt ticket type + ? popover */
.type-icon.techdebt { background: #8777d9; }
.card { position: relative; }
.q-badge {
  width: 18px; height: 18px; border-radius: 50%; border: 1px solid var(--line);
  background: #fff; color: var(--sub); font-size: 11px; font-weight: 700;
  line-height: 1; display: inline-flex; align-items: center; justify-content: center;
  margin-right: 4px; padding: 0;
}
.q-badge:hover { background: var(--col); color: var(--text); }
.popover {
  position: absolute; top: 100%; right: 0; z-index: 5; width: 240px;
  background: #fff; border: 1px solid var(--line); border-radius: 5px;
  box-shadow: 0 6px 20px rgba(9, 30, 66, 0.3); padding: 10px 12px; margin-top: 4px;
  font-size: 12.5px; line-height: 1.5; cursor: default;
}
.popover p { margin: 0 0 6px; }
.popover p:last-child { margin: 0; }
```

- [ ] **Step 4: Verify + commit**

Run: `npm run build` → clean. Preview: accept a tech-debt item, find its 🛠️/**D** card under All games; the gist chip shows; clicking **?** opens the popover (and does NOT open the modal); opening the card shows the success/fail block and "Studio" as the component.
```bash
git add src/ui/components/TicketCard.tsx src/ui/components/TicketModal.tsx src/ui/theme.css
git commit -m "feat(ui): tech-debt card gist + ? popover, modal success/fail block, styles"
```

---

### Task 15: UI — employee info on roster + hire panel

**Files:**
- Modify: `src/ui/screens/TeamScreen.tsx`

- [ ] **Step 1: Replace `src/ui/screens/TeamScreen.tsx`**

```tsx
// src/ui/screens/TeamScreen.tsx
import { useDispatch, useGame } from '../store';
import { memberStats } from '../../engine';
import { fmtMoney } from '../format';

export function TeamScreen() {
  const s = useGame();
  const d = useDispatch();
  return (
    <div className="screen">
      <h2>Team</h2>
      <div className="panel">
        <h3>Roster</h3>
        <table className="table">
          <thead>
            <tr><th>Name</th><th>Role</th><th>Skill</th><th>Stats</th><th className="num">Salary/wk</th><th>Working on</th></tr>
          </thead>
          <tbody>
            {s.team.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.role}</td>
                <td>{'⭐'.repeat(m.skill)}</td>
                <td className="sub">{memberStats(m.role, m.skill).join(' · ')}</td>
                <td className="num">{fmtMoney(m.salary)}</td>
                <td>{m.ticketKey ?? <span className="sub">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Candidates</h3>
        <p className="sub">Fresh faces every week. Signing fee = 2 weeks of salary.</p>
        {s.market.candidates.map((c) => (
          <div className="row" key={c.id} style={{ padding: '8px 0', alignItems: 'flex-start' }}>
            <div>
              <div><strong>{c.name}</strong> <span className="pill">{c.role}</span> {'⭐'.repeat(c.skill)}</div>
              <div className="sub">{memberStats(c.role, c.skill).join(' · ')} · {fmtMoney(c.salary)}/wk</div>
            </div>
            <span className="right">
              <button
                className="btn blue"
                disabled={s.cash < c.signingFee || s.status !== 'playing'}
                onClick={() => d.act({ type: 'hire', candidateId: c.id })}
              >
                Hire ({fmtMoney(c.signingFee)})
              </button>
            </span>
          </div>
        ))}
        {s.market.candidates.length === 0 && <p className="sub">Nobody this week.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run build` → clean. Preview: every roster row and candidate shows the derived stat line (build/test speed, bug-proneness or catch rate, RM releases/week).
```bash
git add src/ui/screens/TeamScreen.tsx
git commit -m "feat(ui): employee info (speed / catch rate / releases-per-week) on roster + hire panel"
```

---

### Task 16: Final integration, preview verification, deploy

**Files:** none (verification + deploy)

- [ ] **Step 1: Full suite + build**

Run: `npm test` → all green. Run: `npm run build` → clean.

- [ ] **Step 2: Preview a full v2 loop** (use the preview tools, not Bash)

Start the dev server (`.claude/launch.json` has `full-rollout-dev` on port 5173 — free the port first if a stale server holds it). In the preview, clearing `localStorage` once (old v1 saves are rejected by the v2 schema → fresh game). Verify end-to-end:
- 🏢 Lv 1 chip in the top bar; Market → Studio panel shows Games 2/4 and an Upgrade (L2 $4,000) button; clicking it raises the level instantly and deducts cash.
- Accept a 🛠️ tech-debt item (under its own inbox section), assign a developer, End Week until it resolves → either `🔧 shipped` (investment: a game's revenue ticks up) or `⚠️ technical error` (bounces to TODO); both appear in the weekly report.
- The tech-debt card shows its gist chip and the **?** popover.
- Hire panel + roster show employee stat lines.
- Cut releases on 2+ games in one week with a skill-3 RM (capacity 3).
- 📜 Reports lists past weeks; clicking one re-opens it.
- `preview_console_logs` level=error → no errors.

Fix any issue in source, re-run from Step 1.

- [ ] **Step 3: Final whole-branch review (dispatch a code-reviewer subagent)**

Review `git diff main...HEAD` against the spec: schema-v2 integrity (no `Math.random`/`Date` in engine; save roundtrip incl. studioLevel/reportHistory), hidden-info rule (no exact fail chance / hiddenBugs / qaEffort rendered), studio gate + games cap coherence, tech-debt resolution correctness, RM capacity, report history cap. Fix any Critical/Important findings.

- [ ] **Step 4: Merge to main**

```bash
git checkout main
git merge --no-ff feature/v2-features -m "Merge feature/v2-features: studio level, tech debt, RM capacity, employee info, report history"
npm test   # confirm green on main
git branch -d feature/v2-features
git push origin main
```

- [ ] **Step 5: Deploy to the same URL** (gh-pages branch; npx gh-pages has a cache-permission issue on this machine — use the plain-git push that worked before)

```bash
npm run build
cd dist && git init -q -b gh-pages && git add -A && git commit -q -m "deploy v2" \
  && git push -f -q https://github.com/BerkUnalDev/full-rollout.git gh-pages:gh-pages
cd .. && rm -rf dist/.git
```
Then poll until the new bundle is live (compare the hashed JS filename in `dist/assets` to the served HTML):
```bash
for i in $(seq 1 8); do sleep 15; \
  live=$(curl -s "https://berkunaldev.github.io/full-rollout/?cb=$i" | grep -o 'assets/index-[^"]*\.js' | head -1); \
  local=$(ls dist/assets | grep '\.js$'); \
  [ "assets/$local" = "$live" ] && { echo "LIVE: $live"; break; } || echo "attempt $i: live=$live local=$local"; done
```
Expected: `LIVE: …` once GitHub Pages serves the new build. Deliverable: the same URL, now on v2.

---

## Plan self-review notes (applied)

- **Spec coverage:** §1 studio level → T1-3 (+UI T11-12); §2 tech debt → T1,4,5,6 (+UI T13,14); §3 RM capacity → T7; §4 employee info → T8 (+UI T15); §5 report detail+history → T5,9 (+UI T11,16); §6 tech-debt info UI → T14; §7 schema/types → T1,10; §8 testing → throughout.
- **Type consistency:** `TechSubtype`, `studioLevel`, `reportHistory`, `requiredLevel`, `techSubtype`, `benefitRevenuePct`, `upgradeStudio`, `maxGamesFor`, `nextUpgradeCost`, `rollRequiredLevel`, `memberStats` are defined in T1/T2/T8 and used verbatim everywhere after. `'sdk'`→`'techdebt'` rename is completed across types (T1), generation/accept (T4), weekly/deadlines (T6), and UI (T13) — no stale `'sdk'` remains.
- **Coupling note:** T1 and T4 share the `'sdk'`→`'techdebt'` rename; if T1's tree is red, proceed to T4 before committing (called out in T1).
- **No placeholders:** every step carries the actual code or exact edit.
