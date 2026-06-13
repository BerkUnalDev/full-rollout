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

export const OPPORTUNITY_BODIES = [
  'The platform wants to feature {game}! Ship a full rollout by {deadline} and player numbers will spike.',
  'A creator collab is lined up for {game}. Get a fresh version fully rolled out by {deadline} to ride the wave.',
] as const;

export const NEW_GAME_STORY_TITLES = [
  'Core gameplay loop',
  'First 100 levels',
  'Tutorial & onboarding',
] as const;

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
