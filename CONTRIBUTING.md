# Contributing

Thanks for considering a contribution to OpenTycoonOS.

This project is in alpha. The main design goal is reusable simulation primitives for tycoon and management games, not one-off mechanics for a single game.

## Good Contributions

- Small, typed modules with clear inputs and outputs.
- Fixes that improve correctness without changing public APIs unnecessarily.
- Examples that show how modules compose into a playable loop.
- Documentation that clarifies where a mechanic belongs.

## Before Opening a Pull Request

Run:

```bash
npm run build
npm run typecheck
npm test
```

If a change affects a public module, update the relevant module README and `CHANGELOG.md`.

## Design Principles

- Keep the core engine free of rendering and UI framework dependencies.
- Prefer pure helpers and explicit state transitions.
- Keep game-specific content in games, not in reusable modules.
- Add abstractions only when they can serve multiple genres.
- Make business logic inspectable; simulation games are more fun when the player can understand the system.
