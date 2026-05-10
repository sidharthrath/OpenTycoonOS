# Save System — Versioned Persistence

**Status:** IMPLEMENTED `0.1.0-alpha.28`

Core save/load primitives for every TycoonOS game. Games provide the storage backend; TycoonOS owns the save envelope, version checks, migrations, autosave, manual slots, and safe load results.

## What It Models

- Versioned save envelopes: `{ version, savedAt, state, summary }`.
- Platform-agnostic storage adapters: AsyncStorage, localStorage, filesystem wrappers.
- Explicit load outcomes instead of throwing or silently crashing.
- Optional migrations from older save versions.
- Optional validation hook before a state is accepted.
- Autosave plus manual slot management with summaries.

## Core API

```ts
const saves = createSaveSystem<GameState, SaveSummary>({
  key: '@my-game/save',
  version: 3,
  storage: AsyncStorage,
  migrations: [
    {
      fromVersion: 2,
      toVersion: 3,
      migrate: (state) => ({ ...(state as GameStateV2), newField: 0 }),
    },
  ],
  summarize: (state, ctx) => ({
    id: ctx.slotId,
    name: ctx.slotName,
    savedAt: ctx.savedAt,
    year: state.clock.year,
    cash: state.finances.cash,
  }),
});

await saves.save(state);
const loaded = await saves.load();
if (loaded.ok) setState(loaded.state);
```

## Design Notes

This module deliberately does not import AsyncStorage or any browser API. That keeps TycoonOS zero-dependency and lets games run on Expo, browser, desktop, tests, or server-side simulation with the same save contract.

Games still own domain migrations because only games understand state-shape meaning. The engine provides the migration runner and failure semantics so incompatible saves do not crash gameplay.
