// TycoonOS — Research Blueprint
// Structured research workflow that turns domain research into blueprint inputs.

import {
  composeGameBlueprint,
  selectBlueprintPrimitives,
  type BlueprintPrimitiveId,
  type BlueprintPrimitiveMatch,
  type ComposeBlueprintInput,
  type GameBlueprint,
} from '../game-blueprints/index.js';

export type ResearchConfidence = 'low' | 'medium' | 'high';
export type ResearchSectionId =
  | 'audience'
  | 'domain-loop'
  | 'customer-segments'
  | 'revenue-model'
  | 'assets-capacity'
  | 'constraints'
  | 'rivals'
  | 'failure-modes'
  | 'first-session';

export interface ResearchSourceNote {
  label: string;
  url?: string;
  note: string;
  confidence: ResearchConfidence;
}

export interface ResearchFinding {
  id: string;
  sectionId: ResearchSectionId;
  claim: string;
  implication: string;
  confidence: ResearchConfidence;
  sources?: readonly ResearchSourceNote[];
}

export interface ResearchBlueprintBrief {
  title: string;
  idea: string;
  audience: string;
  platform: string;
  findings: readonly ResearchFinding[];
  desiredTone?: string;
  firstSessionGoal?: string;
  forcedPrimitiveIds?: readonly BlueprintPrimitiveId[];
}

export interface ResearchChecklistItem {
  id: string;
  sectionId: ResearchSectionId;
  question: string;
  whyItMatters: string;
  required: boolean;
}

export interface ResearchGap {
  sectionId: ResearchSectionId;
  severity: 'warning' | 'error';
  message: string;
}

export interface ResearchBlueprintSynthesis {
  blueprintInput: ComposeBlueprintInput;
  primitiveMatches: readonly BlueprintPrimitiveMatch[];
  selectedPrimitiveIds: readonly BlueprintPrimitiveId[];
  gaps: readonly ResearchGap[];
  generatorNotes: readonly string[];
}

export const RESEARCH_BLUEPRINT_CHECKLIST: readonly ResearchChecklistItem[] = [
  item('audience-fantasy', 'audience', 'Who is the exact player audience, and what fantasy should the first session deliver?', 'Prevents a technically correct sim with the wrong feel.', true),
  item('core-domain-loop', 'domain-loop', 'What is the real-world operating loop that repeats every tick/turn?', 'Defines the generated tick order and player decisions.', true),
  item('segments', 'customer-segments', 'Which customer groups behave differently enough to model separately?', 'Feeds customer-funnel and market-engine pools.', true),
  item('money-loop', 'revenue-model', 'How does money enter, what are variable costs, and what fixed costs create pressure?', 'Selects revenue and accounting modules.', true),
  item('assets', 'assets-capacity', 'What assets, inventory, rights, or capacity create supply?', 'Selects asset modules and capacity recipes.', false),
  item('constraints', 'constraints', 'What real constraints gate growth: regulation, geography, capacity, seasonality, financing?', 'Creates meaningful failure modes and pacing.', true),
  item('rivals', 'rivals', 'Who are the rivals, and what levers do they realistically control?', 'Keeps competition simulated instead of decorative.', true),
  item('failure', 'failure-modes', 'How do operators fail in this domain?', 'Makes the generated game have teeth.', true),
  item('first-session', 'first-session', 'What can the player accomplish in the first 10 minutes?', 'Guides generated starter state and UI.', true),
];

export function createResearchChecklist(sectionIds?: readonly ResearchSectionId[]): ResearchChecklistItem[] {
  if (!sectionIds?.length) return [...RESEARCH_BLUEPRINT_CHECKLIST];
  const allowed = new Set(sectionIds);
  return RESEARCH_BLUEPRINT_CHECKLIST.filter(item => allowed.has(item.sectionId));
}

export function synthesizeResearchBlueprint(brief: ResearchBlueprintBrief): ResearchBlueprintSynthesis {
  const primitiveMatches = selectBlueprintPrimitives({
    idea: [brief.idea, findingText(brief)].join(' '),
    audience: brief.audience,
    platform: brief.platform,
  });
  const selectedPrimitiveIds = choosePrimitiveIds(brief, primitiveMatches);
  const gaps = validateResearchBrief(brief);
  return {
    blueprintInput: {
      title: brief.title,
      idea: brief.idea,
      audience: brief.audience,
      platform: brief.platform,
      primitiveIds: selectedPrimitiveIds,
      domainFocus: findingsFor(brief, 'domain-loop').map(finding => finding.claim),
      firstSessionGoal: brief.firstSessionGoal ?? findingsFor(brief, 'first-session')[0]?.implication,
    },
    primitiveMatches,
    selectedPrimitiveIds,
    gaps,
    generatorNotes: [
      'Treat research findings as domain evidence, not as hard-coded constants.',
      'Use low-confidence findings as TODOs in generated data, not as final balance.',
      'Every selected primitive should be traceable to at least one research finding or forced by the designer.',
    ],
  };
}

export function composeBlueprintFromResearch(brief: ResearchBlueprintBrief): GameBlueprint {
  return composeGameBlueprint(synthesizeResearchBlueprint(brief).blueprintInput);
}

export function validateResearchBrief(brief: ResearchBlueprintBrief): ResearchGap[] {
  const gaps: ResearchGap[] = [];
  for (const checklist of RESEARCH_BLUEPRINT_CHECKLIST.filter(item => item.required)) {
    const findings = findingsFor(brief, checklist.sectionId);
    if (findings.length === 0) {
      gaps.push({
        sectionId: checklist.sectionId,
        severity: 'error',
        message: `Missing required research: ${checklist.question}`,
      });
    } else if (findings.every(finding => finding.confidence === 'low')) {
      gaps.push({
        sectionId: checklist.sectionId,
        severity: 'warning',
        message: `Only low-confidence research for: ${checklist.question}`,
      });
    }
  }
  return gaps;
}

export function findingsFor(brief: ResearchBlueprintBrief, sectionId: ResearchSectionId): ResearchFinding[] {
  return brief.findings.filter(finding => finding.sectionId === sectionId);
}

export function createResearchFinding(
  sectionId: ResearchSectionId,
  claim: string,
  implication: string,
  confidence: ResearchConfidence = 'medium',
  id: string = slugify(`${sectionId}-${claim}`),
): ResearchFinding {
  return { id, sectionId, claim, implication, confidence };
}

function choosePrimitiveIds(
  brief: ResearchBlueprintBrief,
  primitiveMatches: readonly BlueprintPrimitiveMatch[],
): BlueprintPrimitiveId[] {
  if (brief.forcedPrimitiveIds?.length) return [...brief.forcedPrimitiveIds];
  const confidentMatches = primitiveMatches.filter(match => match.score >= 4);
  const selected = confidentMatches.slice(0, 3).map(match => match.primitive.id);
  return selected.length > 0 ? selected : ['subscription-catalog-business'];
}

function findingText(brief: ResearchBlueprintBrief): string {
  return brief.findings.map(finding => `${finding.claim} ${finding.implication}`).join(' ');
}

function item(
  id: string,
  sectionId: ResearchSectionId,
  question: string,
  whyItMatters: string,
  required: boolean,
): ResearchChecklistItem {
  return { id, sectionId, question, whyItMatters, required };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'finding';
}
