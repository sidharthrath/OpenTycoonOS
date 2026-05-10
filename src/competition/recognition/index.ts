// TycoonOS — Recognition / awards + rankings framework
// Generic ceremony mechanic that fires on a cadence (usually yearly), evaluates
// a category's entrants via a game-provided scoring function, and records the
// top-N winners. Results are archived to a history for replay + press integration.
//
// Each game defines categories (Best Flagship, Best Camera, Phone of the Year;
// or Best Academy, Best Teacher, Rank-1 Producer) and the engine handles the
// orchestration + history.

import type { TickPhase, TickContext } from '../../tick/index.js';

/** One category — what's being awarded, who's eligible, how they're scored. */
export interface AwardCategoryDef<S, TEntrant> {
  id: string;
  name: string;
  description?: string;
  /** Pool of entrants for this category (rivals, products, teachers, whatever). */
  getEntrants: (state: S) => readonly TEntrant[];
  /** Score function — higher = better. Ties broken by order in the entrant list. */
  scoreEntrant: (entrant: TEntrant, state: S) => number;
  /** Label derived from an entrant (e.g. rival.name). Used in UI + press. */
  entrantLabel: (entrant: TEntrant) => string;
  /** Stable id derived from an entrant (e.g. rival.id). Used in result records. */
  entrantId: (entrant: TEntrant) => string;
  /** How many top placements to record. Default 1. */
  topN?: number;
}

/** One placement in a category result. */
export interface AwardPlacement {
  /** 1-indexed rank (1 = winner). */
  rank: number;
  entrantId: string;
  entrantLabel: string;
  score: number;
}

/** A resolved category — who won, who else placed. */
export interface AwardResult {
  categoryId: string;
  categoryName: string;
  /** Absolute game day the ceremony happened. */
  day: number;
  /** Top placements sorted by rank (1, 2, 3, …). */
  placements: AwardPlacement[];
}

/** Runtime state — history of past ceremonies. Save-portable. */
export interface RecognitionState {
  /** All results ever, newest last. */
  history: AwardResult[];
  /** Cap on history length. Older entries fall off. */
  maxHistory: number;
}

export function createRecognitionState(maxHistory: number = 20): RecognitionState {
  return { history: [], maxHistory };
}

/**
 * Category type erased over TEntrant so an array can mix categories with
 * different entrant shapes. Each category's own functions still know their
 * TEntrant internally; the engine treats them opaquely at orchestration time.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyAwardCategoryDef<S> = AwardCategoryDef<S, any>;

/**
 * Evaluate all categories against the current state and return the results
 * (does NOT record into history or mutate state). Useful for previews +
 * testing. Use `recordAwards` or `recognitionPhase` to persist.
 *
 * @typeParam S        the game's state shape (must carry `clock.totalDays`)
 */
export function computeAwards<S extends { clock: { totalDays: number } }>(
  state: S,
  categories: readonly AnyAwardCategoryDef<S>[],
): AwardResult[] {
  const day = state.clock.totalDays;
  const results: AwardResult[] = [];
  for (const cat of categories) {
    const entrants = cat.getEntrants(state);
    if (entrants.length === 0) continue;
    const scored = entrants
      .map((e) => ({
        entrant: e,
        id: cat.entrantId(e),
        label: cat.entrantLabel(e),
        score: cat.scoreEntrant(e, state),
      }))
      .sort((a, b) => b.score - a.score);

    const topN = cat.topN ?? 1;
    const placements: AwardPlacement[] = scored.slice(0, topN).map((s, i) => ({
      rank: i + 1,
      entrantId: s.id,
      entrantLabel: s.label,
      score: s.score,
    }));

    results.push({
      categoryId: cat.id,
      categoryName: cat.name,
      day,
      placements,
    });
  }
  return results;
}

/**
 * Append results to the recognition history, trimming to maxHistory.
 * Mutates `recognitionState`.
 */
export function recordAwards(recognitionState: RecognitionState, results: readonly AwardResult[]): void {
  for (const result of results) recognitionState.history.push(result);
  while (recognitionState.history.length > recognitionState.maxHistory) {
    recognitionState.history.shift();
  }
}

/** The most recent ceremony's results (or null if none yet). */
export function latestCeremony(recognitionState: RecognitionState): AwardResult[] | null {
  if (recognitionState.history.length === 0) return null;
  // History can interleave multiple ceremonies over time; grab the most recent day's entries.
  const lastDay = recognitionState.history[recognitionState.history.length - 1].day;
  return recognitionState.history.filter((r) => r.day === lastDay);
}

/** Has a specific entrant ever won a category top-1 placement? */
export function hasEverWon(
  recognitionState: RecognitionState,
  entrantId: string,
  categoryId?: string,
): boolean {
  for (const result of recognitionState.history) {
    if (categoryId && result.categoryId !== categoryId) continue;
    if (result.placements[0]?.entrantId === entrantId) return true;
  }
  return false;
}

// ─── TickPhase factory ──────────────────────────────────────────────────

/** When should a ceremony fire? */
export type CeremonyCadence = 'yearly' | 'quarterly' | 'triggered';

export interface RecognitionPhaseConfig<S extends { clock: { totalDays: number } }> {
  /** Categories to evaluate on each ceremony. Can mix categories with different TEntrant shapes. */
  categories: readonly AnyAwardCategoryDef<S>[];
  /** Read RecognitionState off game state. */
  getRecognitionState: (state: S) => RecognitionState;
  /** When ceremonies fire. Default 'yearly'. */
  cadence?: CeremonyCadence;
  /** Optional callback per category result (good for press headlines). */
  onResult?: (state: S, result: AwardResult) => void;
}

function isCadenceActive(cadence: CeremonyCadence, ctx: TickContext): boolean {
  switch (cadence) {
    case 'yearly':
      return ctx.isNewYear;
    case 'quarterly':
      return ctx.isNewQuarter;
    case 'triggered':
      return false;
  }
}

/**
 * Compose a `TickPhase` that runs the ceremony on matching cadence ticks
 * (default yearly). Records results into history; optionally calls `onResult`
 * per category for press / toast integration.
 *
 * @example
 *   composeTick<State>([
 *     // ...
 *     recognitionPhase({
 *       categories: awardCategories,
 *       getRecognitionState: s => s.recognition,
 *       onResult: (s, result) => pushHeadline(s, {
 *         headline: `${result.categoryName}: ${result.placements[0].entrantLabel}`,
 *         body: `Announced at the annual ceremony. Score: ${result.placements[0].score}.`,
 *         kind: 'awards',
 *       }),
 *     }),
 *     // ...
 *   ]);
 */
export function recognitionPhase<S extends { clock: { totalDays: number } }>(
  config: RecognitionPhaseConfig<S>,
): TickPhase<S> {
  const cadence = config.cadence ?? 'yearly';
  return (state, ctx) => {
    if (!isCadenceActive(cadence, ctx)) return;
    const results = computeAwards(state, config.categories);
    if (results.length === 0) return;
    recordAwards(config.getRecognitionState(state), results);
    if (config.onResult) {
      for (const r of results) config.onResult(state, r);
    }
  };
}
