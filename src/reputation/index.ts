// TycoonOS — Reputation / BrandState
// Generic brand-health model: a 0-100 score plus an incident log + gentle
// recovery toward a baseline. Games push incidents when bad things happen
// (recalls, scandals, bad reviews), push boosts when good things happen
// (awards, viral moments, milestone ships), and read the score to modulate
// pricing / demand / press tone.
//
// Cross-cuts with press + events — games typically fire a press headline
// from inside resolve() when an incident hits, and read the score to weight
// scoring-entrant metrics in recognition.

import type { TickPhase } from '../tick/index.js';

/** Severity buckets — map to default score impacts. Games override per-incident if needed. */
export type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical';

/** A boost — the positive-impact counterpart to an incident. */
export type BoostKind = 'award' | 'milestone' | 'press' | 'other';

/** One logged incident. */
export interface IncidentRecord {
  id: string;
  day: number;
  severity: IncidentSeverity;
  description: string;
  /** Signed impact applied to the score — negative for incidents. */
  scoreDelta: number;
}

/** One logged positive event. */
export interface BoostRecord {
  id: string;
  day: number;
  kind: BoostKind;
  description: string;
  /** Positive impact applied to the score. */
  scoreDelta: number;
}

/**
 * Per-entity brand state. A game can hold one for the player, and optionally
 * one per rival (promoting `rival.reputation: number` ad-hoc to a real state
 * object if the rival side needs incident tracking too).
 */
export interface BrandState {
  /** Display name — useful for press integration. */
  name: string;
  /** 0–100. 50 is "neutral." */
  score: number;
  /** The target the score drifts back toward. Usually 50. */
  baseline: number;
  /** Pace of drift toward baseline per tick. Small, e.g. 0.05. */
  recoveryRate: number;
  /** Min/max clamps. Default [0, 100]. */
  minScore: number;
  maxScore: number;
  /** Absolute game day of the last incident. Null if none yet. */
  lastIncidentDay: number | null;
  /** Ring buffer of incidents (newest last), capped by `maxLog`. */
  incidents: IncidentRecord[];
  /** Ring buffer of boosts (newest last). */
  boosts: BoostRecord[];
  /** Cap on combined incident + boost log length. */
  maxLog: number;
}

// ─── Defaults ───────────────────────────────────────────────────────────

/** Default score impacts per severity bucket. Games can override per-incident. */
export const DEFAULT_SEVERITY_DELTA: Record<IncidentSeverity, number> = {
  minor: -2,
  moderate: -5,
  major: -12,
  critical: -25,
};

/** Default score impacts per boost kind. */
export const DEFAULT_BOOST_DELTA: Record<BoostKind, number> = {
  award: 4,
  milestone: 2,
  press: 1.5,
  other: 1,
};

// ─── State init ─────────────────────────────────────────────────────────

export interface CreateBrandStateInput {
  name: string;
  /** Initial score. Default 50. */
  initialScore?: number;
  /** Long-run attractor. Default 50. */
  baseline?: number;
  /** Drift per tick back toward baseline. Default 0.05 (small; fast enough to
   *  recover from minor dings, slow enough that critical incidents linger). */
  recoveryRate?: number;
  /** Clamps. Default [0, 100]. */
  minScore?: number;
  maxScore?: number;
  /** Log cap. Default 20. */
  maxLog?: number;
}

export function createBrandState(input: CreateBrandStateInput): BrandState {
  return {
    name: input.name,
    score: input.initialScore ?? 50,
    baseline: input.baseline ?? 50,
    recoveryRate: input.recoveryRate ?? 0.05,
    minScore: input.minScore ?? 0,
    maxScore: input.maxScore ?? 100,
    lastIncidentDay: null,
    incidents: [],
    boosts: [],
    maxLog: input.maxLog ?? 20,
  };
}

// ─── Recording incidents + boosts ───────────────────────────────────────

export interface RecordIncidentInput {
  id?: string;
  day: number;
  severity: IncidentSeverity;
  description: string;
  /** Override the default severity→delta mapping. */
  scoreDelta?: number;
}

export function recordIncident(state: BrandState, input: RecordIncidentInput): IncidentRecord {
  const delta = input.scoreDelta ?? DEFAULT_SEVERITY_DELTA[input.severity];
  const record: IncidentRecord = {
    id: input.id ?? `inc-${input.day}-${state.incidents.length}`,
    day: input.day,
    severity: input.severity,
    description: input.description,
    scoreDelta: delta,
  };
  state.score = clamp(state.score + delta, state.minScore, state.maxScore);
  state.lastIncidentDay = input.day;
  state.incidents.push(record);
  trimLog(state);
  return record;
}

export interface RecordBoostInput {
  id?: string;
  day: number;
  kind: BoostKind;
  description: string;
  /** Override the default kind→delta mapping. */
  scoreDelta?: number;
}

export function recordBoost(state: BrandState, input: RecordBoostInput): BoostRecord {
  const delta = input.scoreDelta ?? DEFAULT_BOOST_DELTA[input.kind];
  const record: BoostRecord = {
    id: input.id ?? `bst-${input.day}-${state.boosts.length}`,
    day: input.day,
    kind: input.kind,
    description: input.description,
    scoreDelta: delta,
  };
  state.score = clamp(state.score + delta, state.minScore, state.maxScore);
  state.boosts.push(record);
  trimLog(state);
  return record;
}

// ─── Recovery + drift ───────────────────────────────────────────────────

/**
 * Drift score toward baseline by `recoveryRate`. Meant to run every tick.
 * Mutates. No-op when score is already at baseline.
 */
export function driftToBaseline(state: BrandState): void {
  if (state.score === state.baseline) return;
  const gap = state.baseline - state.score;
  const step = Math.sign(gap) * Math.min(Math.abs(gap), state.recoveryRate);
  state.score = clamp(state.score + step, state.minScore, state.maxScore);
}

// ─── TickPhase factory ──────────────────────────────────────────────────

export interface BrandPhaseConfig<S> {
  /** Read the player's BrandState off game state. */
  getBrandState: (state: S) => BrandState;
  /** Optional: rivals' BrandStates (if the game tracks rival reputation via this module). */
  getRivalBrandStates?: (state: S) => BrandState[];
}

/**
 * Compose a `TickPhase` that drifts all tracked brands toward their baseline
 * each tick. Incident + boost recording happens in game-specific phases
 * (during launches, events, etc.).
 */
export function brandPhase<S>(config: BrandPhaseConfig<S>): TickPhase<S> {
  return (state) => {
    driftToBaseline(config.getBrandState(state));
    if (config.getRivalBrandStates) {
      for (const rival of config.getRivalBrandStates(state)) {
        driftToBaseline(rival);
      }
    }
  };
}

// ─── Internal helpers ───────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function trimLog(state: BrandState): void {
  const total = state.incidents.length + state.boosts.length;
  if (total <= state.maxLog) return;
  // Remove oldest across both logs proportionally — simplest approach is to
  // drop the oldest single record regardless of which list it's in.
  while (state.incidents.length + state.boosts.length > state.maxLog) {
    const oldestIncident = state.incidents[0];
    const oldestBoost = state.boosts[0];
    if (!oldestIncident) {
      state.boosts.shift();
    } else if (!oldestBoost) {
      state.incidents.shift();
    } else if (oldestIncident.day <= oldestBoost.day) {
      state.incidents.shift();
    } else {
      state.boosts.shift();
    }
  }
}
