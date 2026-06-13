# Full Rollout — v2.1 Features Spec

**Date:** 2026-06-13 · **Status:** Approved (chat), proceeding to plan
**Builds on:** v1, v1.1 (manual QA), v2 (studio/tech-debt/RM/employee/reports).

Twelve refinements to the live game. **No save-schema bump** — the only new `GameState` field (`celebration`) is optional, so v2 saves keep loading. All numbers live in `constants.ts`.

---

## 1. Studio treadmill — make upgrading necessary (but never a permanent lock)

**Rising floor (slower):** after the `GATE_GRACE_WEEKS` (=4) grace, the required-level floor for generated **feature & tech-debt** items climbs **+1 every `WEEKS_PER_REQ_BUMP` (=7) weeks**. Eventually the floor exceeds the player's studio level → new inbox feature/tech-debt work is locked until they upgrade.

**Anti-lock guarantee (features only):** each **feature** item has a `FEATURE_ACCESSIBLE_CHANCE` (=0.20) chance to be generated at a level **≤ current studioLevel** (always acceptable). So ~20% of feature requests are always doable regardless of the treadmill — the game can't lock forever. **Tech-debt gets NO such guarantee** (it follows the pure rising floor, so doing tech-debt can require an upgrade). **Bugs are never gated** (unchanged).

`rollRequiredLevel(s, rng, accessibleChance = 0)`:
```
if weekIndex < GATE_GRACE_WEEKS: return 1
if accessibleChance > 0 && rng.chance(accessibleChance): return rng.int(1, studioLevel)   // guaranteed acceptable
timeFloor = 1 + floor((weekIndex - GATE_GRACE_WEEKS) / WEEKS_PER_REQ_BUMP)
floor   = min(CAP, timeFloor)
ceiling = min(CAP, max(studioLevel + LEVEL_WINDOW_ABOVE, floor + LEVEL_WINDOW_SPAN - 1))
span    = ceiling - floor
return floor + min(rng.int(0, span), rng.int(0, span))   // triangular skew toward floor
```
Features call with `FEATURE_ACCESSIBLE_CHANCE`; tech-debt calls with the default `0` (short-circuit `&&` means no extra rng draw for tech-debt).

**Upgrade preconditions:** `upgradeStudio` now requires **cash** (existing `STUDIO_UPGRADE_COSTS`) **AND a minimum games-owned**. `STUDIO_GAME_REQ` (index = current level − 1, the count needed to reach the next level): `[3, 5, 7, 10, 13, 16, 20, 24, 28]`. Throws with a specific reason for each unmet condition. (All requirements ≤ `maxGamesFor(level)` so always satisfiable.)

**Hire capacity per role, gated by studio level:** `roleCapacity(role, level)` → Developer `2 + level`, QA `1 + level`, Release Manager `1 + level`. `hire` throws `At {role} capacity — upgrade the studio to hire more` when that role's headcount is at cap. (L1 caps: Dev 3, QA 2, RM 2 — fits the starting team of 2/1/1 with room.)

## 2. Top-bar team strip (left of the 🏢 level chip)

Per role, show hired/capacity and idle (no current ticket) for Dev/QA: e.g.
`👨‍💻 2/3 ·1 free   🧪 1/2 ·1 free   🚀 1/2`
(RM shows only hired/cap — RMs aren't ticket-assigned.) Derived from `team` + `roleCapacity`.

## 3. Tech debt — hard deadline, no decline, steady cadence

- **Both subtypes get a hard deadline** set at appearance (`s.weekIndex + TECHDEBT_DEADLINE_WEEKS`) and a `fineUsd = TECHDEBT_FINE`. Missing it (unaccepted **or** accepted-but-unfinished by the deadline) → fine, for **both** mandatory and investment. Investment additionally grants **+benefitRevenuePct% revenue on all games** on success.
- **No decline:** `declineInboxItem` throws for `kind === 'techdebt'`. The UI shows only Accept.
- **Deadline starts on appearance** (already true — `deadlineWeek` is stamped at generation and copied to the ticket on accept).
- **Cadence fix:** raise the techdebt weekly weight, and **guarantee a refill** — if no tech-debt is pending/in-flight, generate one with `TECHDEBT_REFILL_CHANCE` (=0.6) each week. Tech-debt never dries up mid-game.

## 4. Inbox tech-debt count badge

The Inbox sidebar nav shows the existing red total-pending badge **plus a second badge** (amber `--yellow`, not red) = count of pending tech-debt items, so the player sees engineering work piling up.

## 5. Fire employees

New `PlanAction { type: 'fireMember'; memberId }`. Pays **severance = `SEVERANCE_WEEKS` (=2) × weekly salary** (instant cash delta), removes the member, and frees their current ticket back to its queue (like unassign). Team-screen roster gets a **Fire** button per member (with the severance amount shown).

## 6. Featuring — cost to accept, clear stakes, celebration

- **Accept costs `FEATURING_ACCEPT_COST` (=$1,500)** (cash delta on accept; opportunities currently cost nothing).
- **Miss = no penalty** (you forfeit the boost; you don't get the accept fee back). Stated explicitly in the UI.
- **Tracking clarity:** the Inbox tracked-goals section shows, per accepted opportunity: `🎯 +X% players if you full-roll {game} by CW Y · ❌ miss = lose the boost (no penalty)`.
- **Celebration popup:** when a full rollout triggers a featuring payout, `applyFullRollout` sets `s.celebration = { title, body }`. A new `PlanAction { type: 'dismissCelebration' }` clears it. The App watches `state.celebration` and shows a 🎉 modal so the win lands immediately (instead of silently going `done`).

## 7. Sell your own games

New `PlanAction { type: 'sellGame'; gameId }`. Sale price = `round(weeklyRevenue × SELL_PRICE_WEEKS)` with `SELL_PRICE_WEEKS` (=18; below buy's 25× — you sell at a discount), minimum `SELL_PRICE_FLOOR` (=$500) for in-dev/0-player games. Throws if the game has an in-flight (non-decided) release. Removes the game and all its tickets; adds cash + delta + event + log. Market screen gets a **"Your games"** panel with a Sell button (price shown) per game.

## 8. Feature-request inbox cap (scales with portfolio)

Cap = `games.length × FEATURE_CAP_PER_GAME` (=5) — 2 games → 10, 3 → 15, etc. **Applies only to `feature` items** (bugs, opportunities, and tech-debt are NOT capped). `generateWeeklyInbox`: when a roll picks `feature` and the pending feature count ≥ that cap, convert it to a bug instead. Inbox UI shows the feature section header as `💡 Feature requests (N/{cap})` and, when full, a note: `Full — decline some to make room for new requests.` Declining now meaningfully unblocks new requests, and growing your portfolio raises the ceiling.

## 9. Game logos

A unique emoji per game, **derived from the game id** (no stored field): `gameLogo(id)` hashes the id into a bank of ~20 distinct emojis. Shown in the **sidebar** (replacing the generic dot) and on every **ticket card** next to the type icon. Pure UI helper.

## 10. New Game button (restart anytime)

A `↻ New game` control in the **sidebar footer**, available during play. Click → `window.confirm('Start a new studio? Current progress is lost.')` → `restart()` (already in the store). Lets the player start fresh without going bankrupt first.

## 11. Weekly report — readable good/bad grouping

The weekly-report modal (and the Reports-history view, which reuses it) splits `events` into **🟢 Good** and **🔴 Needs attention** groups by a positivity check on each line's leading emoji (good: ✅🔧🎉🌟🚀👋🏢🌱📦📊 · bad: ⚠️🚨📉🔁↩️⌛💀). Deltas table stays (already colored). Pure UI; no change to the saved `WeeklyReport` shape.

## 12. Schema / types / scope

`SCHEMA_VERSION` stays **2**. New optional `GameState.celebration?: { title: string; body: string }` (transient; v2 saves lack it → `undefined`, harmless; deserialize sniff unchanged). New `PlanAction` variants: `fireMember`, `sellGame`, `dismissCelebration`. New engine exports: `roleCapacity`, `studioGameRequirement` (or expose the array), plus the UI `gameLogo` helper lives in `src/ui/format.ts`.

**Out of scope (unchanged):** multiplayer/leaderboard, AB tests, art tasks, platform dimension, morale, sound, save migration.

## 13. Testing

Engine via vitest, TDD, deterministic by seed. New/updated suites:
- **studio:** rising-floor cadence (floor rises every 7 wks post-grace), feature accessible-chance yields ≤ studioLevel ~20%, tech-debt has no accessibility guarantee; `studioGameRequirement`; `roleCapacity`; upgrade throws on unmet games/cash/cap.
- **actions:** hire blocked at role cap; fireMember pays severance + frees ticket + removes member; sellGame price/guards/removal; dismissCelebration clears.
- **inbox:** feature cap 10 (converts to bug); tech-debt both-subtypes deadline+fine; decline throws for tech-debt; refill guarantees tech-debt when none active; featuring accept cost deducted.
- **releases:** featuring payout sets `celebration`.
- UI: preview verification + a long autopilot that upgrades, hires to cap, fires, sells, accepts featuring, and confirms no permanent lock (acceptable feature/bug work always exists).
