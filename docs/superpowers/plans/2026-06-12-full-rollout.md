# Full Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy "Full Rollout" — a single-player, turn-based studio-tycoon web game that mirrors the GIM Jira Kanban board (spec: `docs/superpowers/specs/2026-06-12-full-rollout-design.md`).

**Architecture:** Pure-function TypeScript game engine (`src/engine/`, seeded RNG carried in state, no DOM/Date/Math.random) developed with TDD via vitest; thin React UI (`src/ui/`) reading state and dispatching actions through a useReducer store with localStorage autosave. Static Vite build deployed to GitHub Pages for a shareable link.

**Tech Stack:** Vite 5, React 18, TypeScript, vitest. No other runtime dependencies.

---

## File structure

```
package.json, tsconfig.json, vite.config.ts, index.html
src/
├── main.tsx                 — React bootstrap
├── ui/
│   ├── App.tsx              — layout, screen switching, modals
│   ├── store.tsx            — context + useReducer wrapping engine, autosave
│   ├── format.ts            — money/players/stars formatting
│   ├── theme.css            — Jira-look styling (all CSS lives here)
│   ├── components/
│   │   ├── TopBar.tsx       — cash, CW, End Week button
│   │   ├── Sidebar.tsx      — game filters + screen nav + inbox badge
│   │   ├── Board.tsx        — 6 Kanban columns
│   │   ├── TicketCard.tsx   — Jira-style card
│   │   ├── TicketModal.tsx  — detail + assign dropdown
│   │   ├── WeeklyReportModal.tsx
│   │   ├── HowToPlayModal.tsx
│   │   └── GameOverScreen.tsx
│   └── screens/
│       ├── ReleasesScreen.tsx — report cards, rollout buttons, history
│       ├── TeamScreen.tsx     — roster + hiring
│       ├── MarketScreen.tsx   — game offers + start new game
│       └── InboxScreen.tsx    — accept/decline events
└── engine/
    ├── types.ts             — all shared types
    ├── constants.ts         — every balance number (tunable)
    ├── rng.ts               — seeded mulberry32 Rng class
    ├── week.ts              — weekIndex ↔ CW label helpers
    ├── data.ts              — word banks, templates, genre-fit table
    ├── names.ts             — game/person name generators
    ├── newGame.ts           — initial state factory
    ├── actions.ts           — applyAction (plan-phase reducer)
    ├── work.ts              — dev + QA resolution phases
    ├── quality.ts           — release quality + report card math
    ├── releases.ts          — cut/ship/report-arrival/rollout/pull-back
    ├── economy.ts           — revenue, decay, payroll, company value
    ├── generators.ts        — candidates, offers, market refresh
    ├── inbox.ts             — weekly events, accept/decline, deadlines
    ├── endWeek.ts           — resolution pipeline + weekly report
    ├── save.ts              — serialize/deserialize with schema guard
    ├── index.ts             — public API re-exports
    └── __tests__/           — vitest suites (one per module above)
```

**Engine conventions (read first, they apply to every task):**
- Engine functions never mutate their input: first line is `const s = structuredClone(state)`, mutate `s`, return it.
- All randomness flows through `Rng` seeded from `s.rngState`; write `rng.state` back before returning. Never `Math.random()`/`Date`.
- `weekIndex` is the absolute 0-based week counter (0 = CW 24/2026). UI never sees it raw — always via `cwLabel()`.
- Invalid player actions `throw new Error('reason')`; the UI disables those buttons, tests assert the throws.
- Tests assert determinism (same seed ⇒ identical result) and properties/ranges — never exact values of noisy rolls.

---

### Task 1: Scaffold the project

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/ui/theme.css`, `.gitignore`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "full-rollout",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.6.3",
    "vite": "^5.4.11",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src"]
}
```

Note: `"noEmit": true` means `tsc -b` acts as a type check only; vite does the bundling. If `tsc -b` complains about composite settings, replace the build script with `"build": "tsc --noEmit && vite build"`.

- [ ] **Step 3: Create `vite.config.ts`**

```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base is set for GitHub Pages project-site hosting; harmless under vite dev.
export default defineConfig({
  plugins: [react()],
  base: '/full-rollout/',
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Full Rollout — ship or sink</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/main.tsx`**

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './ui/App';
import './ui/theme.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 6: Create placeholder `src/ui/App.tsx`** (replaced in Task 16)

```tsx
export function App() {
  return <div style={{ padding: 24 }}>Full Rollout — under construction</div>;
}
```

- [ ] **Step 7: Create empty `src/ui/theme.css`** (filled in Task 16)

```css
/* Jira-look theme — populated in the UI shell task */
```

- [ ] **Step 8: Create `.gitignore`**

```
node_modules
dist
*.local
.DS_Store
```

- [ ] **Step 9: Install and verify**

Run: `npm install` (in `/Users/berk/Huam`)
Expected: completes without errors, `package-lock.json` created.

Run: `npm run build`
Expected: `vite build` succeeds, `dist/` created.

Run: `npm test`
Expected: vitest exits 0 or reports "No test files found" — both fine at this stage (if it exits non-zero for no tests, add `--passWithNoTests` to the test script).

- [ ] **Step 10: Commit**

```bash
git add -A && git commit -m "chore: scaffold Vite + React + TS + vitest project"
```

---

### Task 2: Seeded RNG

**Files:**
- Create: `src/engine/rng.ts`
- Test: `src/engine/__tests__/rng.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/rng.test.ts
import { Rng } from '../rng';

describe('Rng', () => {
  it('is deterministic for the same seed', () => {
    const a = new Rng(42), b = new Rng(42);
    const seqA = [a.next(), a.next(), a.next()];
    const seqB = [b.next(), b.next(), b.next()];
    expect(seqA).toEqual(seqB);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng(1), b = new Rng(2);
    expect([a.next(), a.next()]).not.toEqual([b.next(), b.next()]);
  });

  it('next() stays in [0, 1)', () => {
    const r = new Rng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int(min, max) is inclusive on both ends and covers the range', () => {
    const r = new Rng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(r.int(1, 3));
    expect([...seen].sort()).toEqual([1, 2, 3]);
  });

  it('pick returns elements of the array', () => {
    const r = new Rng(5);
    const arr = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 50; i++) expect(arr).toContain(r.pick(arr));
  });

  it('chance(0) is never true, chance(1) always true', () => {
    const r = new Rng(9);
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });

  it('count(expected) returns floor or floor+1, averaging near expected', () => {
    const r = new Rng(11);
    let sum = 0;
    for (let i = 0; i < 2000; i++) {
      const c = r.count(0.3);
      expect([0, 1]).toContain(c);
      sum += c;
    }
    expect(sum / 2000).toBeGreaterThan(0.2);
    expect(sum / 2000).toBeLessThan(0.4);
  });

  it('state can be saved and resumed mid-sequence', () => {
    const a = new Rng(42);
    a.next(); a.next();
    const resumed = new Rng(a.state);
    const cont = new Rng(42);
    cont.next(); cont.next();
    expect(resumed.next()).toBe(cont.next());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../rng'` (or similar resolution error).

- [ ] **Step 3: Write the implementation**

```ts
// src/engine/rng.ts
// mulberry32 PRNG. The entire generator state is one 32-bit int, so it can
// live inside GameState and make every resolution reproducible.
export class Rng {
  constructor(public state: number) {}

  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  /** Sample a count with the given expected value (floor + fractional chance). */
  count(expected: number): number {
    const base = Math.floor(expected);
    return base + (this.chance(expected - base) ? 1 : 0);
  }

  /** Symmetric noise in [-amp, +amp). */
  noise(amp: number): number {
    return (this.next() * 2 - 1) * amp;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all rng tests green.

- [ ] **Step 5: Commit**

```bash
git add src/engine/rng.ts src/engine/__tests__/rng.test.ts
git commit -m "feat(engine): seeded mulberry32 Rng"
```

---

### Task 3: Types, constants, week helpers, data banks, name generators

**Files:**
- Create: `src/engine/types.ts`, `src/engine/constants.ts`, `src/engine/week.ts`, `src/engine/data.ts`, `src/engine/names.ts`
- Test: `src/engine/__tests__/week.test.ts`, `src/engine/__tests__/names.test.ts`

- [ ] **Step 1: Create `src/engine/types.ts`** (no test — verified by the compiler; every later task imports from here, so names below are canonical)

```ts
// src/engine/types.ts
export type Role = 'Developer' | 'QA' | 'Release Manager';
export type TicketType = 'Story' | 'Bug' | 'Release Ticket' | 'Task';
export type TicketStatus =
  | 'TODO'
  | 'IN_DEVELOPMENT'
  | 'AWAITING_QA'
  | 'IN_QA'
  | 'QA_COMPLETE'
  | 'DONE';
export type Genre = 'Puzzle' | 'Merge' | 'Word' | 'Arcade' | 'Card' | 'Simulation';
export type FeatureTag = 'levels' | 'social' | 'monetization' | 'meta' | 'polish' | 'events';
export type Happiness = 'loved' | 'liked' | 'meh' | 'hated';

export interface Impact {
  revenuePct: number; // ± % applied to revenuePerPlayer on full rollout
  ratingBonus: number; // ± stars contribution
}

export interface TeamMember {
  id: string;
  name: string;
  role: Role;
  skill: number; // 1-5
  salary: number; // $ per week
  ticketKey: string | null; // current assignment (Developer/QA only)
}

export interface HireCandidate {
  id: string;
  name: string;
  role: Role;
  skill: number;
  salary: number;
  signingFee: number;
}

export interface Ticket {
  key: string; // "GIM-1"
  type: TicketType;
  gameId: string;
  title: string;
  status: TicketStatus;
  assigneeId: string | null;
  effortTotal: number; // original dev effort
  effort: number; // remaining dev effort in current dev phase
  phaseEffort: number; // dev effort this phase started with (orig or rework)
  pointsWorked: number; // total dev points ever applied
  devSkillSum: number; // Σ (points × dev skill) — for release quality
  qaEffort: number; // remaining QA effort (set when pulled into IN_QA)
  hiddenBugs: number;
  tags: FeatureTag[]; // stories only, else []
  predictedImpact: Impact; // what the UI shows (stories; zeros otherwise)
  impact: Impact; // hidden actual (stories; zeros otherwise)
  deadlineWeek: number | null; // absolute weekIndex (SDK tasks)
  createdWeek: number; // absolute weekIndex
  releaseVersion: string | null; // Release Tickets only
}

export interface PortfolioGame {
  id: string;
  name: string;
  genre: Genre;
  players: number;
  rating: number; // 1.0 - 5.0
  revenuePerPlayer: number; // $ per player per week
  version: string; // live version, e.g. "1.6.0"
  lastRolloutWeek: number; // absolute weekIndex of last full rollout (may be negative)
  pendingImpact: Impact; // impact returned by pull-backs, re-carried by next cut
  declinedBugs: number; // escalation counter for ignored bug reports
}

export interface ReportCard {
  happiness: Happiness;
  bugReports: number;
  revenueImpactPct: number; // shown and applied on full rollout
  ratingDelta: number; // shown and applied on full rollout
}

export interface Release {
  id: string;
  gameId: string;
  version: string;
  cwLabel: string; // frozen at cut time, e.g. "CW 26/2026"
  ticketKeys: string[];
  quality: number; // hidden 0-100
  missedBugs: number; // hidden
  impact: Impact; // summed story impact incl. game.pendingImpact at cut
  status: 'cutting' | 'soft' | 'decided';
  shippedWeek: number | null; // weekIndex when soft launch went out
  reportCard: ReportCard | null;
  decision: 'full' | 'pulled' | null;
}

export type InboxItemKind = 'feature' | 'bug' | 'opportunity' | 'sdk';
export type InboxStatus = 'pending' | 'accepted' | 'declined' | 'done';

export interface InboxItem {
  id: string;
  kind: InboxItemKind;
  gameId: string;
  title: string;
  body: string;
  weekCreated: number;
  status: InboxStatus;
  // feature fields
  predictedImpact?: Impact;
  actualImpact?: Impact;
  tags?: FeatureTag[];
  effort?: number;
  // opportunity fields
  deadlineWeek?: number;
  rewardPlayersPct?: number; // e.g. 0.25 = +25% players
  // sdk fields
  fineUsd?: number;
}

export interface GameOffer {
  id: string;
  name: string;
  genre: Genre;
  players: number;
  rating: number;
  revenuePerPlayer: number;
  price: number;
}

export interface CashDelta {
  label: string;
  amount: number; // positive = income
}

export interface WeeklyReport {
  cwLabel: string; // the week that just resolved
  cashStart: number;
  cashEnd: number;
  deltas: CashDelta[];
  events: string[];
  arrivedReleaseIds: string[];
}

export interface GameState {
  schemaVersion: number;
  seed: number;
  rngState: number;
  weekIndex: number; // 0 = CW 24/2026
  cash: number;
  status: 'playing' | 'bankrupt';
  team: TeamMember[];
  games: PortfolioGame[];
  tickets: Ticket[];
  releases: Release[];
  inbox: InboxItem[];
  market: { candidates: HireCandidate[]; offers: GameOffer[] };
  nextTicketNum: number;
  nextId: number;
  usedNames: string[];
  pendingDeltas: CashDelta[]; // plan-phase cash moves, flushed into the weekly report
  pendingEvents: string[]; // plan-phase event lines, flushed into the weekly report
  lastReport: WeeklyReport | null;
  log: string[]; // run highlights for the game-over screen
}

export type PlanAction =
  | { type: 'assign'; ticketKey: string; memberId: string }
  | { type: 'unassign'; ticketKey: string }
  | { type: 'acceptInbox'; itemId: string }
  | { type: 'declineInbox'; itemId: string }
  | { type: 'hire'; candidateId: string }
  | { type: 'buyGame'; offerId: string }
  | { type: 'startNewGame'; genre: Genre }
  | { type: 'cutRelease'; gameId: string }
  | { type: 'fullRollout'; releaseId: string }
  | { type: 'pullBack'; releaseId: string };
```

- [ ] **Step 2: Create `src/engine/constants.ts`**

```ts
// src/engine/constants.ts
// Every balance number lives here. All "initial balance" — tune freely in playtesting.
import type { FeatureTag, Genre, Role } from './types';

export const SCHEMA_VERSION = 1;
export const DEFAULT_SEED = 20260612;

// Calendar: weekIndex 0 = CW 24/2026.
export const START_CW = 24;
export const START_YEAR = 2026;
export const WEEKS_PER_YEAR = 52;

// Economy
export const STARTING_CASH = 50_000;
export const PLAYER_VALUE = 0.35; // $ per player when computing company value
export const SIGNING_FEE_WEEKS = 2;
export const NEW_GAME_COST = 3_000;
export const NEW_GAME_STORIES = 3;
export const OFFER_PRICE_WEEKS = 25;
export const OFFER_PRICE_NOISE = 0.3;

// Work
export const STORY_EFFORT: readonly [number, number] = [4, 8];
export const BUG_EFFORT: readonly [number, number] = [2, 4];
export const TASK_EFFORT: readonly [number, number] = [3, 5];
export const REWORK_FRACTION = 0.4;
export const QA_EFFORT_FRACTION = 0.5;
export const BUG_RATE_PER_POINT = 0.04; // expected bugs = phaseEffort × (6 − skill) × this
export const QA_CATCH_BASE = 0.5;
export const QA_CATCH_PER_SKILL = 0.09;
/** Work speed (points/week) for both devs and QA. */
export const speedOf = (skill: number) => skill + 1;

// Quality & report card
export const QUALITY_BASE = 55;
export const QUALITY_PER_SKILL = 6; // × avg dev skill (1-5)
export const QUALITY_PER_MISSED_BUG = -12;
export const QUALITY_NOISE = 5;
export const GENRE_FIT_CAP = 10;
export const HAPPINESS_LOVED = 75;
export const HAPPINESS_LIKED = 60;
export const HAPPINESS_MEH = 45;
export const REVENUE_IMPACT_CAP: readonly [number, number] = [-20, 40];
export const RATING_DELTA_CAP = 0.6;
export const GROWTH_DIVISOR = 200; // players ×= 1 + (quality − 55) / this

// Decay
export const DECAY_GRACE_WEEKS = 6;
export const DECAY_PER_STALE_WEEK = 0.02; // players lost per week beyond grace
export const DECAY_MAX_STALE_WEEKS = 8; // cap the multiplier
export const RATING_DECAY_STALE = 0.03;

// Team
export const SALARY_BY_SKILL: Record<Role, readonly number[]> = {
  Developer: [800, 1100, 1500, 2000, 2600],
  QA: [700, 950, 1200, 1600, 2100],
  'Release Manager': [800, 1000, 1300, 1700, 2200],
};

// Inbox
export const INBOX_PER_WEEK: readonly [number, number] = [1, 3];
export const SDK_FINE = 4_000;
export const SDK_DEADLINE_WEEKS = 3;
export const FEATURING_REWARD_PCT = 0.25;
export const FEATURING_DEADLINE_WEEKS: readonly [number, number] = [3, 5];
export const DECLINED_BUG_RATING_HIT = 0.08; // × (declinedBugs so far + 1)

// Market
export const CANDIDATES_PER_WEEK: readonly [number, number] = [2, 3];
export const OFFERS_PER_WEEK: readonly [number, number] = [1, 2];

// Genre ↔ feature-tag fit: +3 per story with a good tag, −5 per story with a bad tag.
export const GENRE_FIT_GOOD = 3;
export const GENRE_FIT_BAD = -5;
export const GENRE_FIT: Record<Genre, { good: FeatureTag[]; bad: FeatureTag[] }> = {
  Puzzle: { good: ['levels', 'events'], bad: ['monetization'] },
  Merge: { good: ['meta', 'events'], bad: ['social'] },
  Word: { good: ['levels', 'social'], bad: ['meta'] },
  Arcade: { good: ['polish', 'events'], bad: ['meta'] },
  Card: { good: ['social', 'monetization'], bad: ['levels'] },
  Simulation: { good: ['meta', 'monetization'], bad: ['polish'] },
};

export const GENRES: readonly Genre[] = ['Puzzle', 'Merge', 'Word', 'Arcade', 'Card', 'Simulation'];
```

- [ ] **Step 3: Write the failing week-helper test**

```ts
// src/engine/__tests__/week.test.ts
import { weekToCW, cwLabel } from '../week';

describe('week helpers', () => {
  it('weekIndex 0 is CW 24/2026', () => {
    expect(weekToCW(0)).toEqual({ week: 24, year: 2026 });
  });

  it('rolls over the year after CW 52', () => {
    expect(weekToCW(28)).toEqual({ week: 52, year: 2026 });
    expect(weekToCW(29)).toEqual({ week: 1, year: 2027 });
    expect(weekToCW(29 + 52)).toEqual({ week: 1, year: 2028 });
  });

  it('formats labels', () => {
    expect(cwLabel(0)).toBe('CW 24/2026');
    expect(cwLabel(29)).toBe('CW 1/2027');
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../week'`.

- [ ] **Step 5: Create `src/engine/week.ts`**

```ts
// src/engine/week.ts
import { START_CW, START_YEAR, WEEKS_PER_YEAR } from './constants';

export function weekToCW(weekIndex: number): { week: number; year: number } {
  const total = START_CW + weekIndex; // 1-based CW within the start year
  const yearOffset = Math.floor((total - 1) / WEEKS_PER_YEAR);
  const week = ((total - 1) % WEEKS_PER_YEAR) + 1;
  return { week, year: START_YEAR + yearOffset };
}

export function cwLabel(weekIndex: number): string {
  const { week, year } = weekToCW(weekIndex);
  return `CW ${week}/${year}`;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS — week tests green.

- [ ] **Step 7: Create `src/engine/data.ts`** (pure data, no test)

```ts
// src/engine/data.ts
import type { FeatureTag } from './types';

// Word banks produce GIM-style two-word names. REAL_GIM_NAMES is an exclusion
// list so no real game name is ever generated.
export const NAME_FIRST = [
  'Merge', 'Pixel', 'Bubble', 'Crystal', 'Cookie', 'Marble', 'Tile', 'Block',
  'Sushi', 'Candy', 'Hexa', 'Jelly', 'Magic', 'Lucky', 'Royal', 'Berry',
  'Disco', 'Turbo', 'Cozy', 'Mega',
] as const;

export const NAME_SECOND = [
  'Mania', 'Party', 'Quest', 'Rush', 'Saga', 'Sort', 'Drop', 'Dash', 'Pop',
  'Blast', 'Bounce', 'Builder', 'Kingdom', 'Garden', 'Heroes', 'Riddle',
  'Splash', 'Tales', 'Twist', 'Factory',
] as const;

export const REAL_GIM_NAMES = [
  'Merge Blast', 'Puzzle Pop Blaster', 'Aero Escape', 'Crystal Crush',
  'Brickdoku', 'Mayan Marble Madness', 'Slide & Roll', 'Mix Blox',
  'Water Sorter', 'Spiral Drop', 'Meal Dash', 'Treasure Master',
] as const;

export const PERSON_FIRST = [
  'Mara', 'Jonas', 'Ayla', 'Felix', 'Nadia', 'Oskar', 'Lena', 'Tomasz',
  'Iris', 'Deniz', 'Pavel', 'Sofia', 'Hugo', 'Emre', 'Greta', 'Milan',
  'Yuki', 'Carla', 'Anton', 'Selin', 'Ravi', 'Nora', 'Bruno', 'Petra',
] as const;

export const PERSON_LAST = [
  'Lindqvist', 'Weber', 'Kowalski', 'Rossi', 'Novak', 'Janssen', 'Fischer',
  'Olsen', 'Marchetti', 'Dubois', 'Keller', 'Brandt', 'Sørensen', 'Vargas',
  'Holm', 'Richter', 'Bauer', 'Costa', 'Lehmann', 'Petrov', 'Sato',
  'Andersen', 'Moreau', 'Schulz',
] as const;

export const STORY_TEMPLATES: Record<FeatureTag, readonly string[]> = {
  levels: ['Add 50 new levels', 'New level pack: Tropical', 'Hard mode level set'],
  social: ['Add team chests', 'Friend leaderboards', 'Co-op weekend mode'],
  monetization: ['Introduce starter bundle', 'Piggy bank offer', 'Remove-ads upsell revamp'],
  meta: ['Season pass meta layer', 'Collection album feature', 'Daily quest system'],
  polish: ['Rework win animations', 'New particle effects', 'Haptics & juice pass'],
  events: ['Halloween event', 'Summer beach event', 'Weekly tournament event'],
};

export const BUG_TITLES = [
  'Fix crash on level complete',
  'Fix progress loss after update',
  'Fix store not loading',
  'Fix daily reward double-claim',
  'Fix tutorial softlock',
  'Fix audio stutter on resume',
] as const;

export const SDK_TITLES = [
  'Mandatory SDK update 4.2',
  'Privacy SDK compliance update',
  'Ad mediation SDK upgrade',
] as const;

export const OPPORTUNITY_BODIES = [
  'The platform wants to feature {game}! Ship a full rollout by {deadline} and player numbers will spike.',
  'A creator collab is lined up for {game}. Get a fresh version fully rolled out by {deadline} to ride the wave.',
] as const;
```

- [ ] **Step 8: Write the failing names test**

```ts
// src/engine/__tests__/names.test.ts
import { Rng } from '../rng';
import { generateGameName, generatePersonName } from '../names';
import { REAL_GIM_NAMES } from '../data';

describe('name generators', () => {
  it('game names are two words from the banks and deterministic', () => {
    const a = generateGameName(new Rng(1), []);
    const b = generateGameName(new Rng(1), []);
    expect(a).toBe(b);
    expect(a.split(' ').length).toBeGreaterThanOrEqual(2);
  });

  it('never produces a real GIM game name', () => {
    const rng = new Rng(2);
    const used: string[] = [];
    for (let i = 0; i < 200; i++) {
      const n = generateGameName(rng, used);
      expect(REAL_GIM_NAMES as readonly string[]).not.toContain(n);
      used.push(n);
    }
  });

  it('avoids names already in use', () => {
    const rng = new Rng(3);
    const used: string[] = [];
    for (let i = 0; i < 100; i++) used.push(generateGameName(rng, used));
    expect(new Set(used).size).toBe(used.length);
  });

  it('person names are deterministic first + last', () => {
    const a = generatePersonName(new Rng(4));
    expect(a).toBe(generatePersonName(new Rng(4)));
    expect(a.split(' ').length).toBe(2);
  });
});
```

- [ ] **Step 9: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../names'`.

- [ ] **Step 10: Create `src/engine/names.ts`**

```ts
// src/engine/names.ts
import { Rng } from './rng';
import { NAME_FIRST, NAME_SECOND, PERSON_FIRST, PERSON_LAST, REAL_GIM_NAMES } from './data';

export function generateGameName(rng: Rng, used: readonly string[]): string {
  for (let attempt = 0; attempt < 100; attempt++) {
    const name = `${rng.pick(NAME_FIRST)} ${rng.pick(NAME_SECOND)}`;
    const taken = used.includes(name) || (REAL_GIM_NAMES as readonly string[]).includes(name);
    if (!taken) return name;
  }
  // Bank exhausted (400 combos) — extremely long runs only. Suffix a numeral.
  let n = 2;
  const base = `${rng.pick(NAME_FIRST)} ${rng.pick(NAME_SECOND)}`;
  while (used.includes(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

export function generatePersonName(rng: Rng): string {
  return `${rng.pick(PERSON_FIRST)} ${rng.pick(PERSON_LAST)}`;
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — rng, week, names suites all green. Also run `npm run build` to type-check `types.ts`/`constants.ts`/`data.ts`; expected: success.

- [ ] **Step 12: Commit**

```bash
git add src/engine && git commit -m "feat(engine): types, constants, week helpers, data banks, name generators"
```

---

### Task 4: Initial state factory (`newGame`)

**Files:**
- Create: `src/engine/newGame.ts`, `src/engine/generators.ts` (candidate/offer generation lives here from the start), `src/engine/inbox.ts` (only `generateInboxItem` for now)
- Test: `src/engine/__tests__/newGame.test.ts`

Note: `generators.ts` and `inbox.ts` grow in Tasks 12–13; this task creates them with the pieces `newGame` needs, fully implemented (no stubs).

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/newGame.test.ts
import { newGame } from '../newGame';
import { STARTING_CASH } from '../constants';

describe('newGame', () => {
  it('is deterministic for the same seed', () => {
    expect(newGame(7)).toEqual(newGame(7));
  });

  it('sets up the starting company per spec', () => {
    const s = newGame(1);
    expect(s.cash).toBe(STARTING_CASH);
    expect(s.weekIndex).toBe(0);
    expect(s.status).toBe('playing');
    // 2 devs, 1 QA, 1 RM
    const roles = s.team.map((m) => m.role).sort();
    expect(roles).toEqual(['Developer', 'Developer', 'QA', 'Release Manager'].sort());
    // 2 starting games: one aging (stale), one healthy
    expect(s.games).toHaveLength(2);
    const stale = s.games.filter((g) => g.lastRolloutWeek < -6);
    expect(stale).toHaveLength(1);
    // weekly payroll ≈ weekly revenue (breakeven-ish, within 20%)
    const payroll = s.team.reduce((a, m) => a + m.salary, 0);
    const revenue = s.games.reduce((a, g) => a + g.players * g.revenuePerPlayer, 0);
    expect(revenue / payroll).toBeGreaterThan(0.8);
    expect(revenue / payroll).toBeLessThan(1.2);
  });

  it('seeds starter tickets, market and inbox', () => {
    const s = newGame(2);
    expect(s.tickets.length).toBeGreaterThanOrEqual(3);
    expect(s.tickets.every((t) => t.status === 'TODO')).toBe(true);
    expect(s.market.candidates.length).toBeGreaterThanOrEqual(2);
    expect(s.market.offers.length).toBeGreaterThanOrEqual(1);
    expect(s.inbox.filter((i) => i.status === 'pending').length).toBeGreaterThanOrEqual(2);
    // ticket keys are GIM-style and unique
    const keys = s.tickets.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.every((k) => /^GIM-\d+$/.test(k))).toBe(true);
    // game names are fictional (asserted indirectly: tracked in usedNames)
    expect(s.usedNames.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../newGame'`.

- [ ] **Step 3: Create `src/engine/generators.ts`** (shared creation helpers + market generation)

```ts
// src/engine/generators.ts
import { Rng } from './rng';
import {
  BUG_EFFORT, CANDIDATES_PER_WEEK, GENRES, OFFERS_PER_WEEK, OFFER_PRICE_NOISE,
  OFFER_PRICE_WEEKS, SALARY_BY_SKILL, SIGNING_FEE_WEEKS, STORY_EFFORT, TASK_EFFORT,
} from './constants';
import { BUG_TITLES, STORY_TEMPLATES } from './data';
import { generateGameName, generatePersonName } from './names';
import type {
  FeatureTag, GameOffer, GameState, Genre, HireCandidate, Impact, Role, Ticket, TicketType,
} from './types';

export function genId(s: GameState, prefix: string): string {
  return `${prefix}${s.nextId++}`;
}

export function nextTicketKey(s: GameState): string {
  return `GIM-${s.nextTicketNum++}`;
}

interface TicketInit {
  type: TicketType;
  gameId: string;
  title: string;
  effort: number;
  tags?: FeatureTag[];
  predictedImpact?: Impact;
  impact?: Impact;
  deadlineWeek?: number | null;
  releaseVersion?: string | null;
}

/** Create a ticket in TODO and push it onto state. Returns the ticket. */
export function createTicket(s: GameState, init: TicketInit): Ticket {
  const t: Ticket = {
    key: nextTicketKey(s),
    type: init.type,
    gameId: init.gameId,
    title: init.title,
    status: 'TODO',
    assigneeId: null,
    effortTotal: init.effort,
    effort: init.effort,
    phaseEffort: init.effort,
    pointsWorked: 0,
    devSkillSum: 0,
    qaEffort: 0,
    hiddenBugs: 0,
    tags: init.tags ?? [],
    predictedImpact: init.predictedImpact ?? { revenuePct: 0, ratingBonus: 0 },
    impact: init.impact ?? { revenuePct: 0, ratingBonus: 0 },
    deadlineWeek: init.deadlineWeek ?? null,
    createdWeek: s.weekIndex,
    releaseVersion: init.releaseVersion ?? null,
  };
  s.tickets.push(t);
  return t;
}

export function effortFor(rng: Rng, type: TicketType): number {
  const [lo, hi] =
    type === 'Story' ? STORY_EFFORT : type === 'Bug' ? BUG_EFFORT : TASK_EFFORT;
  return rng.int(lo, hi);
}

/** Random story title + tag, biased toward tags that fit the genre (60/25/15). */
export function genStoryConcept(
  rng: Rng,
  genre: Genre,
  fit: { good: FeatureTag[]; bad: FeatureTag[] },
): { title: string; tag: FeatureTag } {
  const all = Object.keys(STORY_TEMPLATES) as FeatureTag[];
  const neutral = all.filter((t) => !fit.good.includes(t) && !fit.bad.includes(t));
  const roll = rng.next();
  const pool = roll < 0.6 ? fit.good : roll < 0.85 ? neutral : fit.bad;
  const tag = rng.pick(pool.length ? pool : all);
  return { title: rng.pick(STORY_TEMPLATES[tag]), tag };
}

export function genBugTitle(rng: Rng): string {
  return rng.pick(BUG_TITLES);
}

export function genCandidate(s: GameState, rng: Rng): HireCandidate {
  const role: Role = rng.next() < 0.45 ? 'Developer' : rng.next() < 0.55 ? 'QA' : 'Release Manager';
  const skill = rng.int(1, 5);
  const base = SALARY_BY_SKILL[role][skill - 1];
  const salary = Math.round((base * rng.range(0.9, 1.1)) / 50) * 50;
  return {
    id: genId(s, 'cand'),
    name: generatePersonName(rng),
    role,
    skill,
    salary,
    signingFee: salary * SIGNING_FEE_WEEKS,
  };
}

export function genOffer(s: GameState, rng: Rng): GameOffer {
  const name = generateGameName(rng, s.usedNames);
  s.usedNames.push(name);
  const players = rng.int(20, 400) * 1000;
  const revenuePerPlayer = rng.range(0.008, 0.024);
  const weekly = players * revenuePerPlayer;
  const price = Math.round((weekly * OFFER_PRICE_WEEKS * rng.range(1 - OFFER_PRICE_NOISE, 1 + OFFER_PRICE_NOISE)) / 100) * 100;
  return {
    id: genId(s, 'offer'),
    name,
    genre: rng.pick(GENRES),
    players,
    rating: Math.round(rng.range(3.2, 4.7) * 10) / 10,
    revenuePerPlayer: Math.round(revenuePerPlayer * 10000) / 10000,
    price,
  };
}

/** Replace the market with fresh candidates and offers. */
export function refreshMarket(s: GameState, rng: Rng): void {
  const nc = rng.int(CANDIDATES_PER_WEEK[0], CANDIDATES_PER_WEEK[1]);
  const no = rng.int(OFFERS_PER_WEEK[0], OFFERS_PER_WEEK[1]);
  s.market.candidates = Array.from({ length: nc }, () => genCandidate(s, rng));
  s.market.offers = Array.from({ length: no }, () => genOffer(s, rng));
}
```

- [ ] **Step 4: Create `src/engine/inbox.ts`** (item generation only; accept/decline/deadlines arrive in Task 13)

```ts
// src/engine/inbox.ts
import { Rng } from './rng';
import {
  FEATURING_DEADLINE_WEEKS, FEATURING_REWARD_PCT, GENRE_FIT, SDK_DEADLINE_WEEKS, SDK_FINE,
} from './constants';
import { OPPORTUNITY_BODIES, SDK_TITLES } from './data';
import { cwLabel } from './week';
import { genId, genStoryConcept, genBugTitle, effortFor } from './generators';
import type { GameState, InboxItem, InboxItemKind } from './types';

/** Create one inbox item of the given kind for a random (or given) game. */
export function generateInboxItem(
  s: GameState,
  rng: Rng,
  kind: InboxItemKind,
  gameId?: string,
): InboxItem {
  const game = gameId
    ? s.games.find((g) => g.id === gameId)!
    : rng.pick(s.games);
  const base = {
    id: genId(s, 'inbox'),
    gameId: game.id,
    weekCreated: s.weekIndex,
    status: 'pending' as const,
  };
  if (kind === 'feature') {
    const { title, tag } = genStoryConcept(rng, game.genre, GENRE_FIT[game.genre]);
    const predicted = {
      revenuePct: Math.round(rng.range(4, 12) * 10) / 10,
      ratingBonus: Math.round(rng.range(0, 0.2) * 100) / 100,
    };
    const actual = {
      revenuePct: Math.round(predicted.revenuePct * rng.range(0.5, 1.4) * 10) / 10,
      ratingBonus: Math.round(predicted.ratingBonus * rng.range(0.5, 1.4) * 100) / 100,
    };
    return {
      ...base, kind, title: `${game.name} - ${title}`,
      body: `Players are asking for it. Predicted: +${predicted.revenuePct}% revenue.`,
      predictedImpact: predicted, actualImpact: actual, tags: [tag],
      effort: effortFor(rng, 'Story'),
    };
  }
  if (kind === 'bug') {
    const title = genBugTitle(rng);
    return {
      ...base, kind, title: `${game.name} - ${title}`,
      body: 'Players are reporting this in reviews. Ignoring it will hurt the rating.',
      effort: effortFor(rng, 'Bug'),
    };
  }
  if (kind === 'opportunity') {
    const deadlineWeek = s.weekIndex + rng.int(FEATURING_DEADLINE_WEEKS[0], FEATURING_DEADLINE_WEEKS[1]);
    const body = rng.pick(OPPORTUNITY_BODIES)
      .replace('{game}', game.name)
      .replace('{deadline}', cwLabel(deadlineWeek));
    return {
      ...base, kind, title: `Featuring opportunity: ${game.name}`,
      body, deadlineWeek, rewardPlayersPct: FEATURING_REWARD_PCT,
    };
  }
  // sdk
  const deadlineWeek = s.weekIndex + SDK_DEADLINE_WEEKS;
  return {
    ...base, kind: 'sdk', title: rng.pick(SDK_TITLES),
    body: `Compliance requires this in every game. Deadline ${cwLabel(deadlineWeek)} — missing it costs $${SDK_FINE.toLocaleString('en-US')}.`,
    deadlineWeek, fineUsd: SDK_FINE, effort: effortFor(rng, 'Task'),
  };
}
```

- [ ] **Step 5: Create `src/engine/newGame.ts`**

```ts
// src/engine/newGame.ts
import { Rng } from './rng';
import { DEFAULT_SEED, GENRE_FIT, SCHEMA_VERSION, STARTING_CASH } from './constants';
import { generateGameName, generatePersonName } from './names';
import { createTicket, effortFor, genStoryConcept, genBugTitle, refreshMarket } from './generators';
import { generateInboxItem } from './inbox';
import type { GameState, PortfolioGame, Role } from './types';

function member(s: GameState, rng: Rng, role: Role, skill: number, salary: number) {
  s.team.push({
    id: `m${s.nextId++}`,
    name: generatePersonName(rng),
    role,
    skill,
    salary,
    ticketKey: null,
  });
}

export function newGame(seed: number = DEFAULT_SEED): GameState {
  const rng = new Rng(seed);
  const s: GameState = {
    schemaVersion: SCHEMA_VERSION,
    seed,
    rngState: seed,
    weekIndex: 0,
    cash: STARTING_CASH,
    status: 'playing',
    team: [],
    games: [],
    tickets: [],
    releases: [],
    inbox: [],
    market: { candidates: [], offers: [] },
    nextTicketNum: 1,
    nextId: 1,
    usedNames: [],
    pendingDeltas: [],
    pendingEvents: [],
    lastReport: null,
    log: [],
  };

  // Team: Dev(3) $1500, Dev(2) $1100, QA(3) $1200, RM(3) $1300 → payroll $5,100/wk.
  member(s, rng, 'Developer', 3, 1500);
  member(s, rng, 'Developer', 2, 1100);
  member(s, rng, 'QA', 3, 1200);
  member(s, rng, 'Release Manager', 3, 1300);

  // Portfolio: an aging former hit (already stale) + a mid-size healthy title.
  // Combined revenue ≈ $5.1k/wk ≈ payroll; the aging game decays from week 1.
  const nameA = generateGameName(rng, s.usedNames);
  s.usedNames.push(nameA);
  const aging: PortfolioGame = {
    id: `g${s.nextId++}`, name: nameA, genre: rng.pick(['Puzzle', 'Arcade'] as const),
    players: 220_000, rating: 4.0, revenuePerPlayer: 0.016, version: '2.4.1',
    lastRolloutWeek: -8, pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  const nameB = generateGameName(rng, s.usedNames);
  s.usedNames.push(nameB);
  const healthy: PortfolioGame = {
    id: `g${s.nextId++}`, name: nameB, genre: rng.pick(['Merge', 'Word'] as const),
    players: 90_000, rating: 4.4, revenuePerPlayer: 0.018, version: '1.6.0',
    lastRolloutWeek: -2, pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  s.games.push(aging, healthy);

  // Starter backlog: aging game gets a bug + a story; healthy game gets a story.
  createTicket(s, {
    type: 'Bug', gameId: aging.id,
    title: `${aging.name} - ${genBugTitle(rng)}`, effort: effortFor(rng, 'Bug'),
  });
  for (const g of [aging, healthy]) {
    const { title, tag } = genStoryConcept(rng, g.genre, GENRE_FIT[g.genre]);
    const revenuePct = Math.round(rng.range(5, 10) * 10) / 10;
    createTicket(s, {
      type: 'Story', gameId: g.id, title: `${g.name} - ${title}`,
      effort: effortFor(rng, 'Story'), tags: [tag],
      predictedImpact: { revenuePct, ratingBonus: 0.1 },
      impact: {
        revenuePct: Math.round(revenuePct * rng.range(0.6, 1.3) * 10) / 10,
        ratingBonus: 0.1,
      },
    });
  }

  refreshMarket(s, rng);
  s.inbox.push(generateInboxItem(s, rng, 'feature'));
  s.inbox.push(generateInboxItem(s, rng, 'bug'));

  s.rngState = rng.state;
  return s;
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS — newGame suite green (alongside earlier suites).

- [ ] **Step 7: Commit**

```bash
git add src/engine && git commit -m "feat(engine): newGame initial state + market/inbox generators"
```

---

### Task 5: Plan-phase actions — assign / unassign

**Files:**
- Create: `src/engine/actions.ts`
- Test: `src/engine/__tests__/actions.test.ts`

Assignment rules being locked in here:
- Only **Developers** are assignable, only to **Story/Bug/Task** tickets in **TODO** or **IN_DEVELOPMENT** (unassigned). QA auto-pulls; RMs are a capacity constraint, never assignees.
- Assigning moves a TODO ticket to IN_DEVELOPMENT immediately (instant board feedback).
- Assigning a busy dev silently frees their old ticket first (old ticket keeps progress, stays IN_DEVELOPMENT, unassigned).
- Unassigning a ticket with zero progress returns it to TODO; with progress it stays IN_DEVELOPMENT.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/actions.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import type { GameState } from '../types';

function devOf(s: GameState, i = 0) {
  return s.team.filter((m) => m.role === 'Developer')[i];
}

describe('assign / unassign', () => {
  it('assigns a dev and moves the TODO ticket to IN_DEVELOPMENT', () => {
    const s = newGame(1);
    const t = s.tickets[0];
    const dev = devOf(s);
    const s2 = applyAction(s, { type: 'assign', ticketKey: t.key, memberId: dev.id });
    const t2 = s2.tickets.find((x) => x.key === t.key)!;
    expect(t2.status).toBe('IN_DEVELOPMENT');
    expect(t2.assigneeId).toBe(dev.id);
    expect(s2.team.find((m) => m.id === dev.id)!.ticketKey).toBe(t.key);
    // input state untouched
    expect(s.tickets[0].status).toBe('TODO');
  });

  it('reassigning a busy dev frees the old ticket but keeps its progress state', () => {
    const s = newGame(1);
    const [t1, t2] = s.tickets;
    const dev = devOf(s);
    let st = applyAction(s, { type: 'assign', ticketKey: t1.key, memberId: dev.id });
    st = applyAction(st, { type: 'assign', ticketKey: t2.key, memberId: dev.id });
    const old = st.tickets.find((x) => x.key === t1.key)!;
    expect(old.assigneeId).toBeNull();
    expect(st.team.find((m) => m.id === dev.id)!.ticketKey).toBe(t2.key);
  });

  it('unassign returns a no-progress ticket to TODO', () => {
    const s = newGame(1);
    const t = s.tickets[0];
    const dev = devOf(s);
    let st = applyAction(s, { type: 'assign', ticketKey: t.key, memberId: dev.id });
    st = applyAction(st, { type: 'unassign', ticketKey: t.key });
    const t2 = st.tickets.find((x) => x.key === t.key)!;
    expect(t2.status).toBe('TODO');
    expect(t2.assigneeId).toBeNull();
  });

  it('rejects assigning non-developers or wrong ticket states', () => {
    const s = newGame(1);
    const qa = s.team.find((m) => m.role === 'QA')!;
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: s.tickets[0].key, memberId: qa.id }),
    ).toThrow();
    expect(() =>
      applyAction(s, { type: 'assign', ticketKey: 'GIM-999', memberId: devOf(s).id }),
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../actions'`.

- [ ] **Step 3: Create `src/engine/actions.ts`**

```ts
// src/engine/actions.ts
import { Rng } from './rng';
import type { GameState, PlanAction, Ticket } from './types';

type Ctx = { s: GameState; rng: Rng };
const handlers: Partial<Record<PlanAction['type'], (ctx: Ctx, a: any) => void>> = {};

/** Pure plan-phase reducer. Throws on invalid actions; never mutates input. */
export function applyAction(state: GameState, action: PlanAction): GameState {
  if (state.status !== 'playing') throw new Error('Game over');
  const s = structuredClone(state);
  const rng = new Rng(s.rngState);
  const handler = handlers[action.type];
  if (!handler) throw new Error(`Unknown action ${action.type}`);
  handler({ s, rng }, action);
  s.rngState = rng.state;
  return s;
}

export function getTicket(s: GameState, key: string): Ticket {
  const t = s.tickets.find((x) => x.key === key);
  if (!t) throw new Error(`No ticket ${key}`);
  return t;
}

function freeMemberFromTicket(s: GameState, ticket: Ticket): void {
  if (ticket.assigneeId) {
    const m = s.team.find((x) => x.id === ticket.assigneeId);
    if (m) m.ticketKey = null;
  }
  ticket.assigneeId = null;
}

handlers.assign = ({ s }, a: { ticketKey: string; memberId: string }) => {
  const t = getTicket(s, a.ticketKey);
  const m = s.team.find((x) => x.id === a.memberId);
  if (!m) throw new Error('No such team member');
  if (m.role !== 'Developer') throw new Error('Only developers can be assigned');
  if (t.type === 'Release Ticket') throw new Error('Release tickets are handled by RMs');
  if (t.status !== 'TODO' && t.status !== 'IN_DEVELOPMENT') {
    throw new Error(`Cannot assign a ticket in ${t.status}`);
  }
  if (t.assigneeId && t.assigneeId !== m.id) throw new Error('Ticket already assigned');
  // Free the dev's previous ticket, if any.
  if (m.ticketKey && m.ticketKey !== t.key) {
    const old = getTicket(s, m.ticketKey);
    old.assigneeId = null;
  }
  m.ticketKey = t.key;
  t.assigneeId = m.id;
  if (t.status === 'TODO') t.status = 'IN_DEVELOPMENT';
};

handlers.unassign = ({ s }, a: { ticketKey: string }) => {
  const t = getTicket(s, a.ticketKey);
  if (t.status !== 'IN_DEVELOPMENT') throw new Error('Only dev-phase tickets can be unassigned');
  freeMemberFromTicket(s, t);
  if (t.pointsWorked === 0) t.status = 'TODO';
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine && git commit -m "feat(engine): applyAction with assign/unassign"
```

---

### Task 6: Resolution — developer work phase

**Files:**
- Create: `src/engine/work.ts`, `src/engine/__tests__/helpers.ts`
- Test: `src/engine/__tests__/work.test.ts`

Phase functions (`runDevPhase`, `runQaPhase`) **mutate the state they're given** — they are internal steps called by `endWeek` on its own clone. Only `newGame` / `applyAction` / `endWeek` are the pure public API.

- [ ] **Step 1: Create the shared test fixture helpers**

```ts
// src/engine/__tests__/helpers.ts
import { newGame } from '../newGame';
import type { GameState, Role, TeamMember, Ticket } from '../types';

export function makeState(seed = 1): GameState {
  return newGame(seed);
}

let n = 0;
export function addMember(s: GameState, role: Role, skill: number): TeamMember {
  const m: TeamMember = {
    id: `tm${++n}`, name: `Test ${role}`, role, skill, salary: 1000, ticketKey: null,
  };
  s.team.push(m);
  return m;
}

export function addTicket(s: GameState, over: Partial<Ticket> = {}): Ticket {
  const t: Ticket = {
    key: `GIM-${s.nextTicketNum++}`,
    type: 'Story', gameId: s.games[0].id, title: 'Test story',
    status: 'TODO', assigneeId: null,
    effortTotal: 4, effort: 4, phaseEffort: 4, pointsWorked: 0, devSkillSum: 0,
    qaEffort: 0, hiddenBugs: 0, tags: [],
    predictedImpact: { revenuePct: 0, ratingBonus: 0 },
    impact: { revenuePct: 0, ratingBonus: 0 },
    deadlineWeek: null, createdWeek: s.weekIndex, releaseVersion: null,
    ...over,
  };
  s.tickets.push(t);
  return t;
}

/** Directly wire an assignment in a fixture (bypasses applyAction validation). */
export function assignTo(s: GameState, t: Ticket, m: TeamMember): void {
  t.assigneeId = m.id;
  m.ticketKey = t.key;
  if (t.status === 'TODO') t.status = 'IN_DEVELOPMENT';
}
```

- [ ] **Step 2: Write the failing test**

```ts
// src/engine/__tests__/work.test.ts
import { Rng } from '../rng';
import { runDevPhase } from '../work';
import { makeState, addMember, addTicket, assignTo } from './helpers';

describe('runDevPhase', () => {
  it('applies speed points per week and finishes into AWAITING_QA', () => {
    const s = makeState();
    const dev = addMember(s, 'Developer', 3); // speed 4
    const t = addTicket(s, { effortTotal: 8, effort: 8, phaseEffort: 8 });
    assignTo(s, t, dev);
    const rng = new Rng(1);

    runDevPhase(s, rng);
    expect(t.effort).toBe(4);
    expect(t.status).toBe('IN_DEVELOPMENT');
    expect(t.pointsWorked).toBe(4);
    expect(t.devSkillSum).toBe(12); // 4 points × skill 3

    runDevPhase(s, rng);
    expect(t.status).toBe('AWAITING_QA');
    expect(t.assigneeId).toBeNull();
    expect(dev.ticketKey).toBeNull();
  });

  it('injects hidden bugs on completion, more for low-skill devs', () => {
    // skill 1 dev, effort 8: expected bugs = 8 × 5 × 0.04 = 1.6 → 1 or 2
    const s = makeState();
    const dev = addMember(s, 'Developer', 1); // speed 2
    const t = addTicket(s, { effortTotal: 8, effort: 8, phaseEffort: 8 });
    assignTo(s, t, dev);
    const rng = new Rng(7);
    for (let i = 0; i < 4; i++) runDevPhase(s, rng);
    expect(t.status).toBe('AWAITING_QA');
    expect([1, 2]).toContain(t.hiddenBugs);
  });

  it('is deterministic for the same rng seed', () => {
    const run = () => {
      const s = makeState();
      const dev = addMember(s, 'Developer', 2);
      const t = addTicket(s, { effortTotal: 6, effort: 6, phaseEffort: 6 });
      assignTo(s, t, dev);
      const rng = new Rng(42);
      runDevPhase(s, rng);
      runDevPhase(s, rng);
      return { bugs: t.hiddenBugs, status: t.status, rngState: rng.state };
    };
    expect(run()).toEqual(run());
  });

  it('ignores devs with dangling assignments', () => {
    const s = makeState();
    const dev = addMember(s, 'Developer', 3);
    dev.ticketKey = 'GIM-9999'; // ticket does not exist
    expect(() => runDevPhase(s, new Rng(1))).not.toThrow();
    expect(dev.ticketKey).toBeNull();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../work'`.

- [ ] **Step 4: Create `src/engine/work.ts`** (dev phase only; QA phase added next task)

```ts
// src/engine/work.ts
import { Rng } from './rng';
import { BUG_RATE_PER_POINT, speedOf } from './constants';
import type { GameState } from './types';

/** Mutates s: every assigned developer applies one week of work. */
export function runDevPhase(s: GameState, rng: Rng): void {
  for (const m of s.team) {
    if (m.role !== 'Developer' || !m.ticketKey) continue;
    const t = s.tickets.find((x) => x.key === m.ticketKey);
    if (!t || t.status !== 'IN_DEVELOPMENT') {
      m.ticketKey = null;
      continue;
    }
    const applied = Math.min(speedOf(m.skill), t.effort);
    t.effort -= applied;
    t.pointsWorked += applied;
    t.devSkillSum += applied * m.skill;
    if (t.effort <= 0) {
      const expectedBugs = t.phaseEffort * (6 - m.skill) * BUG_RATE_PER_POINT;
      t.hiddenBugs += rng.count(expectedBugs);
      t.status = 'AWAITING_QA';
      t.assigneeId = null;
      m.ticketKey = null;
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine && git commit -m "feat(engine): developer work phase with hidden bug injection"
```

---

### Task 7: Resolution — QA phase

**Files:**
- Modify: `src/engine/work.ts` (append `runQaPhase`)
- Test: `src/engine/__tests__/work.test.ts` (append suite)

Rules locked in: a QA member acts once per week — if busy, they work their ticket; if idle, they pull the **oldest** AWAITING_QA ticket and work it the same week. After finishing a ticket they don't pull another until next week. A bug-caught ticket returns to IN_DEVELOPMENT **unassigned** — re-assigning it is a deliberate management decision for the player.

- [ ] **Step 1: Append the failing tests to `src/engine/__tests__/work.test.ts`**

```ts
import { runQaPhase } from '../work';
import { QA_EFFORT_FRACTION, REWORK_FRACTION } from '../constants';

describe('runQaPhase', () => {
  it('idle QA pulls the oldest AWAITING_QA ticket and can finish it the same week', () => {
    const s = makeState();
    addMember(s, 'QA', 3); // speed 4
    const t = addTicket(s, { status: 'AWAITING_QA', effortTotal: 4, effort: 0, hiddenBugs: 0 });
    runQaPhase(s, new Rng(1));
    // qaEffort = ceil(4 × 0.5) = 2 ≤ speed 4 → resolved immediately, no bugs → QA_COMPLETE
    expect(t.status).toBe('QA_COMPLETE');
    expect(t.assigneeId).toBeNull();
  });

  it('clean tickets always pass (no catch rolls when hiddenBugs = 0)', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = makeState();
      addMember(s, 'QA', 1);
      const t = addTicket(s, { status: 'AWAITING_QA', effortTotal: 2, hiddenBugs: 0 });
      for (let i = 0; i < 5 && t.status !== 'QA_COMPLETE'; i++) runQaPhase(s, new Rng(seed + i));
      expect(t.status).toBe('QA_COMPLETE');
    }
  });

  it('buggy tickets either bounce back with fewer bugs or pass with bugs intact', () => {
    const s = makeState();
    addMember(s, 'QA', 5);
    const t = addTicket(s, { status: 'AWAITING_QA', effortTotal: 8, hiddenBugs: 10 });
    const rng = new Rng(3);
    for (let i = 0; i < 10 && (t.status === 'AWAITING_QA' || t.status === 'IN_QA'); i++) runQaPhase(s, rng);
    if (t.status === 'IN_DEVELOPMENT') {
      expect(t.hiddenBugs).toBeLessThan(10);
      expect(t.effort).toBe(Math.max(1, Math.ceil(t.effortTotal * REWORK_FRACTION)));
      expect(t.phaseEffort).toBe(t.effort);
    } else {
      expect(t.status).toBe('QA_COMPLETE');
      expect(t.hiddenBugs).toBe(10);
    }
    // skill 5 catch rate is 0.95 — with 10 bugs, bouncing back is the only realistic outcome
    expect(t.status).toBe('IN_DEVELOPMENT');
  });

  it('a QA member only works one ticket per week', () => {
    const s = makeState();
    addMember(s, 'QA', 5); // fast
    const t1 = addTicket(s, { status: 'AWAITING_QA', effortTotal: 2, hiddenBugs: 0 });
    const t2 = addTicket(s, { status: 'AWAITING_QA', effortTotal: 2, hiddenBugs: 0 });
    runQaPhase(s, new Rng(1));
    expect(t1.status).toBe('QA_COMPLETE');
    expect(t2.status).toBe('AWAITING_QA'); // untouched until next week
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `runQaPhase` is not exported.

- [ ] **Step 3: Append `runQaPhase` to `src/engine/work.ts`**

```ts
// (append to src/engine/work.ts)
import {
  QA_CATCH_BASE, QA_CATCH_PER_SKILL, QA_EFFORT_FRACTION, REWORK_FRACTION,
} from './constants';

/** Mutates s: every QA member works or pulls one ticket. */
export function runQaPhase(s: GameState, rng: Rng): void {
  for (const qa of s.team) {
    if (qa.role !== 'QA') continue;
    let t = qa.ticketKey ? s.tickets.find((x) => x.key === qa.ticketKey) ?? null : null;
    if (t && t.status !== 'IN_QA') {
      qa.ticketKey = null;
      t = null;
    }
    if (!t) {
      t = s.tickets.find((x) => x.status === 'AWAITING_QA') ?? null; // array order = oldest first
      if (!t) continue;
      t.status = 'IN_QA';
      t.assigneeId = qa.id;
      qa.ticketKey = t.key;
      t.qaEffort = Math.ceil(t.phaseEffort * QA_EFFORT_FRACTION);
    }
    t.qaEffort -= Math.min(t.qaEffort, speedOf(qa.skill));
    if (t.qaEffort > 0) continue;
    // QA pass complete — roll per hidden bug.
    const catchRate = QA_CATCH_BASE + QA_CATCH_PER_SKILL * qa.skill;
    let caught = 0;
    for (let i = 0; i < t.hiddenBugs; i++) if (rng.chance(catchRate)) caught++;
    qa.ticketKey = null;
    t.assigneeId = null;
    if (caught > 0) {
      t.hiddenBugs -= caught;
      const rework = Math.max(1, Math.ceil(t.effortTotal * REWORK_FRACTION));
      t.effort = rework;
      t.phaseEffort = rework;
      t.status = 'IN_DEVELOPMENT'; // unassigned — player must re-staff it
    } else {
      t.status = 'QA_COMPLETE';
    }
  }
}
```

Note: `import { speedOf }` already exists at the top of the file — merge the new constant imports into the existing import statement rather than duplicating it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — all work-phase tests green.

- [ ] **Step 5: Commit**

```bash
git add src/engine && git commit -m "feat(engine): QA phase — pull, test, catch or pass"
```

---

### Task 8: Release quality & report card math

**Files:**
- Create: `src/engine/quality.ts`
- Test: `src/engine/__tests__/quality.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/quality.test.ts
import { Rng } from '../rng';
import { clamp, computeQuality, deriveReportCard } from '../quality';
import { makeState, addTicket } from './helpers';
import type { Release } from '../types';

function fakeRelease(over: Partial<Release> = {}): Release {
  return {
    id: 'r1', gameId: 'g1', version: '1.1.0', cwLabel: 'CW 24/2026',
    ticketKeys: [], quality: 70, missedBugs: 0,
    impact: { revenuePct: 10, ratingBonus: 0.2 },
    status: 'soft', shippedWeek: 0, reportCard: null, decision: null,
    releaseTicketKey: 'GIM-99',
    ...over,
  };
}

describe('computeQuality', () => {
  it('high-skill clean work scores high; missed bugs crater it', () => {
    const s = makeState();
    const game = s.games[0];
    const clean = addTicket(s, {
      status: 'QA_COMPLETE', pointsWorked: 8, devSkillSum: 40, hiddenBugs: 0, // avg skill 5
    });
    const r1 = computeQuality([clean], game, new Rng(1));
    expect(r1.quality).toBeGreaterThanOrEqual(75);
    expect(r1.missedBugs).toBe(0);

    const buggy = addTicket(s, {
      status: 'QA_COMPLETE', pointsWorked: 8, devSkillSum: 16, hiddenBugs: 2, // avg skill 2
    });
    const r2 = computeQuality([buggy], game, new Rng(1));
    expect(r2.missedBugs).toBe(2);
    expect(r2.quality).toBeLessThan(50);
  });

  it('is deterministic per seed and clamped to [0, 100]', () => {
    const s = makeState();
    const t = addTicket(s, { pointsWorked: 4, devSkillSum: 4, hiddenBugs: 6 });
    const a = computeQuality([t], s.games[0], new Rng(5));
    const b = computeQuality([t], s.games[0], new Rng(5));
    expect(a).toEqual(b);
    expect(a.quality).toBeGreaterThanOrEqual(0);
    expect(a.quality).toBeLessThanOrEqual(100);
  });
});

describe('deriveReportCard', () => {
  it('maps quality to happiness tiers', () => {
    expect(deriveReportCard(fakeRelease({ quality: 80 }), new Rng(1)).happiness).toBe('loved');
    expect(deriveReportCard(fakeRelease({ quality: 65 }), new Rng(1)).happiness).toBe('liked');
    expect(deriveReportCard(fakeRelease({ quality: 50 }), new Rng(1)).happiness).toBe('meh');
    expect(deriveReportCard(fakeRelease({ quality: 30 }), new Rng(1)).happiness).toBe('hated');
  });

  it('amplifies missed bugs into bug reports', () => {
    const card = deriveReportCard(fakeRelease({ missedBugs: 3 }), new Rng(2));
    expect(card.bugReports).toBeGreaterThanOrEqual(4); // 3 × [1.5, 3.5)
    expect(card.bugReports).toBeLessThanOrEqual(11);
  });

  it('caps rating delta and revenue impact', () => {
    const great = deriveReportCard(fakeRelease({ quality: 100, impact: { revenuePct: 40, ratingBonus: 1 } }), new Rng(3));
    expect(great.ratingDelta).toBe(0.6);
    expect(great.revenueImpactPct).toBeLessThanOrEqual(40);
    const awful = deriveReportCard(fakeRelease({ quality: 0, impact: { revenuePct: 0, ratingBonus: 0 } }), new Rng(3));
    expect(awful.ratingDelta).toBe(-0.6);
    expect(awful.revenueImpactPct).toBeGreaterThanOrEqual(-20);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../quality'`. (The `releaseTicketKey` field is added to the `Release` type in Step 3.)

- [ ] **Step 3: Add `releaseTicketKey` to the Release interface in `src/engine/types.ts`**

```ts
// in interface Release, after ticketKeys:
  releaseTicketKey: string; // the Release Ticket on the board
```

- [ ] **Step 4: Create `src/engine/quality.ts`**

```ts
// src/engine/quality.ts
import { Rng } from './rng';
import {
  GENRE_FIT, GENRE_FIT_BAD, GENRE_FIT_CAP, GENRE_FIT_GOOD, HAPPINESS_LIKED,
  HAPPINESS_LOVED, HAPPINESS_MEH, QUALITY_BASE, QUALITY_NOISE, QUALITY_PER_MISSED_BUG,
  QUALITY_PER_SKILL, RATING_DELTA_CAP, REVENUE_IMPACT_CAP,
} from './constants';
import type { Happiness, PortfolioGame, Release, ReportCard, Ticket } from './types';

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Hidden quality of a release computed at cut time from its tickets. */
export function computeQuality(
  included: Ticket[],
  game: PortfolioGame,
  rng: Rng,
): { quality: number; missedBugs: number } {
  const missedBugs = included.reduce((a, t) => a + t.hiddenBugs, 0);
  const points = included.reduce((a, t) => a + t.pointsWorked, 0);
  const skillSum = included.reduce((a, t) => a + t.devSkillSum, 0);
  const avgSkill = points > 0 ? skillSum / points : 3;

  const fitTable = GENRE_FIT[game.genre];
  let fit = 0;
  for (const t of included) {
    if (t.tags.some((tag) => fitTable.good.includes(tag))) fit += GENRE_FIT_GOOD;
    if (t.tags.some((tag) => fitTable.bad.includes(tag))) fit += GENRE_FIT_BAD;
  }
  fit = clamp(fit, -GENRE_FIT_CAP, GENRE_FIT_CAP);

  const quality = clamp(
    QUALITY_BASE + QUALITY_PER_SKILL * (avgSkill - 3) + 18 + fit
      + QUALITY_PER_MISSED_BUG * missedBugs + rng.noise(QUALITY_NOISE),
    0, 100,
  );
  return { quality: Math.round(quality), missedBugs };
}
```

**Wait — formula note:** the spec formula is `55 + 6 × avgDevSkill` (skill 1→61 … skill 5→85). Write it directly, not centered:

```ts
  const quality = clamp(
    QUALITY_BASE + QUALITY_PER_SKILL * avgSkill + fit
      + QUALITY_PER_MISSED_BUG * missedBugs + rng.noise(QUALITY_NOISE),
    0, 100,
  );
```

Use this second form (delete the `+ 18` line above — it was the centered equivalent; the direct form is clearer). Continue the file:

```ts
/** Player-facing report card derived from hidden quality when metrics arrive. */
export function deriveReportCard(release: Release, rng: Rng): ReportCard {
  const q = release.quality;
  const happiness: Happiness =
    q >= HAPPINESS_LOVED ? 'loved' : q >= HAPPINESS_LIKED ? 'liked' : q >= HAPPINESS_MEH ? 'meh' : 'hated';
  const bugReports =
    release.missedBugs === 0
      ? (rng.chance(0.15) ? 1 : 0)
      : Math.round(release.missedBugs * rng.range(1.5, 3.5));
  const revenueImpactPct = clamp(
    round1(release.impact.revenuePct * (q / 70) + (q - QUALITY_BASE) / 5 + rng.noise(2)),
    REVENUE_IMPACT_CAP[0], REVENUE_IMPACT_CAP[1],
  );
  const ratingDelta = clamp(
    round1((q - QUALITY_BASE) / 25 + release.impact.ratingBonus),
    -RATING_DELTA_CAP, RATING_DELTA_CAP,
  );
  return { happiness, bugReports, revenueImpactPct, ratingDelta };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS. If the `releaseTicketKey` addition broke `newGame`/fixtures compilation anywhere, the compiler will say so — there are no other Release constructors yet.

- [ ] **Step 6: Commit**

```bash
git add src/engine && git commit -m "feat(engine): release quality and friendly report card derivation"
```

---

### Task 9: Cut releases, ship soft launches, report arrival

**Files:**
- Create: `src/engine/releases.ts`
- Modify: `src/engine/actions.ts` (add `cutRelease` handler)
- Test: `src/engine/__tests__/releases.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/releases.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { arriveReports, canCutRelease, computeNextVersion, shipCuttingReleases } from '../releases';
import { Rng } from '../rng';
import { makeState, addTicket } from './helpers';
import type { GameState } from '../types';

function withQaComplete(s: GameState, gameId: string, type: 'Story' | 'Bug' = 'Story') {
  return addTicket(s, {
    type, gameId, status: 'QA_COMPLETE', pointsWorked: 6, devSkillSum: 18, hiddenBugs: 0,
    impact: { revenuePct: 8, ratingBonus: 0.1 },
  });
}

describe('canCutRelease / cutRelease', () => {
  it('requires QA-complete tickets', () => {
    const s = newGame(1);
    const g = s.games[0];
    expect(canCutRelease(s, g.id).ok).toBe(false);
    withQaComplete(s, g.id);
    expect(canCutRelease(s, g.id)).toMatchObject({ ok: true });
  });

  it('bumps minor for stories, patch for bug-only', () => {
    const s = makeState();
    const g = s.games[0]; // version 2.4.1
    const story = withQaComplete(s, g.id, 'Story');
    expect(computeNextVersion(g, [story])).toBe('2.5.0');
    const bug = withQaComplete(s, g.id, 'Bug');
    expect(computeNextVersion(g, [bug])).toBe('2.4.2');
  });

  it('cutRelease creates the release + GIM-style release ticket and consumes pendingImpact', () => {
    const s = makeState();
    const g = s.games[0];
    g.pendingImpact = { revenuePct: 5, ratingBonus: 0.1 };
    withQaComplete(s, g.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g.id });
    expect(s2.releases).toHaveLength(1);
    const r = s2.releases[0];
    expect(r.status).toBe('cutting');
    expect(r.version).toBe('2.5.0');
    expect(r.impact.revenuePct).toBeCloseTo(13, 5); // 8 + 5 pending
    expect(s2.games[0].pendingImpact.revenuePct).toBe(0);
    const rt = s2.tickets.find((t) => t.key === r.releaseTicketKey)!;
    expect(rt.type).toBe('Release Ticket');
    expect(rt.title).toBe(`${g.name} - CW 24/2026 / 2.5.0`);
    expect(rt.status).toBe('IN_DEVELOPMENT');
  });

  it('enforces RM capacity and one in-flight release per game', () => {
    const s = makeState(); // 1 RM
    const [g1, g2] = s.games;
    withQaComplete(s, g1.id);
    withQaComplete(s, g2.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g1.id });
    expect(() => applyAction(s2, { type: 'cutRelease', gameId: g1.id })).toThrow(); // in-flight
    expect(canCutRelease(s2, g2.id).ok).toBe(false); // RM busy
    expect(() => applyAction(s2, { type: 'cutRelease', gameId: g2.id })).toThrow();
  });
});

describe('ship & report arrival', () => {
  it('shipping moves tickets to DONE and the release to soft', () => {
    const s = makeState();
    const g = s.games[0];
    const t = withQaComplete(s, g.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g.id });
    shipCuttingReleases(s2);
    const r = s2.releases[0];
    expect(r.status).toBe('soft');
    expect(r.shippedWeek).toBe(s2.weekIndex);
    expect(s2.tickets.find((x) => x.key === t.key)!.status).toBe('DONE');
    expect(s2.tickets.find((x) => x.key === r.releaseTicketKey)!.status).toBe('DONE');
  });

  it('report cards arrive only for releases shipped in an earlier week', () => {
    const s = makeState();
    const g = s.games[0];
    withQaComplete(s, g.id);
    const s2 = applyAction(s, { type: 'cutRelease', gameId: g.id });
    shipCuttingReleases(s2);
    const rng = new Rng(1);
    expect(arriveReports(s2, rng)).toEqual([]); // same week → nothing
    s2.weekIndex += 1;
    const arrived = arriveReports(s2, rng);
    expect(arrived).toHaveLength(1);
    expect(s2.releases[0].reportCard).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../releases'`.

- [ ] **Step 3: Create `src/engine/releases.ts`**

```ts
// src/engine/releases.ts
import { Rng } from './rng';
import { computeQuality, deriveReportCard } from './quality';
import { createTicket, genId } from './generators';
import { cwLabel } from './week';
import type { GameState, PortfolioGame, Release, Ticket } from './types';

export function qaCompleteFor(s: GameState, gameId: string): Ticket[] {
  const locked = new Set(s.releases.flatMap((r) => (r.status === 'decided' ? [] : r.ticketKeys)));
  return s.tickets.filter(
    (t) => t.gameId === gameId && t.status === 'QA_COMPLETE' && !locked.has(t.key),
  );
}

export function computeNextVersion(game: PortfolioGame, included: Ticket[]): string {
  const [maj, min, pat] = game.version.split('.').map(Number);
  return included.some((t) => t.type === 'Story')
    ? `${maj}.${min + 1}.0`
    : `${maj}.${min}.${pat + 1}`;
}

export function canCutRelease(
  s: GameState,
  gameId: string,
): { ok: boolean; reason?: string; nextVersion?: string } {
  const game = s.games.find((g) => g.id === gameId);
  if (!game) return { ok: false, reason: 'No such game' };
  if (s.releases.some((r) => r.gameId === gameId && r.status !== 'decided')) {
    return { ok: false, reason: 'A release is already in flight for this game' };
  }
  const included = qaCompleteFor(s, gameId);
  if (included.length === 0) return { ok: false, reason: 'No QA-complete tickets for this game' };
  const rmCount = s.team.filter((m) => m.role === 'Release Manager').length;
  const cutting = s.releases.filter((r) => r.status === 'cutting').length;
  if (cutting >= rmCount) return { ok: false, reason: 'All release managers are busy this week' };
  return { ok: true, nextVersion: computeNextVersion(game, included) };
}

/** Mutates s. Called from the cutRelease action handler after validation. */
export function performCut(s: GameState, rng: Rng, gameId: string): Release {
  const check = canCutRelease(s, gameId);
  if (!check.ok) throw new Error(check.reason);
  const game = s.games.find((g) => g.id === gameId)!;
  const included = qaCompleteFor(s, gameId);
  const version = check.nextVersion!;
  const { quality, missedBugs } = computeQuality(included, game, rng);
  const impact = {
    revenuePct: included.reduce((a, t) => a + t.impact.revenuePct, 0) + game.pendingImpact.revenuePct,
    ratingBonus: included.reduce((a, t) => a + t.impact.ratingBonus, 0) + game.pendingImpact.ratingBonus,
  };
  game.pendingImpact = { revenuePct: 0, ratingBonus: 0 };
  const label = cwLabel(s.weekIndex);
  const releaseTicket = createTicket(s, {
    type: 'Release Ticket', gameId, title: `${game.name} - ${label} / ${version}`,
    effort: 0, releaseVersion: version,
  });
  releaseTicket.status = 'IN_DEVELOPMENT'; // visible as "RM preparing" on the board
  const release: Release = {
    id: genId(s, 'rel'), gameId, version, cwLabel: label,
    ticketKeys: included.map((t) => t.key), releaseTicketKey: releaseTicket.key,
    quality, missedBugs, impact, status: 'cutting', shippedWeek: null,
    reportCard: null, decision: null,
  };
  s.releases.push(release);
  s.pendingEvents.push(`📦 Cut ${releaseTicket.title} (soft launch goes out this week)`);
  return release;
}

/** Mutates s: all 'cutting' releases go to 10% soft launch; their tickets are DONE. */
export function shipCuttingReleases(s: GameState): void {
  for (const r of s.releases) {
    if (r.status !== 'cutting') continue;
    r.status = 'soft';
    r.shippedWeek = s.weekIndex;
    for (const key of [...r.ticketKeys, r.releaseTicketKey]) {
      const t = s.tickets.find((x) => x.key === key);
      if (t) {
        t.status = 'DONE';
        t.assigneeId = null;
      }
    }
  }
}

/** Mutates s: soft releases shipped in an earlier week get their report card. Returns arrived ids. */
export function arriveReports(s: GameState, rng: Rng): string[] {
  const arrived: string[] = [];
  for (const r of s.releases) {
    if (r.status === 'soft' && !r.reportCard && r.shippedWeek !== null && r.shippedWeek < s.weekIndex) {
      r.reportCard = deriveReportCard(r, rng);
      arrived.push(r.id);
    }
  }
  return arrived;
}
```

- [ ] **Step 4: Add the `cutRelease` handler to `src/engine/actions.ts`**

Append to the imports: `import { performCut } from './releases';` — then append the handler:

```ts
handlers.cutRelease = ({ s, rng }, a: { gameId: string }) => {
  performCut(s, rng, a.gameId);
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS — releases suite green.

- [ ] **Step 6: Commit**

```bash
git add src/engine && git commit -m "feat(engine): cut releases, soft-launch shipping, report card arrival"
```

---

### Task 10: Rollout decisions — Full Rollout / Pull Back & Fix

**Files:**
- Modify: `src/engine/constants.ts` (one new constant), `src/engine/releases.ts` (decision functions), `src/engine/actions.ts` (two handlers)
- Test: `src/engine/__tests__/releases.test.ts` (append suite)

- [ ] **Step 1: Append the failing tests**

```ts
// append to src/engine/__tests__/releases.test.ts
import { NEW_GAME_SEED_PER_QUALITY } from '../constants';

function decidableRelease(s: GameState, gameId: string, quality: number, missedBugs = 0) {
  const r = {
    id: `rel-test-${quality}`, gameId, version: '9.9.0', cwLabel: 'CW 24/2026',
    ticketKeys: [], releaseTicketKey: 'GIM-9999', quality, missedBugs,
    impact: { revenuePct: 10, ratingBonus: 0.2 },
    status: 'soft' as const, shippedWeek: 0,
    reportCard: { happiness: 'liked' as const, bugReports: missedBugs, revenueImpactPct: 12, ratingDelta: 0.3 },
    decision: null,
  };
  s.releases.push(r);
  return r;
}

describe('rollout decisions', () => {
  it('full rollout applies effects and stamps the game', () => {
    const s = makeState();
    const g = s.games[0];
    const before = { players: g.players, rpp: g.revenuePerPlayer, rating: g.rating };
    const r = decidableRelease(s, g.id, 80);
    const s2 = applyAction(s, { type: 'fullRollout', releaseId: r.id });
    const g2 = s2.games[0];
    expect(g2.players).toBeGreaterThan(before.players); // q80 > 55 → growth
    expect(g2.revenuePerPlayer).toBeCloseTo(before.rpp * 1.12, 5);
    expect(g2.rating).toBeCloseTo(before.rating + 0.3, 5);
    expect(g2.version).toBe('9.9.0');
    expect(g2.lastRolloutWeek).toBe(s2.weekIndex);
    expect(s2.releases.find((x) => x.id === r.id)!.decision).toBe('full');
  });

  it('bad-quality full rollout shrinks the player base', () => {
    const s = makeState();
    const g = s.games[0];
    const r = decidableRelease(s, g.id, 30);
    const s2 = applyAction(s, { type: 'fullRollout', releaseId: r.id });
    expect(s2.games[0].players).toBeLessThan(g.players);
  });

  it('first rollout of a 0-player game seeds players from quality', () => {
    const s = makeState();
    s.games[0].players = 0;
    const r = decidableRelease(s, s.games[0].id, 70);
    const s2 = applyAction(s, { type: 'fullRollout', releaseId: r.id });
    expect(s2.games[0].players).toBe(70 * NEW_GAME_SEED_PER_QUALITY);
  });

  it('pull back spawns bug tickets and returns impact to the pending pool', () => {
    const s = makeState();
    const g = s.games[0];
    const r = decidableRelease(s, g.id, 40, 3);
    const bugsBefore = s.tickets.filter((t) => t.type === 'Bug').length;
    const s2 = applyAction(s, { type: 'pullBack', releaseId: r.id });
    expect(s2.tickets.filter((t) => t.type === 'Bug').length).toBe(bugsBefore + 3);
    expect(s2.games[0].pendingImpact).toEqual({ revenuePct: 10, ratingBonus: 0.2 });
    expect(s2.releases.find((x) => x.id === r.id)!.decision).toBe('pulled');
    // game stats untouched
    expect(s2.games[0].players).toBe(g.players);
  });

  it('decisions require an arrived report card', () => {
    const s = makeState();
    const r = decidableRelease(s, s.games[0].id, 70);
    r.reportCard = null;
    expect(() => applyAction(s, { type: 'fullRollout', releaseId: r.id })).toThrow();
    expect(() => applyAction(s, { type: 'pullBack', releaseId: r.id })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — unknown action / missing export errors.

- [ ] **Step 3: Add the seeding constant to `src/engine/constants.ts`**

```ts
export const NEW_GAME_SEED_PER_QUALITY = 400; // first rollout of a 0-player game: players = quality × this
```

- [ ] **Step 4: Append decision functions to `src/engine/releases.ts`**

Add imports: `clamp` from `./quality`, `GROWTH_DIVISOR, NEW_GAME_SEED_PER_QUALITY, QUALITY_BASE` from `./constants`, `genBugTitle, effortFor` from `./generators`.

```ts
function decidable(s: GameState, releaseId: string): Release {
  const r = s.releases.find((x) => x.id === releaseId);
  if (!r) throw new Error('No such release');
  if (r.status !== 'soft' || !r.reportCard) throw new Error('No report card yet');
  return r;
}

/** Mutates s: apply the release to the live game. */
export function applyFullRollout(s: GameState, releaseId: string): void {
  const r = decidable(s, releaseId);
  const g = s.games.find((x) => x.id === r.gameId)!;
  const card = r.reportCard!;
  if (g.players === 0) {
    g.players = r.quality * NEW_GAME_SEED_PER_QUALITY; // launch!
  } else {
    g.players = Math.max(0, Math.round(g.players * (1 + (r.quality - QUALITY_BASE) / GROWTH_DIVISOR)));
  }
  g.revenuePerPlayer = Math.max(0.001, g.revenuePerPlayer * (1 + card.revenueImpactPct / 100));
  g.rating = clamp(Math.round((g.rating + card.ratingDelta) * 10) / 10, 1, 5);
  g.version = r.version;
  g.lastRolloutWeek = s.weekIndex;
  r.status = 'decided';
  r.decision = 'full';
  s.pendingEvents.push(`✅ ${g.name} ${r.version} fully rolled out`);
  s.log.push(`${r.cwLabel}: ${g.name} ${r.version} full rollout`);
  // Featuring opportunities tied to this game pay out now.
  for (const item of s.inbox) {
    if (
      item.kind === 'opportunity' && item.status === 'accepted' &&
      item.gameId === g.id && (item.deadlineWeek ?? -1) >= s.weekIndex
    ) {
      g.players = Math.round(g.players * (1 + (item.rewardPlayersPct ?? 0)));
      item.status = 'done';
      s.pendingEvents.push(`🌟 ${g.name} got featured — players spiked!`);
      s.log.push(`${r.cwLabel}: ${g.name} featured by the platform`);
    }
  }
}

/** Mutates s: withdraw the soft launch; bugs become tickets; impact returns to the pool. */
export function applyPullBack(s: GameState, rng: Rng, releaseId: string): void {
  const r = decidable(s, releaseId);
  const g = s.games.find((x) => x.id === r.gameId)!;
  for (let i = 0; i < r.missedBugs; i++) {
    createTicket(s, {
      type: 'Bug', gameId: g.id,
      title: `${g.name} - ${genBugTitle(rng)}`, effort: effortFor(rng, 'Bug'),
    });
  }
  g.pendingImpact = {
    revenuePct: g.pendingImpact.revenuePct + r.impact.revenuePct,
    ratingBonus: g.pendingImpact.ratingBonus + r.impact.ratingBonus,
  };
  r.status = 'decided';
  r.decision = 'pulled';
  s.pendingEvents.push(`↩️ ${g.name} ${r.version} pulled back — ${r.missedBugs} bug(s) filed`);
}
```

- [ ] **Step 5: Add the two handlers to `src/engine/actions.ts`**

Append to imports: `import { applyFullRollout, applyPullBack } from './releases';`

```ts
handlers.fullRollout = ({ s }, a: { releaseId: string }) => {
  applyFullRollout(s, a.releaseId);
};

handlers.pullBack = ({ s, rng }, a: { releaseId: string }) => {
  applyPullBack(s, rng, a.releaseId);
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine && git commit -m "feat(engine): full rollout and pull-back decisions with featuring payouts"
```

---

### Task 11: Economy — revenue, decay, payroll, company value

**Files:**
- Create: `src/engine/economy.ts`
- Test: `src/engine/__tests__/economy.test.ts`

Convention from here on: **every cash movement and event line is pushed onto `s.pendingDeltas` / `s.pendingEvents`** — `endWeek` (Task 14) drains both into the weekly report at the very end. Plan-phase actions already follow this.

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/economy.test.ts
import { companyValue, runEconomy } from '../economy';
import { PLAYER_VALUE } from '../constants';
import { makeState } from './helpers';

describe('runEconomy', () => {
  it('adds revenue per game and subtracts payroll', () => {
    const s = makeState();
    const expectedRevenue = s.games.reduce((a, g) => a + Math.round(g.players * g.revenuePerPlayer), 0);
    const payroll = s.team.reduce((a, m) => a + m.salary, 0);
    const cashBefore = s.cash;
    runEconomy(s);
    expect(s.cash).toBe(cashBefore + expectedRevenue - payroll);
    expect(s.pendingDeltas.find((d) => d.label === 'Salaries')!.amount).toBe(-payroll);
    expect(s.pendingDeltas.filter((d) => d.amount > 0).length).toBe(2); // one per game
  });

  it('decays stale games but not fresh ones', () => {
    const s = makeState();
    const stale = s.games.find((g) => g.lastRolloutWeek <= -8)!; // 8+ weeks stale
    const fresh = s.games.find((g) => g.lastRolloutWeek === -2)!;
    const stalePlayers = stale.players;
    const freshPlayers = fresh.players;
    runEconomy(s);
    expect(stale.players).toBeLessThan(stalePlayers);
    expect(fresh.players).toBe(freshPlayers);
  });

  it('never decays an unlaunched (0-player) game below zero', () => {
    const s = makeState();
    s.games[0].players = 0;
    s.games[0].lastRolloutWeek = -20;
    runEconomy(s);
    expect(s.games[0].players).toBe(0);
  });
});

describe('companyValue', () => {
  it('is cash + players × PLAYER_VALUE', () => {
    const s = makeState();
    const players = s.games.reduce((a, g) => a + g.players, 0);
    expect(companyValue(s)).toBe(Math.round(s.cash + players * PLAYER_VALUE));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../economy'`.

- [ ] **Step 3: Create `src/engine/economy.ts`**

```ts
// src/engine/economy.ts
import {
  DECAY_GRACE_WEEKS, DECAY_MAX_STALE_WEEKS, DECAY_PER_STALE_WEEK, PLAYER_VALUE,
  RATING_DECAY_STALE,
} from './constants';
import type { GameState } from './types';

/** Mutates s: weekly revenue, staleness decay, payroll. Pushes deltas. */
export function runEconomy(s: GameState): void {
  for (const g of s.games) {
    const rev = Math.round(g.players * g.revenuePerPlayer);
    if (rev > 0) {
      s.cash += rev;
      s.pendingDeltas.push({ label: `${g.name} revenue`, amount: rev });
    }
  }
  for (const g of s.games) {
    if (g.players === 0) continue; // not launched yet — nothing to decay
    const stale = s.weekIndex - g.lastRolloutWeek;
    if (stale > DECAY_GRACE_WEEKS) {
      const weeksOver = Math.min(stale - DECAY_GRACE_WEEKS, DECAY_MAX_STALE_WEEKS);
      g.players = Math.max(0, Math.round(g.players * (1 - DECAY_PER_STALE_WEEK * weeksOver)));
      g.rating = Math.max(1, Math.round((g.rating - RATING_DECAY_STALE) * 100) / 100);
    }
  }
  const payroll = s.team.reduce((a, m) => a + m.salary, 0);
  s.cash -= payroll;
  s.pendingDeltas.push({ label: 'Salaries', amount: -payroll });
}

export function companyValue(s: GameState): number {
  return Math.round(s.cash + s.games.reduce((a, g) => a + g.players * PLAYER_VALUE, 0));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine && git commit -m "feat(engine): weekly economy — revenue, staleness decay, payroll, company value"
```

---

### Task 12: Market actions — hire, buy game, start new game

**Files:**
- Modify: `src/engine/actions.ts` (three handlers), `src/engine/releases.ts` (0.0.0 version special case), `src/engine/data.ts` (new-game story titles)
- Test: `src/engine/__tests__/market.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/market.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { computeNextVersion } from '../releases';
import { NEW_GAME_COST, NEW_GAME_STORIES } from '../constants';
import { makeState, addTicket } from './helpers';

describe('hire', () => {
  it('deducts the signing fee and adds the member', () => {
    const s = newGame(1);
    const c = s.market.candidates[0];
    const s2 = applyAction(s, { type: 'hire', candidateId: c.id });
    expect(s2.cash).toBe(s.cash - c.signingFee);
    expect(s2.team.some((m) => m.id === c.id && m.role === c.role)).toBe(true);
    expect(s2.market.candidates.some((x) => x.id === c.id)).toBe(false);
    expect(s2.pendingDeltas.some((d) => d.amount === -c.signingFee)).toBe(true);
  });

  it('throws when cash is short', () => {
    const s = newGame(1);
    s.cash = 0;
    expect(() => applyAction(s, { type: 'hire', candidateId: s.market.candidates[0].id })).toThrow();
  });
});

describe('buyGame', () => {
  it('adds the game with starter tickets and removes the offer', () => {
    const s = newGame(1);
    s.cash = 10_000_000; // afford anything
    const o = s.market.offers[0];
    const s2 = applyAction(s, { type: 'buyGame', offerId: o.id });
    const g = s2.games.find((x) => x.name === o.name)!;
    expect(g.players).toBe(o.players);
    expect(s2.cash).toBe(10_000_000 - o.price);
    const starters = s2.tickets.filter((t) => t.gameId === g.id);
    expect(starters.filter((t) => t.type === 'Bug')).toHaveLength(1);
    expect(starters.filter((t) => t.type === 'Story')).toHaveLength(2);
    expect(s2.market.offers.some((x) => x.id === o.id)).toBe(false);
  });
});

describe('startNewGame', () => {
  it('creates a 0-player game with a 1.0.0 story chain', () => {
    const s = newGame(1);
    const s2 = applyAction(s, { type: 'startNewGame', genre: 'Card' });
    expect(s2.cash).toBe(s.cash - NEW_GAME_COST);
    const g = s2.games[s2.games.length - 1];
    expect(g.players).toBe(0);
    expect(g.genre).toBe('Card');
    expect(g.version).toBe('0.0.0');
    const stories = s2.tickets.filter((t) => t.gameId === g.id && t.type === 'Story');
    expect(stories).toHaveLength(NEW_GAME_STORIES);
    expect(s2.usedNames).toContain(g.name);
  });

  it('first release of a 0.0.0 game is version 1.0.0', () => {
    const s = makeState();
    s.games[0].version = '0.0.0';
    const story = addTicket(s, { status: 'QA_COMPLETE' });
    expect(computeNextVersion(s.games[0], [story])).toBe('1.0.0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — unknown action errors and a failing `computeNextVersion` expectation.

- [ ] **Step 3: Add the 0.0.0 special case to `computeNextVersion` in `src/engine/releases.ts`**

```ts
export function computeNextVersion(game: PortfolioGame, included: Ticket[]): string {
  if (game.version === '0.0.0') return '1.0.0'; // a brand-new game's first release
  const [maj, min, pat] = game.version.split('.').map(Number);
  return included.some((t) => t.type === 'Story')
    ? `${maj}.${min + 1}.0`
    : `${maj}.${min}.${pat + 1}`;
}
```

- [ ] **Step 4: Add new-game story titles to `src/engine/data.ts`**

```ts
export const NEW_GAME_STORY_TITLES = [
  'Core gameplay loop',
  'First 100 levels',
  'Tutorial & onboarding',
] as const;
```

- [ ] **Step 5: Add the three handlers to `src/engine/actions.ts`**

Merge these imports with the existing ones: `generateGameName` from `./names`; `createTicket, effortFor, genId, genStoryConcept, genBugTitle` from `./generators`; `GENRE_FIT, NEW_GAME_COST` from `./constants`; `NEW_GAME_STORY_TITLES` from `./data`; `Genre, PortfolioGame` types.

```ts
handlers.hire = ({ s }, a: { candidateId: string }) => {
  const c = s.market.candidates.find((x) => x.id === a.candidateId);
  if (!c) throw new Error('No such candidate');
  if (s.cash < c.signingFee) throw new Error('Not enough cash for the signing fee');
  s.cash -= c.signingFee;
  s.pendingDeltas.push({ label: `Signing fee: ${c.name}`, amount: -c.signingFee });
  s.team.push({ id: c.id, name: c.name, role: c.role, skill: c.skill, salary: c.salary, ticketKey: null });
  s.market.candidates = s.market.candidates.filter((x) => x.id !== c.id);
  s.pendingEvents.push(`👋 Hired ${c.name} — ${c.role}, ${'⭐'.repeat(c.skill)}`);
};

handlers.buyGame = ({ s, rng }, a: { offerId: string }) => {
  const o = s.market.offers.find((x) => x.id === a.offerId);
  if (!o) throw new Error('No such offer');
  if (s.cash < o.price) throw new Error('Not enough cash');
  s.cash -= o.price;
  s.pendingDeltas.push({ label: `Acquired ${o.name}`, amount: -o.price });
  const game: PortfolioGame = {
    id: genId(s, 'g'), name: o.name, genre: o.genre, players: o.players,
    rating: o.rating, revenuePerPlayer: o.revenuePerPlayer,
    version: `${rng.int(1, 3)}.${rng.int(0, 9)}.${rng.int(0, 2)}`,
    lastRolloutWeek: s.weekIndex, // acquisition resets the staleness clock
    pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  s.games.push(game);
  createTicket(s, {
    type: 'Bug', gameId: game.id,
    title: `${game.name} - ${genBugTitle(rng)}`, effort: effortFor(rng, 'Bug'),
  });
  for (let i = 0; i < 2; i++) {
    const { title, tag } = genStoryConcept(rng, game.genre, GENRE_FIT[game.genre]);
    const revenuePct = Math.round(rng.range(4, 10) * 10) / 10;
    createTicket(s, {
      type: 'Story', gameId: game.id, title: `${game.name} - ${title}`,
      effort: effortFor(rng, 'Story'), tags: [tag],
      predictedImpact: { revenuePct, ratingBonus: 0.1 },
      impact: {
        revenuePct: Math.round(revenuePct * rng.range(0.5, 1.4) * 10) / 10,
        ratingBonus: 0.1,
      },
    });
  }
  s.market.offers = s.market.offers.filter((x) => x.id !== o.id);
  s.pendingEvents.push(`🎉 Acquired ${o.name} for $${o.price.toLocaleString('en-US')}`);
  s.log.push(`Acquired ${o.name}`);
};

handlers.startNewGame = ({ s, rng }, a: { genre: Genre }) => {
  if (s.cash < NEW_GAME_COST) throw new Error('Not enough cash');
  s.cash -= NEW_GAME_COST;
  s.pendingDeltas.push({ label: 'New game prototype', amount: -NEW_GAME_COST });
  const name = generateGameName(rng, s.usedNames);
  s.usedNames.push(name);
  const game: PortfolioGame = {
    id: genId(s, 'g'), name, genre: a.genre, players: 0, rating: 3.0,
    revenuePerPlayer: 0.012, version: '0.0.0', lastRolloutWeek: s.weekIndex,
    pendingImpact: { revenuePct: 0, ratingBonus: 0 }, declinedBugs: 0,
  };
  s.games.push(game);
  for (const title of NEW_GAME_STORY_TITLES) {
    createTicket(s, {
      type: 'Story', gameId: game.id, title: `${name} - ${title}`,
      effort: rng.int(5, 8),
      predictedImpact: { revenuePct: 3, ratingBonus: 0.1 },
      impact: { revenuePct: Math.round(rng.range(2, 5) * 10) / 10, ratingBonus: 0.1 },
    });
  }
  s.pendingEvents.push(`🌱 Started a new ${a.genre} game: ${name}`);
  s.log.push(`Started ${name} (${a.genre})`);
};
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/engine && git commit -m "feat(engine): hire, acquire games, start new games"
```

---

### Task 13: Inbox — accept/decline, weekly generation, deadlines

**Files:**
- Modify: `src/engine/inbox.ts` (accept/decline/weekly/deadlines), `src/engine/actions.ts` (two handlers)
- Test: `src/engine/__tests__/inbox.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/inbox.test.ts
import { Rng } from '../rng';
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { checkDeadlines, generateWeeklyInbox } from '../inbox';
import { generateInboxItem } from '../inbox';
import { SDK_FINE } from '../constants';
import { makeState } from './helpers';

describe('accept / decline', () => {
  it('accepting a feature creates a Story carrying hidden actual impact', () => {
    const s = newGame(1);
    const item = s.inbox.find((i) => i.kind === 'feature')!;
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const t = s2.tickets.find((x) => x.title === item.title)!;
    expect(t.type).toBe('Story');
    expect(t.predictedImpact).toEqual(item.predictedImpact);
    expect(t.impact).toEqual(item.actualImpact);
    expect(s2.inbox.find((i) => i.id === item.id)!.status).toBe('accepted');
  });

  it('declining a bug dents the rating, escalating with repetition', () => {
    const s = makeState();
    const rng = new Rng(9);
    const i1 = generateInboxItem(s, rng, 'bug', s.games[0].id);
    const i2 = generateInboxItem(s, rng, 'bug', s.games[0].id);
    s.inbox.push(i1, i2);
    const r0 = s.games[0].rating;
    const s2 = applyAction(s, { type: 'declineInbox', itemId: i1.id });
    const drop1 = r0 - s2.games[0].rating;
    const s3 = applyAction(s2, { type: 'declineInbox', itemId: i2.id });
    const drop2 = s2.games[0].rating - s3.games[0].rating;
    expect(drop1).toBeGreaterThan(0);
    expect(drop2).toBeGreaterThan(drop1); // escalation
  });

  it('handled items cannot be handled twice', () => {
    const s = newGame(1);
    const item = s.inbox[0];
    const s2 = applyAction(s, { type: 'declineInbox', itemId: item.id });
    expect(() => applyAction(s2, { type: 'acceptInbox', itemId: item.id })).toThrow();
  });
});

describe('deadlines', () => {
  it('fines a declined SDK item once when the deadline passes', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(1), 'sdk');
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'declineInbox', itemId: item.id });
    s2.weekIndex = item.deadlineWeek! + 1;
    const cash = s2.cash;
    checkDeadlines(s2);
    expect(s2.cash).toBe(cash - SDK_FINE);
    checkDeadlines(s2); // no double fine
    expect(s2.cash).toBe(cash - SDK_FINE);
  });

  it('fines an accepted-but-unfinished SDK task at the deadline', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(2), 'sdk');
    s.inbox.push(item);
    const s2 = applyAction(s, { type: 'acceptInbox', itemId: item.id });
    const task = s2.tickets.find((t) => t.type === 'Task')!;
    expect(task.deadlineWeek).toBe(item.deadlineWeek);
    s2.weekIndex = item.deadlineWeek! + 1;
    const cash = s2.cash;
    checkDeadlines(s2);
    expect(s2.cash).toBe(cash - SDK_FINE);
    expect(s2.tickets.find((t) => t.type === 'Task')!.deadlineWeek).toBeNull();
  });

  it('expires stale opportunities', () => {
    const s = makeState();
    const item = generateInboxItem(s, new Rng(3), 'opportunity');
    s.inbox.push(item);
    s.weekIndex = item.deadlineWeek! + 1;
    checkDeadlines(s);
    expect(s.inbox.find((i) => i.id === item.id)!.status).toBe('done');
  });
});

describe('generateWeeklyInbox', () => {
  it('adds 1-3 pending items deterministically', () => {
    const run = () => {
      const s = newGame(5);
      const before = s.inbox.length;
      generateWeeklyInbox(s, new Rng(5));
      return s.inbox.slice(before).map((i) => i.kind + i.title);
    };
    const a = run();
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(a).toEqual(run());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — missing exports / unknown actions.

- [ ] **Step 3: Append to `src/engine/inbox.ts`**

Add to imports: `DECLINED_BUG_RATING_HIT, INBOX_PER_WEEK, SDK_FINE` (merge with existing constant imports), `createTicket, effortFor` already imported, plus `InboxItemKind` type if not present.

```ts
/** Mutates s: player accepts an inbox item. */
export function acceptInboxItem(s: GameState, itemId: string): void {
  const item = s.inbox.find((i) => i.id === itemId);
  if (!item) throw new Error('No such inbox item');
  if (item.status !== 'pending') throw new Error('Already handled');
  const game = s.games.find((g) => g.id === item.gameId)!;
  if (item.kind === 'feature') {
    createTicket(s, {
      type: 'Story', gameId: item.gameId, title: item.title, effort: item.effort!,
      tags: item.tags, predictedImpact: item.predictedImpact, impact: item.actualImpact,
    });
  } else if (item.kind === 'bug') {
    createTicket(s, { type: 'Bug', gameId: item.gameId, title: item.title, effort: item.effort! });
  } else if (item.kind === 'sdk') {
    createTicket(s, {
      type: 'Task', gameId: item.gameId, title: `${game.name} - ${item.title}`,
      effort: item.effort!, deadlineWeek: item.deadlineWeek,
    });
  }
  // opportunities are just tracked; payout happens on full rollout (releases.ts)
  item.status = 'accepted';
}

/** Mutates s: player declines an inbox item. Declined bugs dent the rating. */
export function declineInboxItem(s: GameState, itemId: string): void {
  const item = s.inbox.find((i) => i.id === itemId);
  if (!item) throw new Error('No such inbox item');
  if (item.status !== 'pending') throw new Error('Already handled');
  if (item.kind === 'bug') {
    const g = s.games.find((x) => x.id === item.gameId)!;
    g.declinedBugs += 1;
    g.rating = Math.max(1, Math.round((g.rating - DECLINED_BUG_RATING_HIT * g.declinedBugs) * 100) / 100);
    s.pendingEvents.push(`📉 Ignored a bug in ${g.name} — rating slipped`);
  }
  item.status = 'declined';
}

/** Mutates s: 1-3 new events for the new week. At most one SDK chore in flight. */
export function generateWeeklyInbox(s: GameState, rng: Rng): void {
  const count = rng.int(INBOX_PER_WEEK[0], INBOX_PER_WEEK[1]);
  for (let i = 0; i < count; i++) {
    const roll = rng.next();
    let kind: InboxItemKind =
      roll < 0.45 ? 'feature' : roll < 0.75 ? 'bug' : roll < 0.9 ? 'opportunity' : 'sdk';
    const sdkActive =
      s.inbox.some((it) => it.kind === 'sdk' && (it.status === 'pending' || it.status === 'accepted')) ||
      s.tickets.some((t) => t.type === 'Task' && t.deadlineWeek !== null && t.status !== 'QA_COMPLETE' && t.status !== 'DONE');
    if (kind === 'sdk' && sdkActive) kind = 'feature';
    s.inbox.push(generateInboxItem(s, rng, kind));
  }
}

/** Mutates s: SDK fines and opportunity expiry. Run after the week advances. */
export function checkDeadlines(s: GameState): void {
  for (const item of s.inbox) {
    if (item.deadlineWeek == null) continue;
    const past = item.deadlineWeek < s.weekIndex;
    if (!past) continue;
    if (item.kind === 'sdk' && (item.status === 'pending' || item.status === 'declined')) {
      s.cash -= item.fineUsd!;
      s.pendingDeltas.push({ label: `Compliance fine: ${item.title}`, amount: -item.fineUsd! });
      s.pendingEvents.push(`🚨 Missed compliance deadline — fined $${item.fineUsd!.toLocaleString('en-US')}`);
      item.status = 'done';
    } else if (item.kind === 'opportunity' && (item.status === 'pending' || item.status === 'accepted')) {
      item.status = 'done';
      s.pendingEvents.push(`⌛ Featuring window for ${s.games.find((g) => g.id === item.gameId)!.name} closed`);
    }
  }
  for (const t of s.tickets) {
    if (
      t.type === 'Task' && t.deadlineWeek !== null && t.deadlineWeek < s.weekIndex &&
      t.status !== 'QA_COMPLETE' && t.status !== 'DONE'
    ) {
      s.cash -= SDK_FINE;
      s.pendingDeltas.push({ label: `Compliance fine: ${t.title}`, amount: -SDK_FINE });
      s.pendingEvents.push(`🚨 ${t.title} missed its deadline — fined $${SDK_FINE.toLocaleString('en-US')}`);
      t.deadlineWeek = null; // fined once
    }
  }
}
```

- [ ] **Step 4: Add the two handlers to `src/engine/actions.ts`**

Append to imports: `import { acceptInboxItem, declineInboxItem } from './inbox';`

```ts
handlers.acceptInbox = ({ s }, a: { itemId: string }) => {
  acceptInboxItem(s, a.itemId);
};

handlers.declineInbox = ({ s }, a: { itemId: string }) => {
  declineInboxItem(s, a.itemId);
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/engine && git commit -m "feat(engine): inbox accept/decline, weekly events, compliance deadlines"
```

---

### Task 14: `endWeek` — the full resolution pipeline

**Files:**
- Create: `src/engine/endWeek.ts`
- Modify: `src/engine/releases.ts` (ship event line)
- Test: `src/engine/__tests__/endWeek.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/endWeek.test.ts
import { newGame } from '../newGame';
import { applyAction } from '../actions';
import { endWeek } from '../endWeek';
import { canCutRelease } from '../releases';
import type { GameState, PlanAction } from '../types';

/** Scripted autopilot: assign idle devs, accept everything, cut & roll out whenever possible. */
function autopilotWeek(s: GameState): GameState {
  let st = s;
  const safe = (a: PlanAction) => {
    try { st = applyAction(st, a); } catch { /* invalid this week — skip */ }
  };
  for (const item of st.inbox.filter((i) => i.status === 'pending')) {
    safe({ type: 'acceptInbox', itemId: item.id });
  }
  for (const dev of st.team.filter((m) => m.role === 'Developer' && !m.ticketKey)) {
    const todo = st.tickets.find((t) => t.status === 'TODO');
    if (todo) safe({ type: 'assign', ticketKey: todo.key, memberId: dev.id });
  }
  for (const r of st.releases.filter((x) => x.status === 'soft' && x.reportCard)) {
    safe({ type: 'fullRollout', releaseId: r.id });
  }
  for (const g of st.games) {
    if (canCutRelease(st, g.id).ok) safe({ type: 'cutRelease', gameId: g.id });
  }
  return endWeek(st);
}

describe('endWeek', () => {
  it('advances the week and produces a weekly report', () => {
    const s = newGame(3);
    const s2 = endWeek(s);
    expect(s2.weekIndex).toBe(1);
    expect(s2.lastReport).not.toBeNull();
    expect(s2.lastReport!.cwLabel).toBe('CW 24/2026');
    expect(s2.lastReport!.deltas.some((d) => d.label === 'Salaries')).toBe(true);
    expect(s2.pendingDeltas).toEqual([]);
    expect(s2.inbox.length).toBeGreaterThan(s.inbox.length); // new weekly events
    expect(s).not.toBe(s2); // pure
  });

  it('rolls the calendar year over after CW 52', () => {
    let s = newGame(4);
    s = { ...s, weekIndex: 28 }; // CW 52/2026
    const s2 = endWeek(s);
    expect(s2.lastReport!.cwLabel).toBe('CW 52/2026');
    expect(s2.weekIndex).toBe(29); // CW 1/2027
  });

  it('a 12-week autopilot run is deterministic and ships at least one release', () => {
    const play = () => {
      let s = newGame(7);
      for (let w = 0; w < 12 && s.status === 'playing'; w++) s = autopilotWeek(s);
      return s;
    };
    const a = play();
    const b = play();
    expect(a).toEqual(b);
    expect(a.weekIndex).toBeGreaterThan(0);
    expect(a.releases.length).toBeGreaterThanOrEqual(1);
    expect(a.releases.some((r) => r.decision === 'full')).toBe(true);
    expect(Number.isFinite(a.cash)).toBe(true);
  });

  it('declares bankruptcy when cash dips below zero', () => {
    let s = newGame(8);
    s = { ...s, cash: 100 };
    for (const g of s.games) g.players = 0; // no revenue
    const s2 = endWeek(s);
    expect(s2.cash).toBeLessThan(0);
    expect(s2.status).toBe('bankrupt');
    expect(() => endWeek(s2)).toThrow();
    expect(() => applyAction(s2, { type: 'startNewGame', genre: 'Puzzle' })).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../endWeek'`.

- [ ] **Step 3: Add the soft-launch event to `shipCuttingReleases` in `src/engine/releases.ts`**

Inside the loop, after `r.shippedWeek = s.weekIndex;`, add:

```ts
    const game = s.games.find((g) => g.id === r.gameId)!;
    s.pendingEvents.push(`🚀 ${game.name} ${r.version} soft-launched to 10% of players`);
```

- [ ] **Step 4: Create `src/engine/endWeek.ts`**

```ts
// src/engine/endWeek.ts
import { Rng } from './rng';
import { cwLabel } from './week';
import { runDevPhase, runQaPhase } from './work';
import { arriveReports, shipCuttingReleases } from './releases';
import { runEconomy } from './economy';
import { checkDeadlines, generateWeeklyInbox } from './inbox';
import { refreshMarket } from './generators';
import type { GameState } from './types';

/** Pure: resolve the current week and hand back the next one. */
export function endWeek(state: GameState): GameState {
  if (state.status !== 'playing') throw new Error('Game over');
  const s = structuredClone(state);
  const rng = new Rng(s.rngState);
  const cashStart = s.cash;
  const resolvedLabel = cwLabel(s.weekIndex);

  runDevPhase(s, rng);          // 1. devs work
  runQaPhase(s, rng);           // 2. QA tests
  shipCuttingReleases(s);       // 3. cut releases go to 10% soft launch
  runEconomy(s);                // 4. revenue, decay, payroll
  s.weekIndex += 1;             // 5. the calendar turns
  const arrivedIds = arriveReports(s, rng); // 6. last week's soft launches report in
  for (const id of arrivedIds) {
    const r = s.releases.find((x) => x.id === id)!;
    const g = s.games.find((x) => x.id === r.gameId)!;
    s.pendingEvents.push(`📊 Report card arrived: ${g.name} ${r.version} — check Releases`);
  }
  checkDeadlines(s);            // 7. fines & expiries
  generateWeeklyInbox(s, rng);  // 8. fresh requests
  refreshMarket(s, rng);        // 9. fresh candidates & offers

  if (s.cash < 0) {
    s.status = 'bankrupt';
    s.log.push(`${cwLabel(s.weekIndex)}: 💀 Out of cash — the studio is bankrupt`);
  }

  s.lastReport = {
    cwLabel: resolvedLabel,
    cashStart,
    cashEnd: s.cash,
    deltas: s.pendingDeltas,
    events: s.pendingEvents,
    arrivedReleaseIds: arrivedIds,
  };
  s.pendingDeltas = [];
  s.pendingEvents = [];
  s.rngState = rng.state;
  return s;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS — the autopilot determinism test is the big one; if it flakes, something used randomness outside the seeded Rng.

- [ ] **Step 6: Commit**

```bash
git add src/engine && git commit -m "feat(engine): endWeek resolution pipeline with weekly report and bankruptcy"
```

---

### Task 15: Save/load + public engine API

**Files:**
- Create: `src/engine/save.ts`, `src/engine/index.ts`
- Test: `src/engine/__tests__/save.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/engine/__tests__/save.test.ts
import { newGame } from '../newGame';
import { endWeek } from '../endWeek';
import { deserialize, serialize } from '../save';

describe('save/load', () => {
  it('roundtrips a fresh and a played state', () => {
    const fresh = newGame(1);
    expect(deserialize(serialize(fresh))).toEqual(fresh);
    const played = endWeek(endWeek(fresh));
    expect(deserialize(serialize(played))).toEqual(played);
  });

  it('rejects corrupt JSON', () => {
    expect(deserialize('{not json')).toBeNull();
    expect(deserialize('')).toBeNull();
    expect(deserialize('{"hello":1}')).toBeNull();
  });

  it('rejects other schema versions', () => {
    const s = newGame(1);
    const tampered = serialize(s).replace('"v":1', '"v":999');
    expect(deserialize(tampered)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module '../save'`.

- [ ] **Step 3: Create `src/engine/save.ts`**

```ts
// src/engine/save.ts
import { SCHEMA_VERSION } from './constants';
import type { GameState } from './types';

export const SAVE_KEY = 'full-rollout-save';

export function serialize(state: GameState): string {
  return JSON.stringify({ v: SCHEMA_VERSION, state });
}

/** Returns null for corrupt or version-mismatched saves (caller starts fresh). */
export function deserialize(json: string): GameState | null {
  try {
    const parsed = JSON.parse(json) as { v?: number; state?: GameState };
    if (!parsed || parsed.v !== SCHEMA_VERSION || !parsed.state) return null;
    const st = parsed.state;
    if (typeof st.weekIndex !== 'number' || !Array.isArray(st.tickets)) return null;
    return st;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Create `src/engine/index.ts`** (the only import surface the UI uses)

```ts
// src/engine/index.ts
export { newGame } from './newGame';
export { applyAction } from './actions';
export { endWeek } from './endWeek';
export { serialize, deserialize, SAVE_KEY } from './save';
export { canCutRelease, qaCompleteFor } from './releases';
export { companyValue } from './economy';
export { cwLabel, weekToCW } from './week';
export { DECAY_GRACE_WEEKS, GENRES, NEW_GAME_COST } from './constants';
export type {
  CashDelta, GameOffer, GameState, Genre, Happiness, HireCandidate, Impact,
  InboxItem, PlanAction, PortfolioGame, Release, ReportCard, Role, TeamMember,
  Ticket, TicketStatus, TicketType, WeeklyReport,
} from './types';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test`
Expected: PASS — the full engine suite (~12 files) is green. Also run `npm run build`; expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/engine && git commit -m "feat(engine): save/load with schema guard + public API surface"
```

---

### Task 16: UI foundation — formatting, store, theme, app shell, top bar, sidebar

**Files:**
- Create: `src/ui/format.ts`, `src/ui/store.tsx`, `src/ui/components/TopBar.tsx`, `src/ui/components/Sidebar.tsx`
- Modify: `src/ui/App.tsx` (replace placeholder), `src/ui/theme.css` (replace placeholder)

UI tasks have no unit tests (the engine owns all logic). Verification = `npm run build` + a look at the dev server. Components must stay thin: read state, render, dispatch.

- [ ] **Step 1: Create `src/ui/format.ts`**

```ts
// src/ui/format.ts
import type { Happiness } from '../engine';

export function fmtMoney(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}

export function fmtPlayers(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${Math.round(v / 100) / 10}k`;
  return String(v);
}

export const stars = (r: number) => `${r.toFixed(1)}★`;

export const HAPPY: Record<Happiness, { emoji: string; label: string }> = {
  loved: { emoji: '😍', label: 'Loved it' },
  liked: { emoji: '🙂', label: 'Liked it' },
  meh: { emoji: '😐', label: 'Meh' },
  hated: { emoji: '😡', label: 'Hated it' },
};

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);

export const signedPct = (v: number) => `${v > 0 ? '+' : ''}${v}%`;
export const signedNum = (v: number) => `${v > 0 ? '+' : ''}${v}`;
```

- [ ] **Step 2: Create `src/ui/store.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace `src/ui/theme.css`** (the complete Jira-look stylesheet)

```css
/* ===== Full Rollout — Jira-look theme ===== */
:root {
  --blue: #0052cc; --blue-dark: #0747a6; --blue-light: #deebff;
  --bg: #f4f5f7; --col: #ebecf0; --card: #ffffff;
  --text: #172b4d; --sub: #5e6c84; --line: #dfe1e6;
  --green: #36b37e; --red: #de350b; --yellow: #ffab00; --purple: #6554c0;
  --radius: 3px; --shadow: 0 1px 2px rgba(9, 30, 66, 0.25);
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: var(--text); background: var(--bg); font-size: 14px;
}
button { font: inherit; cursor: pointer; }
.app { display: flex; flex-direction: column; height: 100%; }
.body { display: flex; flex: 1; min-height: 0; }

/* Top bar */
.topbar {
  height: 56px; background: var(--blue); color: #fff; display: flex;
  align-items: center; gap: 16px; padding: 0 16px; flex-shrink: 0;
}
.logo { font-weight: 700; font-size: 16px; letter-spacing: 0.2px; }
.logo span { opacity: 0.7; font-weight: 400; font-size: 12px; margin-left: 8px; }
.topbar .spacer { flex: 1; }
.stat-chip {
  background: rgba(255, 255, 255, 0.16); border-radius: var(--radius);
  padding: 6px 12px; font-weight: 600; font-size: 13px;
}
.stat-chip.low { background: var(--red); }
.btn {
  border: none; border-radius: var(--radius); padding: 8px 14px;
  font-weight: 600; font-size: 13px; background: var(--col); color: var(--text);
}
.btn:hover { filter: brightness(0.96); }
.btn:disabled { opacity: 0.45; cursor: not-allowed; }
.btn.primary { background: #fff; color: var(--blue); }
.btn.green { background: var(--green); color: #fff; }
.btn.red { background: var(--red); color: #fff; }
.btn.blue { background: var(--blue); color: #fff; }
.btn.subtle { background: transparent; color: var(--sub); }

/* Sidebar */
.sidebar {
  width: 240px; background: #fff; border-right: 1px solid var(--line);
  padding: 12px 8px; overflow-y: auto; flex-shrink: 0;
}
.nav-head {
  font-size: 11px; font-weight: 700; color: var(--sub); text-transform: uppercase;
  padding: 12px 8px 4px; letter-spacing: 0.5px;
}
.nav-item {
  display: flex; align-items: center; gap: 8px; width: 100%; text-align: left;
  background: none; border: none; border-radius: var(--radius);
  padding: 7px 8px; color: var(--text); font-size: 14px;
}
.nav-item:hover { background: var(--col); }
.nav-item.active { background: var(--blue-light); color: var(--blue); font-weight: 600; }
.nav-item .badge {
  margin-left: auto; background: var(--red); color: #fff; border-radius: 10px;
  font-size: 11px; font-weight: 700; padding: 1px 7px;
}
.nav-item .muted { margin-left: auto; color: var(--sub); font-size: 12px; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: var(--purple); flex-shrink: 0; }

/* Board */
.content { flex: 1; overflow: auto; padding: 16px; }
.board { display: flex; gap: 10px; align-items: flex-start; min-height: 100%; }
.column {
  background: var(--col); border-radius: 5px; width: 230px; flex-shrink: 0;
  padding: 8px; max-height: calc(100vh - 120px); overflow-y: auto;
}
.col-head {
  font-size: 11px; font-weight: 700; color: var(--sub); text-transform: uppercase;
  padding: 4px 6px 10px; letter-spacing: 0.5px; position: sticky; top: 0; background: var(--col);
}
.card {
  background: var(--card); border-radius: var(--radius); box-shadow: var(--shadow);
  padding: 8px 10px; margin-bottom: 8px; cursor: pointer;
}
.card:hover { background: #fafbfc; }
.card .title { font-size: 13px; line-height: 1.35; margin-bottom: 8px; }
.card .meta { display: flex; align-items: center; gap: 6px; }
.type-icon {
  width: 16px; height: 16px; border-radius: 2px; color: #fff; font-size: 10px;
  font-weight: 800; display: inline-flex; align-items: center; justify-content: center;
}
.type-icon.story { background: var(--green); }
.type-icon.bug { background: var(--red); }
.type-icon.release { background: var(--purple); }
.type-icon.task { background: var(--blue); }
.card .key { color: var(--sub); font-size: 12px; font-weight: 600; }
.card .meta .right { margin-left: auto; display: flex; align-items: center; gap: 6px; }
.avatar {
  width: 22px; height: 22px; border-radius: 50%; background: var(--blue-dark);
  color: #fff; font-size: 9px; font-weight: 700; display: inline-flex;
  align-items: center; justify-content: center;
}
.progress { height: 4px; background: var(--col); border-radius: 2px; margin-top: 8px; }
.progress > div { height: 100%; background: var(--blue); border-radius: 2px; }
.chip {
  font-size: 11px; font-weight: 600; border-radius: 3px; padding: 1px 6px;
  background: var(--col); color: var(--sub);
}
.chip.warn { background: #fff0b3; color: #7f5f01; }
.chip.locked { background: #eae6ff; color: var(--purple); }

/* Screens & panels */
.screen { max-width: 980px; }
.screen h2 { margin: 4px 0 16px; font-size: 20px; }
.panel {
  background: #fff; border: 1px solid var(--line); border-radius: 5px;
  padding: 16px; margin-bottom: 14px;
}
.panel h3 { margin: 0 0 4px; font-size: 16px; }
.panel .sub { color: var(--sub); font-size: 12.5px; margin-bottom: 10px; }
.row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.row .right { margin-left: auto; }
.pill {
  font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 10px;
  background: var(--blue-light); color: var(--blue); text-transform: uppercase;
}
table.table { width: 100%; border-collapse: collapse; }
.table th {
  text-align: left; font-size: 11px; color: var(--sub); text-transform: uppercase;
  padding: 6px 8px; border-bottom: 2px solid var(--line);
}
.table td { padding: 7px 8px; border-bottom: 1px solid var(--line); font-size: 13.5px; }
.table td.num, .table th.num { text-align: right; font-variant-numeric: tabular-nums; }
.pos { color: var(--green); font-weight: 600; }
.neg { color: var(--red); font-weight: 600; }

/* Report card grid */
.report-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }
.metric {
  background: var(--bg); border-radius: 4px; padding: 10px; text-align: center;
}
.metric .big { font-size: 20px; font-weight: 700; }
.metric .lbl { font-size: 11px; color: var(--sub); text-transform: uppercase; margin-top: 2px; }

/* Modals */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(9, 30, 66, 0.54); display: flex;
  align-items: flex-start; justify-content: center; padding: 60px 16px; z-index: 10;
  overflow-y: auto;
}
.modal {
  background: #fff; border-radius: 5px; width: 640px; max-width: 100%;
  padding: 20px 24px; box-shadow: 0 8px 28px rgba(9, 30, 66, 0.35);
}
.modal h3 { margin: 0 0 2px; }
.modal .foot { display: flex; justify-content: flex-end; gap: 8px; margin-top: 18px; }
select.assign {
  width: 100%; padding: 8px; border: 1px solid var(--line); border-radius: var(--radius);
  background: #fff; font: inherit;
}

/* Game over */
.gameover-backdrop {
  position: fixed; inset: 0; background: rgba(9, 30, 66, 0.85); display: flex;
  align-items: center; justify-content: center; z-index: 20; padding: 16px;
}
.gameover {
  background: #fff; border-radius: 8px; padding: 32px; width: 520px; max-width: 100%;
  text-align: center;
}
.gameover .skull { font-size: 56px; }
.gameover .score { font-size: 34px; font-weight: 800; margin: 6px 0; }
.share-box {
  text-align: left; background: var(--bg); border-radius: 5px; padding: 12px;
  font-family: ui-monospace, Menlo, monospace; font-size: 12.5px; white-space: pre-wrap;
  margin: 14px 0;
}
.howto ul { margin: 10px 0 0; padding-left: 20px; line-height: 1.7; }
```

- [ ] **Step 4: Create `src/ui/components/TopBar.tsx`**

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
      <div className={`stat-chip ${s.cash < 5000 ? 'low' : ''}`}>{fmtMoney(s.cash)}</div>
      <div className="stat-chip">{cwLabel(s.weekIndex)}</div>
      <button className="btn primary" onClick={onEndWeek} disabled={s.status !== 'playing'}>
        End Week ▸
      </button>
    </header>
  );
}
```

- [ ] **Step 5: Create `src/ui/components/Sidebar.tsx`**

```tsx
// src/ui/components/Sidebar.tsx
import { useGame } from '../store';
import { fmtPlayers } from '../format';
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
  const pending = s.inbox.filter((i) => i.status === 'pending').length;
  const nav = (id: Screen, label: string, badge?: number) => (
    <button
      className={`nav-item ${screen === id ? 'active' : ''}`}
      onClick={() => setScreen(id)}
    >
      {label}
      {badge ? <span className="badge">{badge}</span> : null}
    </button>
  );
  return (
    <aside className="sidebar">
      <div className="nav-head">Studio</div>
      {nav('board', '📋 Board')}
      {nav('releases', '📦 Releases')}
      {nav('inbox', '📨 Inbox', pending)}
      {nav('team', '👥 Team')}
      {nav('market', '🛒 Market')}
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
            <span className="dot" />
            {g.name} {stale ? '🔻' : ''}
            <span className="muted">{g.players > 0 ? fmtPlayers(g.players) : 'dev'}</span>
          </button>
        );
      })}
    </aside>
  );
}
```

- [ ] **Step 6: Replace `src/ui/App.tsx`** (screens land in Tasks 17-19; reference them now and create placeholder files in this step so the build stays green)

```tsx
// src/ui/App.tsx
import { useState } from 'react';
import { StoreProvider, useDispatch, useGame } from './store';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Board } from './components/Board';
import { TicketModal } from './components/TicketModal';
import { WeeklyReportModal } from './components/WeeklyReportModal';
import { HowToPlayModal } from './components/HowToPlayModal';
import { GameOverScreen } from './components/GameOverScreen';
import { ReleasesScreen } from './screens/ReleasesScreen';
import { TeamScreen } from './screens/TeamScreen';
import { MarketScreen } from './screens/MarketScreen';
import { InboxScreen } from './screens/InboxScreen';

export type Screen = 'board' | 'releases' | 'team' | 'market' | 'inbox';
const HELP_KEY = 'full-rollout-help-seen';

function Shell() {
  const s = useGame();
  const d = useDispatch();
  const [screen, setScreen] = useState<Screen>('board');
  const [gameFilter, setGameFilter] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [showHelp, setShowHelp] = useState(() => !localStorage.getItem(HELP_KEY));

  return (
    <div className="app">
      <TopBar onEndWeek={() => { d.week(); setShowReport(true); }} />
      <div className="body">
        <Sidebar
          screen={screen} setScreen={setScreen}
          gameFilter={gameFilter} setGameFilter={setGameFilter}
        />
        <main className="content">
          {screen === 'board' && <Board gameFilter={gameFilter} onOpen={setOpenTicket} />}
          {screen === 'releases' && <ReleasesScreen />}
          {screen === 'team' && <TeamScreen />}
          {screen === 'market' && <MarketScreen />}
          {screen === 'inbox' && <InboxScreen />}
        </main>
      </div>
      {openTicket && <TicketModal ticketKey={openTicket} onClose={() => setOpenTicket(null)} />}
      {showReport && <WeeklyReportModal onClose={() => setShowReport(false)} />}
      {showHelp && (
        <HowToPlayModal
          onClose={() => { localStorage.setItem(HELP_KEY, '1'); setShowHelp(false); }}
        />
      )}
      {s.status === 'bankrupt' && !showReport && <GameOverScreen />}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
```

Placeholder files to create **in this same step** so imports resolve (each is replaced by its real task):

```tsx
// src/ui/components/Board.tsx (placeholder — Task 17)
export function Board(_: { gameFilter: string | null; onOpen: (k: string) => void }) {
  return <div>Board…</div>;
}
```
```tsx
// src/ui/components/TicketModal.tsx (placeholder — Task 17)
export function TicketModal(_: { ticketKey: string; onClose: () => void }) {
  return null;
}
```
```tsx
// src/ui/components/WeeklyReportModal.tsx (placeholder — Task 18)
export function WeeklyReportModal(_: { onClose: () => void }) {
  return null;
}
```
```tsx
// src/ui/components/HowToPlayModal.tsx (placeholder — Task 20)
export function HowToPlayModal(_: { onClose: () => void }) {
  return null;
}
```
```tsx
// src/ui/components/GameOverScreen.tsx (placeholder — Task 20)
export function GameOverScreen() {
  return null;
}
```
```tsx
// src/ui/screens/ReleasesScreen.tsx (placeholder — Task 18)
export function ReleasesScreen() {
  return <div>Releases…</div>;
}
```
```tsx
// src/ui/screens/TeamScreen.tsx (placeholder — Task 19)
export function TeamScreen() {
  return <div>Team…</div>;
}
```
```tsx
// src/ui/screens/MarketScreen.tsx (placeholder — Task 19)
export function MarketScreen() {
  return <div>Market…</div>;
}
```
```tsx
// src/ui/screens/InboxScreen.tsx (placeholder — Task 19)
export function InboxScreen() {
  return <div>Inbox…</div>;
}
```

(The TS underscore-parameter convention keeps `noUnusedParameters` quiet in placeholders.)

- [ ] **Step 7: Verify**

Run: `npm run build`
Expected: success.

Run: `npm run dev` — open the printed URL. Expected: blue Jira-style top bar with cash `$50,000` and `CW 24/2026`, sidebar listing two fictional games, placeholder board area. Clicking **End Week ▸** advances the CW chip and cash changes (report modal is still a placeholder).

- [ ] **Step 8: Commit**

```bash
git add src/ui src/engine && git commit -m "feat(ui): store, Jira theme, app shell, top bar, sidebar"
```

---

### Task 17: Board, ticket cards, ticket modal

**Files:**
- Replace: `src/ui/components/Board.tsx`, `src/ui/components/TicketCard.tsx` (new), `src/ui/components/TicketModal.tsx`

- [ ] **Step 1: Create `src/ui/components/TicketCard.tsx`**

```tsx
// src/ui/components/TicketCard.tsx
import { useGame } from '../store';
import { cwLabel } from '../../engine';
import { initials } from '../format';
import type { Ticket } from '../../engine';

const TYPE_META: Record<Ticket['type'], { cls: string; letter: string }> = {
  Story: { cls: 'story', letter: 'S' },
  Bug: { cls: 'bug', letter: 'B' },
  'Release Ticket': { cls: 'release', letter: 'R' },
  Task: { cls: 'task', letter: 'T' },
};

export function TicketCard({ t, onOpen }: { t: Ticket; onOpen: (k: string) => void }) {
  const s = useGame();
  const assignee = t.assigneeId ? s.team.find((m) => m.id === t.assigneeId) : null;
  const meta = TYPE_META[t.type];
  const lockedInRelease = s.releases.some(
    (r) => r.status !== 'decided' && r.ticketKeys.includes(t.key),
  );
  const devProgress =
    t.status === 'IN_DEVELOPMENT' && t.pointsWorked > 0
      ? Math.round(((t.phaseEffort - t.effort) / t.phaseEffort) * 100)
      : null;
  return (
    <div className="card" onClick={() => onOpen(t.key)}>
      <div className="title">{t.title}</div>
      <div className="meta">
        <span className={`type-icon ${meta.cls}`}>{meta.letter}</span>
        <span className="key">{t.key}</span>
        {t.deadlineWeek !== null && <span className="chip warn">⏰ {cwLabel(t.deadlineWeek)}</span>}
        {lockedInRelease && t.status === 'QA_COMPLETE' && <span className="chip locked">📦 in release</span>}
        <span className="right">
          {assignee && <span className="avatar" title={assignee.name}>{initials(assignee.name)}</span>}
        </span>
      </div>
      {devProgress !== null && (
        <div className="progress"><div style={{ width: `${devProgress}%` }} /></div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/ui/components/Board.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace `src/ui/components/TicketModal.tsx`**

```tsx
// src/ui/components/TicketModal.tsx
import { useDispatch, useGame } from '../store';
import { signedPct, signedNum } from '../format';

export function TicketModal({ ticketKey, onClose }: { ticketKey: string; onClose: () => void }) {
  const s = useGame();
  const d = useDispatch();
  const t = s.tickets.find((x) => x.key === ticketKey);
  if (!t) return null;
  const game = s.games.find((g) => g.id === t.gameId);
  const devs = s.team.filter((m) => m.role === 'Developer');
  const assignable = t.type !== 'Release Ticket' && (t.status === 'TODO' || t.status === 'IN_DEVELOPMENT');
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{t.title}</h3>
        <p className="sub">
          {t.key} · {t.type} · {game?.name} · {t.status.replaceAll('_', ' ')}
        </p>
        {t.type === 'Story' && (
          <p>
            Predicted impact: 💰 {signedPct(t.predictedImpact.revenuePct)} revenue,
            ⭐ {signedNum(t.predictedImpact.ratingBonus)} rating
            <br />
            <span className="sub">(predictions can lie — you'll see the truth in the report card)</span>
          </p>
        )}
        <p>
          Effort: {t.phaseEffort - t.effort}/{t.phaseEffort} points done
          {t.hiddenBugs > 0 ? ' · ' : ''}
          {/* hidden bugs stay hidden — never render t.hiddenBugs! */}
        </p>
        {assignable && (
          <select
            className="assign"
            value={t.assigneeId ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') d.act({ type: 'unassign', ticketKey: t.key });
              else d.act({ type: 'assign', ticketKey: t.key, memberId: v });
            }}
          >
            <option value="">Unassigned</option>
            {devs.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name} {'⭐'.repeat(m.skill)}{m.ticketKey && m.ticketKey !== t.key ? ' — busy (will switch)' : ''}
              </option>
            ))}
          </select>
        )}
        {t.status === 'QA_COMPLETE' && <p className="sub">Waiting to be bundled into the next release (Releases screen).</p>}
        <div className="foot">
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
```

Note the comment in the effort line: **hidden bug counts must never be rendered** — they're the game's hidden information.

- [ ] **Step 4: Verify**

Run: `npm run build` — expected: success.
Dev server: board shows the starter tickets in To Do; opening a ticket shows the modal; assigning a dev moves the card to In Development instantly; End Week progresses it through Awaiting QA → In QA → QA Complete over a few weeks.

- [ ] **Step 5: Commit**

```bash
git add src/ui && git commit -m "feat(ui): kanban board, Jira-style ticket cards, ticket modal with assignment"
```

---

### Task 18: Releases screen + weekly report modal

**Files:**
- Replace: `src/ui/screens/ReleasesScreen.tsx`, `src/ui/components/WeeklyReportModal.tsx`

- [ ] **Step 1: Replace `src/ui/screens/ReleasesScreen.tsx`**

```tsx
// src/ui/screens/ReleasesScreen.tsx
import { useDispatch, useGame } from '../store';
import { canCutRelease, qaCompleteFor } from '../../engine';
import { fmtMoney, fmtPlayers, stars, HAPPY, signedPct, signedNum } from '../format';
import type { Release } from '../../engine';

function ReportCardView({ r }: { r: Release }) {
  const card = r.reportCard!;
  const h = HAPPY[card.happiness];
  return (
    <div className="report-grid">
      <div className="metric"><div className="big">{h.emoji}</div><div className="lbl">{h.label}</div></div>
      <div className="metric"><div className="big">🐛 {card.bugReports}</div><div className="lbl">Bug reports</div></div>
      <div className="metric">
        <div className={`big ${card.revenueImpactPct >= 0 ? 'pos' : 'neg'}`}>{signedPct(card.revenueImpactPct)}</div>
        <div className="lbl">Revenue</div>
      </div>
      <div className="metric">
        <div className={`big ${card.ratingDelta >= 0 ? 'pos' : 'neg'}`}>{signedNum(card.ratingDelta)}★</div>
        <div className="lbl">Rating</div>
      </div>
    </div>
  );
}

export function ReleasesScreen() {
  const s = useGame();
  const d = useDispatch();
  return (
    <div className="screen">
      <h2>Releases</h2>
      {s.games.map((g) => {
        const pending = s.releases.find((r) => r.gameId === g.id && r.status !== 'decided');
        const history = s.releases.filter((r) => r.gameId === g.id && r.status === 'decided').slice(-5).reverse();
        const check = canCutRelease(s, g.id);
        const ready = qaCompleteFor(s, g.id).length;
        return (
          <div className="panel" key={g.id}>
            <div className="row">
              <h3>{g.name}</h3>
              <span className="pill">{g.genre}</span>
              <span className="sub">v{g.version}</span>
              <span className="right sub">
                {g.players > 0
                  ? <>👤 {fmtPlayers(g.players)} · {stars(g.rating)} · {fmtMoney(Math.round(g.players * g.revenuePerPlayer))}/wk</>
                  : 'in development — no players yet'}
              </span>
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <span className="sub">{ready} ticket(s) ready for release</span>
              <span className="right">
                <button
                  className="btn blue"
                  disabled={!check.ok}
                  title={check.ok ? '' : check.reason}
                  onClick={() => d.act({ type: 'cutRelease', gameId: g.id })}
                >
                  Cut Release{check.nextVersion ? ` v${check.nextVersion}` : ''}
                </button>
              </span>
            </div>
            {pending && (
              <div style={{ marginTop: 12 }}>
                <strong>{pending.cwLabel} / {pending.version}</strong>
                {pending.status === 'cutting' && (
                  <p className="sub">🚧 Release manager is on it — soft launch goes out this week.</p>
                )}
                {pending.status === 'soft' && !pending.reportCard && (
                  <p className="sub">📡 Live at 10%. The report card lands next week.</p>
                )}
                {pending.status === 'soft' && pending.reportCard && (
                  <>
                    <ReportCardView r={pending} />
                    <div className="row">
                      <button className="btn green" onClick={() => d.act({ type: 'fullRollout', releaseId: pending.id })}>
                        ✅ Full Rollout
                      </button>
                      <button className="btn red" onClick={() => d.act({ type: 'pullBack', releaseId: pending.id })}>
                        ↩️ Pull Back & Fix
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {history.length > 0 && (
              <p className="sub" style={{ marginTop: 12 }}>
                History: {history.map((r) => `${r.decision === 'full' ? '✅' : '↩️'} ${r.version}`).join(' · ')}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/ui/components/WeeklyReportModal.tsx`**

```tsx
// src/ui/components/WeeklyReportModal.tsx
import { useGame } from '../store';
import { fmtMoney } from '../format';

export function WeeklyReportModal({ onClose }: { onClose: () => void }) {
  const s = useGame();
  const r = s.lastReport;
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
          <button className="btn blue" onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build` — success. Dev server: play a few weeks — assign devs, get a ticket to QA Complete, cut a release from the Releases screen, see "🚧", next week "📡", the week after a 4-metric report card with working Full Rollout / Pull Back buttons. End Week always pops the weekly report with a cash breakdown.

- [ ] **Step 4: Commit**

```bash
git add src/ui && git commit -m "feat(ui): releases screen with report cards and rollout decisions; weekly report modal"
```

---

### Task 19: Team, Market, Inbox screens

**Files:**
- Replace: `src/ui/screens/TeamScreen.tsx`, `src/ui/screens/MarketScreen.tsx`, `src/ui/screens/InboxScreen.tsx`

- [ ] **Step 1: Replace `src/ui/screens/TeamScreen.tsx`**

```tsx
// src/ui/screens/TeamScreen.tsx
import { useDispatch, useGame } from '../store';
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
            <tr><th>Name</th><th>Role</th><th>Skill</th><th className="num">Salary/wk</th><th>Working on</th></tr>
          </thead>
          <tbody>
            {s.team.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.role}</td>
                <td>{'⭐'.repeat(m.skill)}</td>
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
          <div className="row" key={c.id} style={{ padding: '6px 0' }}>
            <span>{c.name}</span>
            <span className="pill">{c.role}</span>
            <span>{'⭐'.repeat(c.skill)}</span>
            <span className="sub">{fmtMoney(c.salary)}/wk</span>
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

- [ ] **Step 2: Replace `src/ui/screens/MarketScreen.tsx`**

```tsx
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
```

- [ ] **Step 3: Replace `src/ui/screens/InboxScreen.tsx`**

```tsx
// src/ui/screens/InboxScreen.tsx
import { useDispatch, useGame } from '../store';
import { cwLabel } from '../../engine';
import { signedPct } from '../format';
import type { InboxItem } from '../../engine';

const KIND_EMOJI: Record<InboxItem['kind'], string> = {
  feature: '💡', bug: '🐞', opportunity: '🌟', sdk: '🛠️',
};

export function InboxScreen() {
  const s = useGame();
  const d = useDispatch();
  const pending = s.inbox.filter((i) => i.status === 'pending').reverse();
  const tracked = s.inbox.filter((i) => i.kind === 'opportunity' && i.status === 'accepted');
  const resolved = s.inbox.filter((i) => i.status !== 'pending').slice(-6).reverse();
  return (
    <div className="screen">
      <h2>Inbox</h2>
      {pending.length === 0 && <p className="sub">All clear. End the week to see what comes in.</p>}
      {pending.map((i) => (
        <div className="panel" key={i.id}>
          <h3>{KIND_EMOJI[i.kind]} {i.title}</h3>
          <p className="sub">{i.body}</p>
          {i.kind === 'feature' && i.predictedImpact && (
            <p>Predicted: 💰 {signedPct(i.predictedImpact.revenuePct)} revenue</p>
          )}
          {i.deadlineWeek != null && <p>⏰ Deadline: {cwLabel(i.deadlineWeek)}</p>}
          <div className="row">
            <button className="btn green" onClick={() => d.act({ type: 'acceptInbox', itemId: i.id })}>
              Accept
            </button>
            {i.kind !== 'sdk' ? (
              <button className="btn" onClick={() => d.act({ type: 'declineInbox', itemId: i.id })}>
                Decline
              </button>
            ) : (
              <span className="sub">mandatory — declining means a fine at the deadline</span>
            )}
          </div>
        </div>
      ))}
      {tracked.length > 0 && (
        <div className="panel">
          <h3>Tracked goals</h3>
          {tracked.map((i) => (
            <p key={i.id} className="sub">
              🌟 {i.title} — full rollout by {cwLabel(i.deadlineWeek!)}
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

- [ ] **Step 4: Verify**

Run: `npm run build` — success. Dev server: hire a candidate (cash drops, roster grows), buy a game (appears in sidebar with starter tickets on the board), start a new game (0 players, "dev" tag in sidebar), accept/decline inbox items (SDK items have no decline).

- [ ] **Step 5: Commit**

```bash
git add src/ui && git commit -m "feat(ui): team, market, and inbox screens"
```

---

### Task 20: Game over, score sharing, how-to-play

**Files:**
- Replace: `src/ui/components/GameOverScreen.tsx`, `src/ui/components/HowToPlayModal.tsx`

- [ ] **Step 1: Replace `src/ui/components/GameOverScreen.tsx`**

```tsx
// src/ui/components/GameOverScreen.tsx
import { useState } from 'react';
import { useDispatch, useGame } from '../store';
import { companyValue, cwLabel } from '../../engine';
import { fmtMoney } from '../format';

export function GameOverScreen() {
  const s = useGame();
  const d = useDispatch();
  const [copied, setCopied] = useState(false);
  const value = companyValue(s);
  const rollouts = s.releases.filter((r) => r.decision === 'full').length;
  const shareText = [
    '🚀 Full Rollout — bankrupt!',
    `🏢 Final company value: ${fmtMoney(value)}`,
    `📅 Survived ${s.weekIndex} weeks (CW 24/2026 → ${cwLabel(s.weekIndex)})`,
    `🎮 ${s.games.length} games · ✅ ${rollouts} full rollouts`,
    `Play: ${location.href}`,
  ].join('\n');
  return (
    <div className="gameover-backdrop">
      <div className="gameover">
        <div className="skull">💀</div>
        <h2>The studio is bankrupt</h2>
        <div className="score">{fmtMoney(value)}</div>
        <p className="sub">
          final company value · {s.weekIndex} weeks · {s.games.length} games · {rollouts} full rollouts
        </p>
        {s.log.length > 0 && (
          <p className="sub">{s.log.slice(-3).join(' · ')}</p>
        )}
        <div className="share-box">{shareText}</div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button
            className="btn blue"
            onClick={() => {
              navigator.clipboard.writeText(shareText).then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied!' : '📋 Copy score'}
          </button>
          <button className="btn green" onClick={() => d.restart()}>↻ New studio</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/ui/components/HowToPlayModal.tsx`**

```tsx
// src/ui/components/HowToPlayModal.tsx
export function HowToPlayModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop">
      <div className="modal howto">
        <h3>🚀 Welcome to Full Rollout</h3>
        <p className="sub">You run a mobile game studio. Don't go broke.</p>
        <ul>
          <li>📨 <strong>Inbox:</strong> accept feature requests and bug reports — they become tickets.</li>
          <li>📋 <strong>Board:</strong> assign developers; tickets flow Dev → QA → QA Complete each week.</li>
          <li>📦 <strong>Releases:</strong> bundle QA-complete work, soft-launch to 10%, read the report card.</li>
          <li>✅ <strong>Full Rollout</strong> good releases for growth — pull back bad ones before they tank your rating.</li>
          <li>💸 Stale games decay, salaries are weekly. Ship, grow, buy more games — survive.</li>
        </ul>
        <div className="foot">
          <button className="btn blue" onClick={onClose}>Let's ship</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build` — success. Dev server: first load (or after `localStorage.clear()` in the console) shows the how-to modal once. To preview game over quickly, run a fresh game and end weeks without assigning anyone until cash runs out (or temporarily set `STARTING_CASH` to 1000 — revert after checking). Verify Copy Score writes the emoji block and New studio restarts.

- [ ] **Step 4: Commit**

```bash
git add src/ui && git commit -m "feat(ui): game over with emoji score sharing, how-to-play modal"
```

---

### Task 21: README + deploy to a public URL

**Files:**
- Create: `README.md`
- Modify: `vite.config.ts` (only if the repo name differs from `full-rollout`)

- [ ] **Step 1: Create `README.md`**

```markdown
# 🚀 Full Rollout

A tiny turn-based tycoon about running a mobile game studio, played on a
suspiciously familiar-looking Kanban board. Assign devs, survive QA, cut
releases, soft-launch to 10%, read the report card — and only then decide:
**full rollout, or pull back and fix?** Stale games decay, salaries tick
weekly, and the inbox never stops. Don't go broke.

**Play:** _(deploy URL goes here after Step 3)_

## Dev

- `npm install`
- `npm run dev` — local dev server
- `npm test` — engine test suite (the whole game logic is a pure, seeded engine)
- `npm run build` — static production build in `dist/`

Built with Vite + React + TypeScript. Saves live in your browser's localStorage.
```

- [ ] **Step 2: Verify the full suite and build one last time**

Run: `npm test && npm run build`
Expected: all tests pass, build succeeds.

- [ ] **Step 3: Deploy**

Preferred path — GitHub Pages via `gh` (check auth first):

```bash
gh auth status                       # must be logged in; if not, fall back below
git add -A && git commit -m "docs: README"
gh repo create full-rollout --public --source=. --push
npx gh-pages -d dist                 # pushes dist/ to the gh-pages branch
gh api "repos/{owner}/full-rollout/pages" -X POST \
  -F "source[branch]=gh-pages" -F "source[path]=/" 2>/dev/null || true  # 409 = already enabled, fine
```

The URL is `https://<github-username>.github.io/full-rollout/`. Pages can take a minute on first deploy — poll until it's live:

```bash
curl -s -o /dev/null -w "%{http_code}" https://<github-username>.github.io/full-rollout/
```

Expected: `200` (retry a few times if `404` at first).

Contingencies:
- **Repo name taken** → use `full-rollout-game`, AND update `base` in `vite.config.ts` to `'/full-rollout-game/'`, rebuild, redeploy.
- **`gh` not authenticated** → try `npx vercel --prod --yes` (zero config, prints a URL; requires a logged-in Vercel CLI). If neither tool is authenticated, stop and ask the user which host to log into.

- [ ] **Step 4: Stamp the URL into the README and ship it**

Replace the `_(deploy URL goes here…)_` line in `README.md` with the live URL, then:

```bash
git add README.md && git commit -m "docs: add live URL" && git push
npx gh-pages -d dist   # only if dist changed since the previous deploy
```

- [ ] **Step 5: Final verification**

Open the live URL in a browser: the game loads, how-to modal appears, End Week works, a full play loop (assign → QA → cut → report card → full rollout) functions, and a hard refresh restores the save from localStorage.

Deliverable to the user: **the live URL.**

---

## Plan self-review notes (already applied)

- Spec coverage: §1-§12 of the spec all map to tasks (loop→T6-14, board/tickets→T5/T17, team→T12/T19, releases→T9-10/T18, portfolio→T12/T19, inbox→T13/T19, economy→T11, UI→T16-20, architecture→T2-15, testing→throughout, deploy→T21, out-of-scope honored).
- Type names are defined once in T3 (`types.ts`) and used verbatim everywhere; `releaseTicketKey` is added in T8 before any Release object is constructed (T9).
- No TBDs; every code step contains the actual code.
