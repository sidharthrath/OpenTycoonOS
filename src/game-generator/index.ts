// TycoonOS — Game Generator
// Blueprint-to-skeleton planning. This module does not write files; it creates
// the structured game skeleton a generator or scaffolder can materialize.

import type {
  BlueprintAction,
  BlueprintId,
  BlueprintModuleId,
  BlueprintStateSlice,
  BlueprintTickPhase,
  BlueprintUiSurface,
  GameBlueprint,
} from '../game-blueprints/index.js';

export type GeneratedFileKind =
  | 'domain'
  | 'engine'
  | 'hook'
  | 'screen'
  | 'component'
  | 'data'
  | 'test'
  | 'docs';

export interface GameSkeletonOptions {
  appSlug?: string;
  stateRootName?: string;
  includeDebugSurfaces?: boolean;
  includeExampleData?: boolean;
  includeSimulationSpec?: boolean;
}

export interface GeneratedFileSpec {
  path: string;
  kind: GeneratedFileKind;
  purpose: string;
  dependsOnModules: readonly BlueprintModuleId[];
}

export interface GeneratedStateField {
  name: string;
  type: string;
  purpose: string;
}

export interface GeneratedStateSlice {
  id: BlueprintId;
  typeName: string;
  purpose: string;
  fields: readonly GeneratedStateField[];
  source: BlueprintStateSlice;
}

export interface GeneratedTickPhase {
  id: BlueprintId;
  functionName: string;
  purpose: string;
  modules: readonly BlueprintModuleId[];
  reads: readonly BlueprintId[];
  writes: readonly BlueprintId[];
  source: BlueprintTickPhase;
}

export interface GeneratedAction {
  id: BlueprintId;
  functionName: string;
  label: string;
  purpose: string;
  modules: readonly BlueprintModuleId[];
  inputShape: readonly GeneratedStateField[];
  source: BlueprintAction;
}

export interface GeneratedRivalBehavior {
  id: BlueprintId;
  functionName: string;
  label: string;
  purpose: string;
  modules: readonly BlueprintModuleId[];
  source: BlueprintAction;
}

export interface GeneratedScreen {
  id: BlueprintId;
  componentName: string;
  label: string;
  purpose: string;
  priority: BlueprintUiSurface['priority'];
  reads: readonly BlueprintId[];
  primaryActions: readonly BlueprintId[];
  source: BlueprintUiSurface;
}

export interface GeneratedStarterDataSet {
  id: BlueprintId;
  filePath: string;
  purpose: string;
  seeds: readonly string[];
}

export interface GeneratedSavePlan {
  storageKey: string;
  currentVersion: number;
  stateRootName: string;
  summaryFields: readonly string[];
  migrationFiles: readonly string[];
}

export interface GeneratedAcceptanceCheck {
  id: BlueprintId;
  description: string;
  severity: 'must' | 'should';
}

export interface GameSkeleton {
  appSlug: string;
  title: string;
  stateRootName: string;
  blueprint: GameBlueprint;
  files: readonly GeneratedFileSpec[];
  stateSlices: readonly GeneratedStateSlice[];
  tickPhases: readonly GeneratedTickPhase[];
  actions: readonly GeneratedAction[];
  rivalBehaviors: readonly GeneratedRivalBehavior[];
  screens: readonly GeneratedScreen[];
  starterData: readonly GeneratedStarterDataSet[];
  savePlan: GeneratedSavePlan;
  acceptanceChecks: readonly GeneratedAcceptanceCheck[];
  generatorNotes: readonly string[];
}

export function createGameSkeleton(blueprint: GameBlueprint, options: GameSkeletonOptions = {}): GameSkeleton {
  const appSlug = options.appSlug ?? slugify(blueprint.title);
  const stateRootName = options.stateRootName ?? pascalCase(`${blueprint.id}State`);
  const includeDebug = options.includeDebugSurfaces ?? true;
  const screens = blueprint.uiSurfaces
    .filter(surface => includeDebug || surface.priority !== 'debug')
    .map(surface => createScreen(surface, blueprint));

  return {
    appSlug,
    title: blueprint.title,
    stateRootName,
    blueprint,
    files: createFileTree(blueprint, appSlug, includeDebug, options.includeSimulationSpec ?? true),
    stateSlices: blueprint.stateSlices.map(createStateSlice),
    tickPhases: blueprint.tickPhases.map(phase => createTickPhase(phase, blueprint.stateSlices)),
    actions: blueprint.playerActions.map(createAction),
    rivalBehaviors: blueprint.rivalActions.map(createRivalBehavior),
    screens,
    starterData: options.includeExampleData === false ? [] : createStarterData(blueprint, appSlug),
    savePlan: createSavePlan(blueprint, appSlug, stateRootName),
    acceptanceChecks: createAcceptanceChecks(blueprint),
    generatorNotes: [
      ...blueprint.generatorNotes,
      'Generated files should keep TycoonOS imports in engine/ and game-specific naming/data in domain/ or data/.',
      'Screens should be generated from the screen plan, not from raw module names.',
    ],
  };
}

export function createFileTree(
  blueprint: GameBlueprint,
  appSlug: string = slugify(blueprint.title),
  includeDebug: boolean = true,
  includeSimulationSpec: boolean = true,
): GeneratedFileSpec[] {
  const files: GeneratedFileSpec[] = [
    file(`games/${appSlug}/package.json`, 'docs', 'Game package manifest and TycoonOS dependency.', []),
    file(`games/${appSlug}/src/domain/types.ts`, 'domain', 'Game-specific domain types extending blueprint state.', []),
    file(`games/${appSlug}/src/domain/constants.ts`, 'domain', 'Tunable constants derived from research and balancing defaults.', []),
    file(`games/${appSlug}/src/data/starter.ts`, 'data', 'Starter segments, rivals, assets, products, and first-session scenario.', []),
    file(`games/${appSlug}/src/engine/state.ts`, 'engine', 'Initial game state and state-root type.', ['save-system']),
    file(`games/${appSlug}/src/engine/tick.ts`, 'engine', 'Composed tick phases in blueprint order.', ['tick', ...blueprint.modules.required]),
    file(`games/${appSlug}/src/engine/actions.ts`, 'engine', 'Player action reducers/commands generated from blueprint actions.', blueprint.modules.required),
    file(`games/${appSlug}/src/engine/rivals.ts`, 'engine', 'Rival setup and decision glue.', ['competition/rival-sim', 'competition/rival-adapters']),
    file(`games/${appSlug}/src/engine/save.ts`, 'engine', 'Versioned save/load wiring and summaries.', ['save-system']),
    file(`games/${appSlug}/src/hooks/useGame.ts`, 'hook', 'Game loop/store hook wrapping engine state.', ['tick', 'save-system']),
    file(`games/${appSlug}/src/screens/GameScreen.tsx`, 'screen', 'Primary shell composing generated screens.', []),
    file(`games/${appSlug}/src/components/StatStrip.tsx`, 'component', 'Reusable compact KPI strip.', []),
    file(`games/${appSlug}/README.md`, 'docs', 'Generated game design, module composition, and validation notes.', []),
  ];

  for (const surface of blueprint.uiSurfaces) {
    if (!includeDebug && surface.priority === 'debug') continue;
    files.push(file(`games/${appSlug}/src/screens/${pascalCase(surface.id)}Screen.tsx`, 'screen', surface.purpose, []));
  }

  if (includeSimulationSpec) {
    files.push(file(`games/${appSlug}/src/engine/sim-smoke.ts`, 'test', 'Headless simulation smoke spec for generated game balance.', blueprint.modules.required));
  }
  return files;
}

export function createSavePlan(blueprint: GameBlueprint, appSlug: string, stateRootName: string): GeneratedSavePlan {
  return {
    storageKey: `opentycoonos:${appSlug}:${blueprint.id}:save`,
    currentVersion: 1,
    stateRootName,
    summaryFields: [
      'currentDay',
      'cash',
      'runway',
      'primaryMarketShare',
      'lastTickRevenue',
      'firstSessionGoalProgress',
    ],
    migrationFiles: [`games/${appSlug}/src/engine/migrations/v1.ts`],
  };
}

function createStateSlice(source: BlueprintStateSlice): GeneratedStateSlice {
  return {
    id: source.id,
    typeName: pascalCase(`${source.id}State`),
    purpose: source.purpose,
    fields: [
      { name: 'items', type: 'Record<string, unknown>', purpose: 'Domain-specific records for this slice.' },
      { name: 'lastTick', type: 'Record<string, number>', purpose: 'Inspectable per-tick metrics.' },
      { name: 'cumulative', type: 'Record<string, number>', purpose: 'Long-running totals for charts, saves, and scoring.' },
    ],
    source,
  };
}

function createTickPhase(source: BlueprintTickPhase, slices: readonly BlueprintStateSlice[]): GeneratedTickPhase {
  const touched = slices
    .filter(slice => source.purpose.toLowerCase().includes(slice.id.toLowerCase()) || source.modules.some(moduleId => slice.purpose.toLowerCase().includes(moduleId.split('/')[0])))
    .map(slice => slice.id);
  return {
    id: source.id,
    functionName: camelCase(`${source.id}Phase`),
    purpose: source.purpose,
    modules: source.modules,
    reads: touched,
    writes: touched,
    source,
  };
}

function createAction(source: BlueprintAction): GeneratedAction {
  return {
    id: source.id,
    functionName: camelCase(source.id),
    label: source.label,
    purpose: source.purpose,
    modules: source.modules,
    inputShape: [
      { name: 'amount', type: 'number | undefined', purpose: 'Optional amount/budget/quantity when the action needs a scalar.' },
      { name: 'targetId', type: 'string | undefined', purpose: 'Optional segment, region, asset, product, or rival id.' },
    ],
    source,
  };
}

function createRivalBehavior(source: BlueprintAction): GeneratedRivalBehavior {
  return {
    id: source.id,
    functionName: camelCase(source.id),
    label: source.label,
    purpose: source.purpose,
    modules: source.modules,
    source,
  };
}

function createScreen(surface: BlueprintUiSurface, blueprint: GameBlueprint): GeneratedScreen {
  const matchingActions = blueprint.playerActions
    .filter(action => surface.purpose.toLowerCase().split(/\W+/).some(term => term.length > 4 && action.purpose.toLowerCase().includes(term)))
    .map(action => action.id);
  return {
    id: surface.id,
    componentName: `${pascalCase(surface.id)}Screen`,
    label: surface.label,
    purpose: surface.purpose,
    priority: surface.priority,
    reads: blueprint.stateSlices
      .filter(slice => surface.purpose.toLowerCase().includes(slice.id.toLowerCase()))
      .map(slice => slice.id),
    primaryActions: matchingActions.slice(0, 4),
    source: surface,
  };
}

function createStarterData(blueprint: GameBlueprint, appSlug: string): GeneratedStarterDataSet[] {
  return [
    {
      id: 'starter-scenario',
      filePath: `games/${appSlug}/src/data/starter.ts`,
      purpose: 'Initial scenario, first-session target, player company, and starting rivals.',
      seeds: [
        blueprint.firstSessionGoal ?? 'Define a first-session goal before final generation.',
        ...blueprint.stateSlices.slice(0, 5).map(slice => `Seed ${slice.id}: ${slice.examples.join(', ')}`),
      ],
    },
    {
      id: 'balance-preset',
      filePath: `games/${appSlug}/src/domain/constants.ts`,
      purpose: 'Starting tuning values from blueprint balancing defaults.',
      seeds: blueprint.balancingDefaults.map(item => `${item.id}: ${item.starterValue}`),
    },
  ];
}

function createAcceptanceChecks(blueprint: GameBlueprint): GeneratedAcceptanceCheck[] {
  return [
    check('loads-first-screen', 'Generated app opens directly into the playable first screen.', 'must'),
    check('has-save-load', 'A save can be created, loaded, and migrated from version 1.', 'must'),
    check('runs-100-ticks', 'Headless sim runs 100 ticks without NaN, negative impossible values, or thrown errors.', 'must'),
    check('has-demand-loop', 'Demand flows through customer-funnel before market-engine resolution.', 'must'),
    check('has-money-loop', 'Revenue and costs reach financial/accounting state each tick.', 'must'),
    check('rivals-participate', 'At least one rival creates offers/decisions through rival-sim or rival-adapters.', 'must'),
    check('first-session-goal', blueprint.firstSessionGoal ?? 'Define and show a first-session goal.', blueprint.firstSessionGoal ? 'should' : 'must'),
    check('ui-surfaces', `Primary screens: ${blueprint.uiSurfaces.filter(surface => surface.priority === 'primary').map(surface => surface.label).join(', ')}`, 'should'),
  ];
}

function file(path: string, kind: GeneratedFileKind, purpose: string, dependsOnModules: readonly BlueprintModuleId[]): GeneratedFileSpec {
  return { path, kind, purpose, dependsOnModules };
}

function check(id: BlueprintId, description: string, severity: 'must' | 'should'): GeneratedAcceptanceCheck {
  return { id, description, severity };
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'generated-game';
}

function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function camelCase(value: string): string {
  const pascal = pascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}
