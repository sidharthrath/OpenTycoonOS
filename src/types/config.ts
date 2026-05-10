/**
 * GameConfig — the master generic parameter that pins all game-specific vocabulary.
 *
 * Every tycoon game defines one of these. It tells the engine what quality dimensions,
 * market segments, product tiers, competitors, and research pillars exist.
 *
 * Example (AI Tycoon):
 *   { dimensions: ['language','code','reasoning','safety','multimodal'], segments: ['consumers','prosumers','professionals'], ... }
 *
 * Example (Streaming Tycoon):
 *   { dimensions: ['catalog','streamQuality','ux','reliability'], segments: ['casual','bingeWatcher','cinephile'], ... }
 */
export interface GameConfig {
  /** Quality dimensions the game scores products on */
  readonly dimensions: readonly string[];
  /** Market segments (customer types) */
  readonly segments: readonly string[];
  /** Product tiers (e.g. free/pro/max or ad-supported/standard/premium) */
  readonly tiers: readonly string[];
  /** Competitor company identifiers */
  readonly competitors: readonly string[];
  /** Research tree pillar categories */
  readonly researchPillars: readonly string[];
}

/** Helper to extract union of string literals from a readonly string[] config field */
export type ConfigValues<T extends readonly string[]> = T[number];

/** Type-safe config definition. Returns the config with full literal type inference. */
export function defineGameConfig<const C extends GameConfig>(config: C): C {
  return config;
}
