// TycoonOS — Perks / Milestone unlocks
// Threshold-based passive bonuses that unlock once a game-defined condition is met
// (e.g. "first 100 users", "first award win"). The engine knows only that perks
// exist, have triggers, and carry effects; the effect shape is fully game-defined.
//
// Evidence: streaming-tycoon shipped with an `unlockedPerks: string[]` field but
// never wrote to it — perks were designed but never implemented. This module
// closes that gap in a generic, cross-game way.

import type { TickPhase } from '../tick/index.js';

/**
 * Static definition of a perk. The `effect` payload is game-defined (type `E`).
 * If a perk is pure flavor / press-only, games can use `E = void` and rely on the
 * `onUnlock` callback in `perkPhase` to fire headlines.
 *
 * @typeParam S  the game's state shape
 * @typeParam E  the effect shape the game uses (a record of bonuses, multipliers, flags, etc.)
 */
export interface PerkDef<S, E = void> {
  /** Stable unique id. Stored in save files; do not change post-release. */
  id: string;
  /** Display name for UI. */
  name: string;
  /** 1-sentence description for the perks screen. */
  description: string;
  /**
   * Predicate evaluated against game state.
   * - When `once` (default): returning true latches the perk permanently.
   * - When `once: false`: returning true makes the effect active for that tick only.
   */
  trigger: (state: S) => boolean;
  /** Game-defined effect payload. */
  effect: E;
  /**
   * If true (default), unlocks latch permanently once triggered.
   * If false, the perk is a live conditional — effect applies only while `trigger` returns true.
   */
  once?: boolean;
}

/**
 * Per-save perk state. Minimal by design: just the set of unlocked (latched) perk ids.
 * Conditional (once:false) perks don't appear here — they're re-evaluated each tick.
 */
export interface PerkState {
  /** Ids of perks that have unlocked permanently. Order is insertion (unlock) order. */
  unlocked: string[];
}

/** Create a fresh `PerkState`. Put this on your game state at initialization. */
export function createPerkState(): PerkState {
  return { unlocked: [] };
}

/** Quick check: is a named perk currently unlocked (latched)? */
export function isPerkUnlocked(perkState: PerkState, perkId: string): boolean {
  return perkState.unlocked.includes(perkId);
}

/**
 * Evaluate triggers for all latching (once:true) perks against the current state
 * and mutate `perkState.unlocked` with any newly-triggered perks.
 *
 * Returns the ids that unlocked this call — useful for firing press headlines,
 * playing a sound, etc. via the returned list or via `perkPhase`'s `onUnlock`.
 *
 * Idempotent in steady state: calling repeatedly after all triggers have fired
 * is a no-op.
 *
 * @typeParam S  the game's state shape
 */
export function checkPerkTriggers<S>(
  state: S,
  defs: readonly PerkDef<S, unknown>[],
  perkState: PerkState,
): string[] {
  const newlyUnlocked: string[] = [];
  for (const def of defs) {
    const isOnce = def.once ?? true;
    if (!isOnce) continue;
    if (perkState.unlocked.includes(def.id)) continue;
    if (def.trigger(state)) {
      perkState.unlocked.push(def.id);
      newlyUnlocked.push(def.id);
    }
  }
  return newlyUnlocked;
}

/**
 * Collect the effect payloads of all currently-active perks:
 * - latching (once:true) perks that have unlocked
 * - conditional (once:false) perks whose trigger currently returns true
 *
 * Games aggregate the returned effects as they see fit (sum, product, override, etc.).
 * See {@link sumEffects} and {@link productEffects} for common patterns.
 *
 * @typeParam S  the game's state shape
 * @typeParam E  the effect shape
 */
export function getActivePerkEffects<S, E>(
  state: S,
  defs: readonly PerkDef<S, E>[],
  perkState: PerkState,
): E[] {
  const effects: E[] = [];
  for (const def of defs) {
    const isOnce = def.once ?? true;
    if (isOnce) {
      if (perkState.unlocked.includes(def.id)) effects.push(def.effect);
    } else {
      if (def.trigger(state)) effects.push(def.effect);
    }
  }
  return effects;
}

/**
 * Sum a numeric field extracted from each effect. Common for additive bonuses
 * (e.g. awareness +5% + 3% + 10% stacks to +18%).
 *
 * Returns 0 if the list is empty.
 */
export function sumEffects<E>(effects: readonly E[], extract: (e: E) => number): number {
  let total = 0;
  for (const e of effects) total += extract(e);
  return total;
}

/**
 * Multiply a numeric field extracted from each effect. Common for multiplicative
 * stacks (e.g. cost × 0.95 × 0.90 = 0.855).
 *
 * Returns 1 if the list is empty (the multiplicative identity).
 */
export function productEffects<E>(effects: readonly E[], extract: (e: E) => number): number {
  let total = 1;
  for (const e of effects) total *= extract(e);
  return total;
}

/**
 * Configuration for {@link perkPhase}.
 *
 * @typeParam S  the game's state shape
 */
export interface PerkPhaseConfig<S> {
  /** Perk definitions for this game. */
  defs: readonly PerkDef<S, unknown>[];
  /** Read the {@link PerkState} off the game state. */
  getPerkState: (state: S) => PerkState;
  /**
   * Optional: called once per newly-unlocked perk after its latch is set.
   * Use to push a trade headline, play a sound, queue a toast, etc.
   */
  onUnlock?: (state: S, def: PerkDef<S, unknown>) => void;
}

/**
 * Compose a `TickPhase` that checks perk triggers each tick and (optionally)
 * fires a callback per new unlock. Drop it into your game's `composeTick([...])`.
 *
 * @example
 *   const gameTick = composeTick<State>([
 *     clockPhase({ maxYears: 10 }),
 *     // ... game-specific phases ...
 *     perkPhase({
 *       defs: myPerkDefs,
 *       getPerkState: s => s.perks,
 *       onUnlock: (s, def) => pushHeadline(s, {
 *         headline: `Milestone unlocked: ${def.name}`,
 *         body: def.description,
 *         kind: 'milestone',
 *       }),
 *     }),
 *     financialPhase(...),
 *   ]);
 */
export function perkPhase<S>(config: PerkPhaseConfig<S>): TickPhase<S> {
  return (state) => {
    const perkState = config.getPerkState(state);
    const newlyUnlocked = checkPerkTriggers(state, config.defs, perkState);
    if (config.onUnlock && newlyUnlocked.length > 0) {
      for (const id of newlyUnlocked) {
        const def = config.defs.find((d) => d.id === id);
        if (def) config.onUnlock(state, def);
      }
    }
  };
}
