# Roster — Individual talent/partner entities

**Status:** PLANNED v0.5
**Used by:** film studio, record label, sports team, talent agency, law firm, consulting, ad agency, esports

Individual humans/entities with traits, contracts, movement between orgs.
Different from "competitor releases" (products). These are PEOPLE on your payroll.

## Exports (planned)
```ts
interface RosterMember<TTraits> {
  id: string; name: string; traits: TTraits;
  contract: Contract;
  reputation: number;
  history: PerformanceRecord[];
}
function signTalent(roster, candidate, terms): void;
function poachFromCompetitor(roster, targetId, bid): boolean;
```

## Evidence
NEW. Hollywood and sports sims live or die on talent mechanics.
