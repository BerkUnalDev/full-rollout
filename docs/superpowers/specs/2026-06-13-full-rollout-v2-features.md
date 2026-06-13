# Full Rollout — v2 Features Spec

**Date:** 2026-06-13 · **Status:** Approved (chat), proceeding to plan
**Builds on:** `2026-06-12-full-rollout-design.md` (v1) + the v1.1 manual-QA change.

Five additions to the live game ([berkunaldev.github.io/full-rollout](https://berkunaldev.github.io/full-rollout/)): **Studio Level**, **Tech Debt**, **RM-per-star capacity**, **employee info**, and a **detailed weekly report + history**. Bumps the save schema to **v2** (in-progress saves reset to a fresh game on next load — localStorage, no migration, same policy as v1).

All numbers live in `constants.ts` and are tuning knobs, not contracts.

---

## 1. Studio Level

New `GameState.studioLevel: number`, starts **1**, hard cap **10**.

- **Game slots:** `maxGames(level) = level × STUDIO_MAX_GAMES_PER_LEVEL` (=4) → L1:4 … L10:40. `buyGame` and `startNewGame` throw if `games.length >= maxGames(studioLevel)` with reason `Studio level too low — upgrade to manage more games`.
- **Upgrade:** new `PlanAction { type: 'upgradeStudio' }`. **Instant, cash-only**, no week wait. Validates `studioLevel < CAP` and `cash >= STUDIO_UPGRADE_COSTS[studioLevel-1]`; deducts cash (pushes a `CashDelta`), `studioLevel++`, pushes an event + a `log` highlight.
- **Cost curve** `STUDIO_UPGRADE_COSTS` (index = current level − 1; cost to reach the next level), 9 entries L1→2 … L9→10:
  `[4_000, 12_000, 25_000, 45_000, 75_000, 120_000, 180_000, 260_000, 360_000]`
  Cheap tutorial first step, smooth steep ramp matching the revenue a bigger portfolio earns.

### Required-level gate (accept-time)

Every **Feature** and **Tech-Debt** inbox item carries `requiredLevel: number`. **Bugs and Opportunities never carry one.**

- `acceptInboxItem` throws `Requires Studio Level X` if `studioLevel < item.requiredLevel`.
- UI: a locked item shows a **🔒 Studio Lv X** badge and a disabled Accept button (title = reason). Bugs/opportunities always acceptable.

### Dynamic required-level window (the "always a spread of levels" rule)

When generating a feature/tech-debt item:
```
GRACE: if weekIndex < GATE_GRACE_WEEKS (=4) → requiredLevel = 1   (no wall in the opening)
else:
  ceiling = min(STUDIO_LEVEL_CAP, studioLevel + LEVEL_WINDOW_ABOVE)   // ABOVE = 2 (aspirational)
  floor   = max(1, ceiling - LEVEL_WINDOW_SPAN + 1)                   // SPAN = 5 distinct levels
  // triangular skew toward floor → most items accessible, a few aspirational
  requiredLevel = floor + min(rng.int(0, span-1), rng.int(0, span-1)) // span = ceiling - floor + 1
```
Effect: at any studio level the inbox shows a ~5-level spread with the lower (doable) levels always present, reaching up to `studioLevel + 2` to create upgrade pressure. At L1 (post-grace) you see L1–L3 (mostly L1); at L5 you see L3–L7; at L8 you see L6–L10.

---

## 2. Tech Debt — new inbox category 🛠️, studio-wide, skips QA

New `InboxItemKind` value **`'techdebt'`** (replaces the old `'sdk'` kind — SDK work becomes a tech-debt *subtype*). New `TicketType` **`'Tech Debt'`**.

Tech-debt items are **studio-wide**: `gameId = ''`, title carries no game prefix (e.g. `SDK Upgrade 4.2`, `Game Engine v9 Migration`, `AI Automation Pipeline`). On the board they appear under **All games** only; they flow `TODO → IN_DEVELOPMENT → DONE` and **never enter QA**.

Two subtypes (`InboxItem.techSubtype: 'mandatory' | 'investment'`, carried onto the ticket):

| Subtype | Deadline / fine | Success effect | Decline / ignore |
|---|---|---|---|
| **mandatory** (SDK Upgrade, Privacy Compliance, Ad-SDK) | yes — `TECHDEBT_DEADLINE_WEEKS` (=3), `TECHDEBT_FINE` (=$4,000) | obligation cleared, no fine | fine at deadline (existing SDK behavior) |
| **investment** (Game Engine Upgrade, AI Automation Pipeline, Build Pipeline) | none | **permanent +`benefitRevenuePct`% `revenuePerPlayer` on ALL current games**; `benefitRevenuePct` sampled `TECH_INVEST_REVENUE_PCT` (=[3,6]) | nothing |

### Flow & the fail roll (dev stars matter)

Accept → `Tech Debt` ticket (studio-wide, gated by studio level) → player assigns a **Developer** → dev builds it over weeks like a Task (`TECHDEBT_EFFORT` = [4,7]). **On dev completion, a fail roll** (this is the new mechanic — replaces the AWAITING_QA hop for this type):

```
failChance = clamp(TECH_FAIL_BASE − TECH_FAIL_PER_SKILL × devSkill, 0.02, 0.7)
  // TECH_FAIL_BASE = 0.5, TECH_FAIL_PER_SKILL = 0.09
  // devSkill = the completing dev's skill (avg via devSkillSum/pointsWorked); skill 5 ≈ 5%, skill 1 ≈ 41%
```
- **Success:** ticket → `DONE`. Investment: apply `+benefitRevenuePct%` to every game's `revenuePerPlayer`. Mandatory: clear the deadline (no fine). Event `🔧 {title} shipped` (+ benefit detail).
- **Fail:** `⚠️ Technical error: {title} failed — needs rework` event, ticket bounces to **TODO** with rework effort `ceil(effortTotal × TECH_REWORK_FRACTION)` (=0.5), small `TECHDEBT_FAIL_PENALTY` ($500) cash ding. Mandatory items still owe the fine if their deadline then lapses (so a fail near the deadline is dangerous).

### Weekly generation

`generateWeeklyInbox`: keep the kind weights ≈ feature .45 / bug .30 / opportunity .15 / **techdebt .10**. A techdebt roll picks subtype 55% mandatory / 45% investment. **At most one *mandatory* tech-debt in flight** (the existing single-SDK suppression, now scoped to the mandatory subtype). Investment items are not suppressed.

---

## 3. Release Manager — capacity = sum of stars

`canCutRelease`: replace the RM-count check with **RM star capacity**.
```
rmCapacity = Σ (rm.skill for rm where role === 'Release Manager')
cutting    = releases where status === 'cutting'
if (cutting.length >= rmCapacity) → busy ('All release managers are busy this week')
```
A skill-3 RM enables 3 cuts/week; two RMs (2+3) enable 5. The one-in-flight-release-per-game rule is unchanged.

---

## 4. Employee info (hire panel + roster, always visible)

A shared pure helper `memberStats(role, skill)` (engine, exported) returns the human-readable derived stats so UI and tests share one source of truth:

- **Developer:** `buildSpeed = speedOf(skill)` pts/wk; `bugProneness` label from `(6 − skill)` → skill 5 "very low", 4 "low", 3 "medium", 2 "high", 1 "very high".
- **QA:** `testSpeed = speedOf(skill)` pts/wk; `catchRate = round((QA_CATCH_BASE + QA_CATCH_PER_SKILL × skill) × 100)`% (capped 99).
- **Release Manager:** `releasesPerWeek = skill`.

Shown on every **hire candidate** card and every **roster** row: role · ⭐skill · the stat line above · salary/wk.

---

## 5. Weekly report — detail + history

### Detail (named, per-ticket lines)

Resolution pushes **who did what** into `pendingEvents` (so they land in the report):

- Dev finishes build → `✅ {devName} finished {ticketTitle} → QA` (Story/Bug) — pushed from `runDevPhase`.
- Tech-debt resolves → `🔧 {devName} shipped {ticketTitle}` / `⚠️ {devName} hit a technical error on {ticketTitle}` — from `runDevPhase`.
- QA passes → `🔬 {qaName} passed {ticketTitle}` ; QA rejects → `🔁 {qaName} sent {ticketTitle} back for rework` — from `runQaPhase` (rename of the current bounce line, now naming the QA).

Existing economy/release/inbox event lines stay.

### History (last 10)

New `GameState.reportHistory: WeeklyReport[]`. At the end of `endWeek`, after assembling `lastReport`, push it onto `reportHistory` and trim to the most recent `REPORT_HISTORY_CAP` (=10). Small footprint (~a few KB).

New **📜 Reports** screen (sidebar nav): lists the stored reports newest-first (CW label + net cash, colored); clicking one opens it in the existing weekly-report modal layout (reused as a read-only view). The end-of-week modal is unchanged.

---

## 6. Tech-debt info UI (the "?" popover)

On a **Tech Debt** `TicketCard`:
- An inline gist chip when it fits: investment → `🔧 +N% rev (all games)`, mandatory → `⏰ CW X · fine $Y`.
- A small **?** badge (top-right). Clicking it toggles a compact popover anchored to the card showing both outcomes:
  > **If it ships:** {success effect}
  > **If it fails:** bounces back for rework + $500 (lower-skill devs fail more often)
- The `TicketModal` (card click) also shows the same success/fail block prominently.

The fail *chance* is shown qualitatively (tie it to the assigned dev's bug-proneness wording), never as a hidden exact number on un-built work — keep some tension, consistent with the hidden-bug rule.

---

## 7. Schema, types, scope

**`SCHEMA_VERSION = 2`.** New `GameState` fields: `studioLevel`, `reportHistory`. New optional `InboxItem` fields: `requiredLevel?`, `techSubtype?`, `benefitRevenuePct?`. New optional `Ticket` fields: `techSubtype?`, `benefitRevenuePct?`. `TicketType` gains `'Tech Debt'`; `InboxItemKind` swaps `'sdk'` → `'techdebt'`. New `PlanAction`: `upgradeStudio`. `deserialize` rejects v1 saves (version mismatch → fresh game) — verify it also tolerates the new fields on v2 roundtrip.

**Out of scope (unchanged):** multiplayer/leaderboard, AB tests, art tasks, platform dimension, morale/firing, sound, save migration.

---

## 8. Testing

Engine via vitest, TDD, deterministic by seed. New/changed suites:
- **studio:** upgrade cost/level/cap, instant cash deduction, games-cap gate on buy/start, accept-gate throw below requiredLevel.
- **required-level window:** grace forces L1; post-grace window spans ≤5 levels, floor ≥1, ceiling ≤ min(cap, level+2); bugs/opportunities carry none.
- **techdebt:** accept creates a studio-wide Tech Debt ticket; dev completion fail-rolls (seeded: high-skill usually succeeds, low-skill can fail); success applies investment benefit to all games / clears mandatory deadline; fail bounces to TODO with rework + penalty; mandatory deadline fine still applies on lapse.
- **RM capacity:** cuts allowed up to Σ stars; blocked beyond.
- **memberStats:** values for each role/skill.
- **report:** named dev/QA lines present; `reportHistory` accumulates and caps at 10; save roundtrip with history + studioLevel.

UI: preview verification (engine holds all logic; components stay thin), plus a 12-week autopilot determinism check extended to assign QA, do tech-debt, and upgrade the studio.
