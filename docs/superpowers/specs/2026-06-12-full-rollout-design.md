# Full Rollout — Design Spec

**Date:** 2026-06-12 · **Status:** Approved pending final review
**Working title:** Full Rollout (rename freely later)

A single-player, turn-based (weekly) studio-tycoon web game that mirrors the GIM Jira Kanban board. The player runs a mobile game studio: triage incoming requests, assign tickets to the team, end the week, cut releases, read soft-launch metrics, and decide on full rollouts — while keeping the company solvent, growing the team, and acquiring new games.

Decisions locked with the user:
- **Player role:** manager/tycoon — the team does the work automatically; the player prioritizes, assigns, and decides.
- **Time:** turn-based; one "End Week" click advances one calendar week (CW).
- **Economy:** money with bankruptcy = game over. Score = company value + weeks survived.
- **Content:** fully fictional game and people names (GIM naming *style* preserved, no real names).
- **No platform concept:** no Android/iOS dimension anywhere (cut during review).
- **Simple metrics:** no industry jargon (no D1/D7, ARPDAU, crash rate) anywhere in the UI — friendly terms only: Players, Weekly revenue, Rating, Player happiness, Bug reports (cut during review).
- **UI language:** English.
- **Tech:** Vite + React + TypeScript static SPA, localStorage saves, deployed to a free static host for a shareable link.

---

## 1. Core loop

Each week has two phases:

**Plan phase** (player acts freely, any order, no time limit):
- Review **Inbox** items: accept/decline feature requests, bug reports, opportunities, mandatory SDK tasks.
- Assign team members to tickets (dropdown in ticket modal; no drag & drop).
- Cut releases (per game, from QA-complete work), decide pending rollouts (Full Rollout / Pull Back & Fix).
- Hire from the candidate market; buy offered games; start a new game (pick genre).

**End Week** (single button) → resolution, fully automatic and deterministic given the RNG seed:
1. Assigned devs progress their tickets; finished dev work moves to AWAITING QA (hidden bugs injected based on dev skill).
2. Player-assigned QA members work their ticket (QA never self-assigns; testing duration is hidden from the UI — v1.1 change); on completion they either catch bugs (ticket bounces back to TO DO with rework effort and a report-line event; caught bugs are removed, uncaught ones stay hidden and roll again on the next QA pass) or pass it to QA COMPLETE (missed bugs stay hidden).
3. Release Managers process releases cut this week → ship to **10% soft launch**; contained tickets move to DONE.
4. Releases soft-launched last week receive their **report card** (visible from now on; rollout decision unlocked).
5. Live games produce revenue; stale games decay; salaries are paid.
6. New week begins: CW advances (year rolls over after CW 52), new inbox items, hire candidates and game offers refresh.
7. **Weekly report modal**: cash delta breakdown, events, newly arrived metrics.
8. If cash < 0 → **bankruptcy** → game-over screen.

## 2. Board & tickets (GIM look-alike)

- Columns: **TO DO → IN DEVELOPMENT → AWAITING QA → IN QA → QA COMPLETE → DONE**.
- Issue types (v1): **Story** (feature), **Bug**, **Release Ticket**, **Task** (mandatory SDK work).
- Keys: `GIM-1`, `GIM-2`, … monotonically increasing.
- Naming mirrors GIM: `{Game} - {description}`; release tickets: `{Game} - CW {cw}/{year} / {version}` (e.g. `Pixel Pop Party - CW 26/2026 / 1.3.0`).
- **Component = game**: sidebar lists games; board filters to all-games or one game.
- Stories/Bugs that reach QA COMPLETE accumulate into the game's **next version**; cutting a release bundles all of a game's QA-complete tickets.
- Versioning: minor bump if the release contains ≥1 Story (1.2.0 → 1.3.0), patch bump if bugfix-only (1.2.0 → 1.2.1).

## 3. Team

| Role | What skill (1–5) does | Notes |
|---|---|---|
| Developer | Speed (points/week) and hidden-bug rate (low skill → more bugs) | One active ticket at a time |
| QA | Bug catch rate and test speed (speed is never shown) | Player-assigned, like devs (v1.1; was auto-pull in v1) |
| Release Manager | Each RM can cut **one release per week** | Rollout decisions are free (player-made) |

- Weekly salary scales with skill. Hiring costs a signing fee of 2× weekly salary; candidates (2–3) refresh weekly. No firing in v1 (YAGNI; add later if balance needs it).
- All people names fictional, generated from name banks.

## 4. Release → metrics → rollout (the heart)

1. **Cut release** (plan phase; needs a free RM and ≥1 QA COMPLETE ticket for that game; max one in-flight release per game). Creates the Release Ticket; that week's resolution ships it to **10% soft launch**.
2. **Next week**, the soft-launch **report card** arrives, derived from hidden release quality + noise, in deliberately friendly terms: **Player happiness** (😍 Loved it / 🙂 Liked it / 😐 Meh / 😡 Hated it), **Bug reports** (🐛 count, driven by missed bugs), **Revenue impact** (💰 ±%), **Rating impact** (⭐ ± stars). Release quality is computed from: average dev skill of contained work, feature–genre fit, **missed bugs** (big penalty), and noise. A soft launch has **no revenue or game-stat effect** — effects apply only on full rollout.
3. Player decides (no deadline, but the game keeps decaying while you wait):
   - **Full Rollout** — effects apply permanently: good quality → players grow, rating/revenue up; bad quality → rating drops, players decline. Triggered from the Releases screen.
   - **Pull Back & Fix** — release is withdrawn; missed bugs become visible Bug tickets in the backlog; the stories' feature impact returns to the game's pending pool, so a future release re-carries it (fixed = better quality next time).
4. **Decay:** a game with no full rollout in the last 6 weeks starts losing players/rating, worsening with staleness. Live-ops pressure is the engine of the game.

## 5. Portfolio, acquisitions, new games

- **Start:** 2 games — one aging former hit (many players, already decaying), one mid-size healthy title.
- **Game offers:** 1–2 per week on the Market screen: fictional name, genre, players, rating, weekly revenue, price ≈ 25× its current weekly revenue (±30% noise). Buying adds the game as a component with 2–3 starter tickets (1 Bug + 2 Stories).
- **Start New Game:** pick a genre (Puzzle, Merge, Word, Arcade, Card, Simulation) → name generated → joins portfolio with 0 players and a 3-Story `1.0.0` chain; first full rollout seeds players proportional to release quality. Costs a fixed **$3,000**.
- **Feature–genre fit:** each Story carries tags; mismatched features (e.g. hardcore monetization in a cozy puzzle) lower release quality, matched ones raise it.
- Name generation: two-word combos from word banks in the GIM style ("Merge Mania", "Cookie Cascade"), with an exclusion list of real GIM game names so none are reproduced.

## 6. Inbox (weekly events, 1–3 from a weighted pool)

| Event | Accept | Decline / ignore |
|---|---|---|
| Feature request (per game, with *predicted* impact — actual is sampled around it, sometimes lies) | Story added to TO DO | Nothing |
| Live bug report | Bug added to TO DO | Game's rating decays, escalates if repeated |
| Opportunity ("featuring if you full-rollout {game} by CW X") | Tracked goal shown in Inbox; player-spike reward applied automatically if met | Nothing |
| Mandatory SDK update (deadline, e.g. 3 weeks) | Task added; fulfilled when it reaches QA COMPLETE (no release needed) | Missed deadline → flat fine |

## 7. Economy (initial balance — all constants live in one tunable module)

- Starting cash **$50,000**; team: Dev(3), Dev(2), QA(3), RM(3) → payroll ≈ $5,000/week.
- Starting portfolio revenue ≈ breakeven with payroll, with decay pushing it negative → the player must ship within the first few weeks.
- Revenue per game per week = `players × revenuePerPlayer` (internal coefficient; the UI only ever shows **Players**, **Weekly revenue**, **Rating**).
- Score (shown on game over + emoji share) = **company value in $** = cash + Σ(players × value coefficient); weeks survived is displayed alongside, not summed into the score.
- Initial formula sketches (tunable constants, not contracts):
  - Dev speed = skill + 1 points/week; Story effort 4–8, Bug 2–4, rework 40% of original.
  - Expected hidden bugs ≈ effort × (6 − skill) × 0.04; QA catch rate per bug ≈ 0.5 + 0.09 × skill.
  - Release quality (0–100) ≈ 55 + 6×avgDevSkill + genreFit(−10..+10) − 12×missedBugs + noise(±5).
  - Report card from quality: happiness tiers (≥75 😍, ≥60 🙂, ≥45 😐, else 😡); bug reports ≈ missed bugs ± noise; revenue impact ≈ (quality − 55)/2 %; rating delta ≈ (quality − 55)/25.

## 8. UI (Jira look, English)

- **Top bar** (Jira blue): logo/title, cash, current CW (`CW 24/2026` start, fixed), primary **End Week** button.
- **Sidebar:** game list (components) for board filtering + screens: **Board, Releases, Team, Market, Inbox** (with badge count).
- **Board:** 6 columns, Jira-style cards — issue-type icon, key, title, assignee avatar chip, effort/progress pips. Click → ticket modal (Jira issue-view-like): description, predicted impact, assign dropdown (role-filtered).
- **Releases screen:** per game — version, players / weekly revenue / rating with trend, pending soft launches with report cards and **Full Rollout / Pull Back & Fix** buttons, release history.
- **Team screen:** roster (role, skill stars, salary, current ticket) + hire candidates.
- **Market screen:** game offers + Start New Game (genre picker).
- **Weekly report modal** after End Week; **game-over screen** with score, run highlights, Wordle-style emoji **Copy Score** block, Restart.
- **First-run "How to play"** modal: ~5 bullets, shown once (localStorage flag).
- Desktop-first, reasonably responsive; no drag & drop in v1.

## 9. Architecture

- **Engine** (`src/engine/`): pure TypeScript, no DOM, no `Date.now`/`Math.random` — a seeded PRNG lives in state. API:
  - `newGame(seed?) → GameState`
  - `applyAction(state, action) → GameState` (plan-phase actions: assign/unassign, acceptInbox, declineInbox, hire, buyGame, startNewGame, cutRelease, fullRollout, pullBack)
  - `endWeek(state) → GameState` (the resolution pipeline of §1)
  - All balance constants in `src/engine/constants.ts`.
- **UI** (`src/ui/`): React components reading state and dispatching actions; a thin store (zustand or useReducer + context — implementer's choice, keep it tiny).
- **Persistence:** autosave full `GameState` JSON to localStorage after every action/week, with `schemaVersion`; corrupt or older-version save → warn + fresh start (no migration machinery in v1).
- **Naming/content data** (`src/engine/data/`): word banks for game names (+ real-GIM exclusion list), people name banks, genre/feature-tag tables, event templates.

## 10. Testing

- **Engine: TDD with vitest.** Deterministic via seed. Core suites: dev progression & column transitions, bug inject/catch/miss, release cut & version bumps, quality → metrics derivation, rollout effects & decay, economy & bankruptcy, inbox effects, save/load roundtrip + corrupt-save guard.
- UI: manual/preview verification in v1 (engine holds all logic; components stay thin).

## 11. Deployment

- Static `vite build` → deploy to GitHub Pages (via `gh` CLI) or Vercel/Netlify — whichever is already authenticated on the machine at implementation time; set Vite `base` accordingly.
- Deliverable: a **public shareable URL** + README with the link and a one-paragraph pitch.

## 12. Explicitly out of scope (v1)

Multiplayer/backend/shared leaderboard · AB Test mechanic · Art Tasks · platform (Android/iOS) concept · morale/burnout/firing · sound · save migrations · mobile-touch polish (responsive only) · real names of games or people.
