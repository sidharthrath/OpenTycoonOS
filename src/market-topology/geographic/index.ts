// TycoonOS — Geographic market topology
// Per-region state + entry mechanics for games with spatial expansion:
// EV rolling into new markets, consumer-hardware expanding country-by-country,
// retail opening city-by-city, airline launching new routes. The engine tracks
// which regions are "entered," their entry day, their per-region market share,
// and enforces game-defined entry gates; games compose regional state with
// segmented demand, geographic pricing, per-region marketing, etc.
//
// Composes with `market-topology/segmented/` — a game can have both topologies
// active (segmented within each region), though for v0.1 simplicity most
// games will start with one.

// ─── Types ──────────────────────────────────────────────────────────────

/**
 * Static definition of a region. The engine uses minCapitalToEnter + the
 * optional entryGate predicate to decide whether the player can enter.
 * Everything else (population, priceSensitivity, regulationCost, description)
 * is informational — games read it for their own demand / pricing logic.
 *
 * @typeParam TRegion  string-literal union of region ids the game uses
 * @typeParam S        the game's state shape (for the entryGate predicate)
 */
export interface RegionDef<TRegion extends string = string, S = unknown> {
  id: TRegion;
  /** Short label for UI chips. */
  name: string;
  /** Full display name for headers + screens. */
  displayName: string;
  /** Population of the region in total users. Used by games for demand scaling. */
  population: number;
  /** 0–1. Higher = customers more price-sensitive (games use in WTP calcs). */
  priceSensitivity: number;
  /** Ongoing per-tick regulatory / compliance cost after entry. Games charge this. */
  regulationCost: number;
  /** One-time capital required to enter (entry fee). */
  minCapitalToEnter: number;
  /**
   * Additional game-specific entry gate. Returns true if entry is currently
   * allowed (e.g. "must have entered Region X first," "must have brand score
   * ≥ 60," etc.). Defaults to always allowed if omitted.
   */
  entryGate?: (gameState: S) => boolean;
  /** Flavor / lore for UI. */
  description?: string;
}

/** Runtime state for one region. */
export interface RegionRuntimeState<TRegion extends string = string> {
  regionId: TRegion;
  /** True once the player has entered. Starts false for all except the home region. */
  entered: boolean;
  /** Day of entry. Null until entered. */
  enteredOnDay: number | null;
  /** Player's market share in this region, 0–1. Game manages updates. */
  marketShare: number;
  /** Player's installed base in this region. Game manages updates. */
  installedBase: number;
  /** Cumulative regulatory cost paid for this region. */
  cumulativeRegCost: number;
}

/** Container on game state. */
export interface GeographicState<TRegion extends string = string> {
  /** Runtime state keyed by region id. */
  regions: Record<TRegion, RegionRuntimeState<TRegion>>;
}

// ─── Factories ──────────────────────────────────────────────────────────

/**
 * Create fresh geographic state. All regions start un-entered by default.
 * To mark one as "home" (auto-entered at game start), pass its id via `homeRegionId`.
 *
 * @example
 *   createGeographicState(REGION_DEFS, 'china')
 */
export function createGeographicState<TRegion extends string, S>(
  defs: readonly RegionDef<TRegion, S>[],
  homeRegionId?: TRegion,
): GeographicState<TRegion> {
  const regions = {} as Record<TRegion, RegionRuntimeState<TRegion>>;
  for (const def of defs) {
    regions[def.id] = {
      regionId: def.id,
      entered: def.id === homeRegionId,
      enteredOnDay: def.id === homeRegionId ? 0 : null,
      marketShare: 0,
      installedBase: 0,
      cumulativeRegCost: 0,
    };
  }
  return { regions };
}

// ─── Query helpers ──────────────────────────────────────────────────────

export function isEntered<TRegion extends string>(
  state: GeographicState<TRegion>,
  regionId: TRegion,
): boolean {
  return state.regions[regionId]?.entered ?? false;
}

/** All entered regions' runtime states. */
export function enteredRegions<TRegion extends string>(
  state: GeographicState<TRegion>,
): RegionRuntimeState<TRegion>[] {
  return Object.values(state.regions).filter((r: unknown) => (r as RegionRuntimeState<TRegion>).entered) as RegionRuntimeState<TRegion>[];
}

/** Sum of population across entered regions. Useful for demand scaling. */
export function totalEnteredPopulation<TRegion extends string, S>(
  defs: readonly RegionDef<TRegion, S>[],
  state: GeographicState<TRegion>,
): number {
  let total = 0;
  for (const def of defs) {
    if (state.regions[def.id]?.entered) total += def.population;
  }
  return total;
}

/** Total ongoing regulatory cost across entered regions (per tick). */
export function totalEnteredRegCost<TRegion extends string, S>(
  defs: readonly RegionDef<TRegion, S>[],
  state: GeographicState<TRegion>,
): number {
  let total = 0;
  for (const def of defs) {
    if (state.regions[def.id]?.entered) total += def.regulationCost;
  }
  return total;
}

// ─── Entry mechanics ────────────────────────────────────────────────────

/**
 * What currently prevents entry into `regionId`. Returns null if entry is allowed.
 * Useful for UI disabled-state labels.
 */
export type EntryBlockReason = 'already-entered' | 'insufficient-capital' | 'gate-failed' | 'unknown-region';

/**
 * Can the player enter `regionId` right now?
 *
 * Checks:
 *   1. Region exists in state.
 *   2. Not already entered.
 *   3. Game's cash ≥ region's minCapitalToEnter.
 *   4. entryGate(gameState) returns true (if defined).
 *
 * Games read `getCash(state)` to pull the current cash number — engine is
 * agnostic to finances module; it just needs a numeric read.
 */
export function canEnterRegion<TRegion extends string, S>(
  defs: readonly RegionDef<TRegion, S>[],
  state: GeographicState<TRegion>,
  regionId: TRegion,
  gameState: S,
  getCash: (gameState: S) => number,
): EntryBlockReason | null {
  const def = defs.find((d) => d.id === regionId);
  if (!def) return 'unknown-region';
  if (state.regions[regionId]?.entered) return 'already-entered';
  if (getCash(gameState) < def.minCapitalToEnter) return 'insufficient-capital';
  if (def.entryGate && !def.entryGate(gameState)) return 'gate-failed';
  return null;
}

/**
 * Enter a region. Mutates state. Returns the cost to deduct from the game's
 * cash (game is responsible for the actual deduction + any press headline).
 * Returns 0 and doesn't mutate if already entered or region missing.
 */
export function enterRegion<TRegion extends string, S>(
  defs: readonly RegionDef<TRegion, S>[],
  state: GeographicState<TRegion>,
  regionId: TRegion,
  day: number,
): number {
  const def = defs.find((d) => d.id === regionId);
  const runtime = state.regions[regionId];
  if (!def || !runtime || runtime.entered) return 0;
  runtime.entered = true;
  runtime.enteredOnDay = day;
  return def.minCapitalToEnter;
}

/**
 * Apply one tick of regulatory cost to each entered region. Games read the
 * return value (total across all entered regions) and pipe it into their
 * financialPhase getBurn, analogous to how inventory's lastTickUpkeep flows.
 */
export function applyRegulatoryCosts<TRegion extends string, S>(
  defs: readonly RegionDef<TRegion, S>[],
  state: GeographicState<TRegion>,
): number {
  let total = 0;
  for (const def of defs) {
    const runtime = state.regions[def.id];
    if (!runtime || !runtime.entered) continue;
    runtime.cumulativeRegCost += def.regulationCost;
    total += def.regulationCost;
  }
  return total;
}
