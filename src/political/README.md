# Political — Regulation, subsidies, elections

**Status:** PLANNED v0.4
**Used by:** AV, airline, metro, telecom, utility, pharma, bank, crypto, cannabis — regulated industries

## Exports (planned)
```ts
interface PoliticalState {
  approvalRating: number;          // 0-100 public support
  activeRegulations: Regulation[];
  subsidyProgram: Subsidy | null;
  electionCycle?: ElectionSchedule;
}
function applyRegulation(state, reg): void;
function resolveElection(state): void;  // can flip subsidy / regulation overnight
```

## Evidence
NEW. Infrastructure games (metro, utility) need this as a primary mechanic.
