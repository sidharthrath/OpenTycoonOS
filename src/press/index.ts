// TycoonOS — Trade Press / Industry News
// Generic headline log + quarterly newspaper generation.
// Extracted from streaming-tycoon's TradeHeadline pattern; replaces the thin
// newspaper/ module from tycoon-engine with a richer, more useful one.

/** Categories used to prioritize + color headlines. Games may extend via their own string literals. */
export type HeadlineKind =
  | 'awards'
  | 'phenomenon'
  | 'bidding'
  | 'competitor'
  | 'milestone'
  | 'launch'
  | 'incident'
  | 'pricing'
  | 'market'
  | 'player';

export interface TradeHeadline {
  id: string;
  /** Absolute day in game time */
  day: number;
  headline: string;
  body: string;
  kind: HeadlineKind | string;
  /** Owner/platform associated with the story (for tinting). 'player' or a competitor id. */
  owner?: string;
  /** Priority for quarterly newspaper selection (higher = more likely to be picked). Defaults by kind. */
  priority?: number;
}

export interface PressState {
  headlines: TradeHeadline[];
  /** Hard cap on headlines retained in state. Older ones roll off. */
  maxLog: number;
  /**
   * Monotonically increasing id counter. Persisted so headline ids stay unique
   * across the run — necessary because `headlines.length` plateaus once eviction
   * kicks in, which would otherwise produce duplicate React keys for two
   * headlines pushed on the same day after the cap is hit.
   */
  nextId: number;
}

export function createPressState(maxLog: number = 40): PressState {
  return { headlines: [], maxLog, nextId: 0 };
}

export interface PushHeadlineInput {
  headline: string;
  body: string;
  kind: HeadlineKind | string;
  owner?: string;
  priority?: number;
}

/** Append a headline + trim to maxLog. Mutates state (Immer-draft compatible). */
export function pushHeadline(
  state: { press: PressState; clock: { totalDays: number } },
  input: PushHeadlineInput,
): void {
  // Defensive: older saves may not have nextId — coerce.
  const id = state.press.nextId ?? 0;
  state.press.nextId = id + 1;
  const entry: TradeHeadline = {
    id: `th-${state.clock.totalDays}-${id}`,
    day: state.clock.totalDays,
    headline: input.headline,
    body: input.body,
    kind: input.kind,
    owner: input.owner,
    priority: input.priority,
  };
  state.press.headlines.push(entry);
  while (state.press.headlines.length > state.press.maxLog) {
    state.press.headlines.shift();
  }
}

/** Default priority per kind — games can override by supplying explicit priority. */
export const DEFAULT_PRIORITY: Record<string, number> = {
  awards: 95,
  phenomenon: 92,
  incident: 90,
  bidding: 80,
  launch: 75,
  pricing: 60,
  competitor: 55,
  milestone: 50,
  market: 40,
  player: 50,
};

/** Pick top-N headlines for a quarterly newspaper, weighted by priority + recency. */
export function pickTopHeadlines(
  press: PressState,
  currentDay: number,
  maxAgeDays: number = 90,
  n: number = 4,
): TradeHeadline[] {
  const recent = press.headlines.filter(h => currentDay - h.day <= maxAgeDays);
  const scored = recent.map(h => {
    const base = h.priority ?? DEFAULT_PRIORITY[h.kind] ?? 40;
    const ageDecay = Math.max(0, 10 - (currentDay - h.day) / (maxAgeDays / 10));
    return { h, score: base + ageDecay };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, n).map(s => s.h);
}
