// src/engine/types.ts
export type Role = 'Developer' | 'QA' | 'Release Manager';
export type TicketType = 'Story' | 'Bug' | 'Release Ticket' | 'Task' | 'Tech Debt';
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
  outWeeks?: number; // >0 = unavailable (vacation/sick) for this many weeks
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
  techSubtype?: TechSubtype; // Tech Debt tickets only
  benefitRevenuePct?: number; // investment tech-debt: +% revenue on success
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
  outageWeeks?: number; // >0 = servers down, $0 revenue for this many weeks
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
  ticketKeys: readonly string[];
  releaseTicketKey: string; // the Release Ticket on the board
  quality: number; // hidden 0-100
  missedBugs: number; // hidden
  impact: Impact; // summed story impact incl. game.pendingImpact at cut
  status: 'cutting' | 'soft' | 'decided';
  shippedWeek: number | null; // weekIndex when soft launch went out
  reportCard: ReportCard | null;
  decision: 'full' | 'pulled' | null;
}

export type InboxItemKind = 'feature' | 'bug' | 'opportunity' | 'techdebt';
export type TechSubtype = 'mandatory' | 'investment';
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
  // sdk/techdebt fields
  fineUsd?: number;
  requiredLevel?: number; // feature & techdebt only (studio-level gate)
  techSubtype?: TechSubtype;
  benefitRevenuePct?: number; // investment subtype
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
  studioLevel: number;
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
  reportHistory: WeeklyReport[]; // most recent first-N (capped)
  celebration?: { title: string; body: string } | null; // transient: featuring win popup
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
  | { type: 'pullBack'; releaseId: string }
  | { type: 'upgradeStudio' }
  | { type: 'fireMember'; memberId: string }
  | { type: 'sellGame'; gameId: string }
  | { type: 'dismissCelebration' };
