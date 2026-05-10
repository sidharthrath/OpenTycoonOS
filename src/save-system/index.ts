// TycoonOS — Save/load system
// Platform-agnostic persistence primitives. Games provide a storage adapter
// such as AsyncStorage, localStorage, IndexedDB wrapper, or filesystem storage;
// TycoonOS owns envelopes, versions, migrations, autosave, manual slots, and
// safe load results.

export interface SaveStorage {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

export interface SaveEnvelope<TState = unknown, TSummary = unknown> {
  version: number;
  savedAt: string;
  state: TState;
  slotId?: string;
  slotName?: string;
  summary?: TSummary;
  meta?: Record<string, unknown>;
}

export interface SaveMigration {
  fromVersion: number;
  toVersion: number;
  migrate: (state: unknown, envelope: SaveEnvelope<unknown, unknown>) => unknown;
}

export interface SaveSlotRecord<TSummary = unknown> {
  id: string;
  name: string;
  savedAt: string;
  version: number;
  summary?: TSummary;
}

export interface SaveSummaryContext {
  slotId: string;
  slotName: string;
  savedAt: string;
}

export interface SaveSystemConfig<TState, TSummary = unknown> {
  key: string;
  version: number;
  storage: SaveStorage;
  migrations?: readonly SaveMigration[];
  validate?: (state: unknown) => boolean;
  summarize?: (state: TState, context: SaveSummaryContext) => TSummary;
  now?: () => Date | string;
  maxSlots?: number;
  slotIndexKey?: string;
  slotKeyPrefix?: string;
  onError?: (operation: string, error: unknown) => void;
}

export interface SaveOptions<TSummary = unknown> {
  savedAt?: string;
  summary?: TSummary;
  meta?: Record<string, unknown>;
}

export interface ManualSaveOptions<TSummary = unknown> extends SaveOptions<TSummary> {
  id?: string;
  name?: string;
}

export type LoadSaveFailureReason =
  | 'missing'
  | 'parse-error'
  | 'invalid-envelope'
  | 'version-too-new'
  | 'version-unsupported'
  | 'migration-failed'
  | 'validation-failed'
  | 'storage-error';

export type LoadSaveResult<TState, TSummary = unknown> =
  | {
      ok: true;
      state: TState;
      envelope: SaveEnvelope<TState, TSummary>;
      migrated: boolean;
    }
  | {
      ok: false;
      reason: LoadSaveFailureReason;
      error?: unknown;
      envelope?: SaveEnvelope<unknown, unknown>;
    };

export interface SaveSystem<TState, TSummary = unknown> {
  save: (state: TState, options?: SaveOptions<TSummary>) => Promise<SaveEnvelope<TState, TSummary>>;
  load: () => Promise<LoadSaveResult<TState, TSummary>>;
  loadStateOrNull: () => Promise<TState | null>;
  clear: () => Promise<void>;
  saveSlot: (state: TState, options?: ManualSaveOptions<TSummary>) => Promise<SaveSlotRecord<TSummary> | null>;
  listSlots: () => Promise<SaveSlotRecord<TSummary>[]>;
  loadSlot: (id: string) => Promise<LoadSaveResult<TState, TSummary>>;
  deleteSlot: (id: string) => Promise<void>;
}

export function createSaveSystem<TState, TSummary = unknown>(
  config: SaveSystemConfig<TState, TSummary>,
): SaveSystem<TState, TSummary> {
  const slotIndexKey = config.slotIndexKey ?? `${config.key}/slots`;
  const slotKeyPrefix = config.slotKeyPrefix ?? `${config.key}/slot/`;
  const maxSlots = Math.max(1, Math.floor(config.maxSlots ?? 5));

  const slotKey = (id: string): string => `${slotKeyPrefix}${id}`;

  async function save(state: TState, options: SaveOptions<TSummary> = {}): Promise<SaveEnvelope<TState, TSummary>> {
    const savedAt = options.savedAt ?? currentIso(config);
    const envelope = createSaveEnvelope(state, {
      version: config.version,
      savedAt,
      summary: options.summary,
      meta: options.meta,
    });
    await config.storage.setItem(config.key, JSON.stringify(envelope));
    return envelope;
  }

  async function load(): Promise<LoadSaveResult<TState, TSummary>> {
    return loadFromKey(config.key, config);
  }

  async function loadStateOrNull(): Promise<TState | null> {
    const result = await load();
    return result.ok ? result.state : null;
  }

  async function clear(): Promise<void> {
    await withStorageErrors('clear', config, async () => {
      await config.storage.removeItem(config.key);
    });
  }

  async function saveSlot(
    state: TState,
    options: ManualSaveOptions<TSummary> = {},
  ): Promise<SaveSlotRecord<TSummary> | null> {
    return withStorageErrors('saveSlot', config, async () => {
      const savedAt = options.savedAt ?? currentIso(config);
      const id = options.id ?? `${Date.now()}`;
      const name = options.name ?? `Save ${id}`;
      const summary = options.summary ?? config.summarize?.(state, { slotId: id, slotName: name, savedAt });
      const envelope = createSaveEnvelope(state, {
        version: config.version,
        savedAt,
        slotId: id,
        slotName: name,
        summary,
        meta: options.meta,
      });
      const ids = await readSlotIndex(config.storage, slotIndexKey);
      const nextIds = [id, ...ids.filter((existing) => existing !== id)].slice(0, maxSlots);
      const dropped = ids.filter((existing) => !nextIds.includes(existing));
      await config.storage.setItem(slotKey(id), JSON.stringify(envelope));
      for (const oldId of dropped) await config.storage.removeItem(slotKey(oldId));
      await writeSlotIndex(config.storage, slotIndexKey, nextIds);
      return { id, name, savedAt, version: config.version, summary };
    }, null);
  }

  async function listSlots(): Promise<SaveSlotRecord<TSummary>[]> {
    return withStorageErrors('listSlots', config, async () => {
      const ids = await readSlotIndex(config.storage, slotIndexKey);
      const records: SaveSlotRecord<TSummary>[] = [];
      const liveIds: string[] = [];
      for (const id of ids) {
        const raw = await config.storage.getItem(slotKey(id));
        if (!raw) continue;
        const parsed = safeParse(raw);
        if (!parsed.ok || !isSaveEnvelope(parsed.value) || parsed.value.version !== config.version) continue;
        liveIds.push(id);
        records.push({
          id: parsed.value.slotId ?? id,
          name: parsed.value.slotName ?? 'Manual save',
          savedAt: parsed.value.savedAt,
          version: parsed.value.version,
          summary: parsed.value.summary as TSummary | undefined,
        });
      }
      if (liveIds.length !== ids.length) await writeSlotIndex(config.storage, slotIndexKey, liveIds);
      return records.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
    }, []);
  }

  async function loadSlot(id: string): Promise<LoadSaveResult<TState, TSummary>> {
    return loadFromKey(slotKey(id), config);
  }

  async function deleteSlot(id: string): Promise<void> {
    await withStorageErrors('deleteSlot', config, async () => {
      await config.storage.removeItem(slotKey(id));
      const ids = await readSlotIndex(config.storage, slotIndexKey);
      await writeSlotIndex(config.storage, slotIndexKey, ids.filter((existing) => existing !== id));
    });
  }

  return { save, load, loadStateOrNull, clear, saveSlot, listSlots, loadSlot, deleteSlot };
}

export function createSaveEnvelope<TState, TSummary = unknown>(
  state: TState,
  input: {
    version: number;
    savedAt?: string;
    slotId?: string;
    slotName?: string;
    summary?: TSummary;
    meta?: Record<string, unknown>;
  },
): SaveEnvelope<TState, TSummary> {
  return {
    version: input.version,
    savedAt: input.savedAt ?? new Date().toISOString(),
    state,
    slotId: input.slotId,
    slotName: input.slotName,
    summary: input.summary,
    meta: input.meta,
  };
}

export function isSaveEnvelope(value: unknown): value is SaveEnvelope<unknown, unknown> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<SaveEnvelope<unknown, unknown>>;
  return (
    typeof candidate.version === 'number' &&
    Number.isFinite(candidate.version) &&
    typeof candidate.savedAt === 'string' &&
    'state' in candidate
  );
}

export function migrateSaveEnvelope(
  envelope: SaveEnvelope<unknown, unknown>,
  targetVersion: number,
  migrations: readonly SaveMigration[] = [],
): LoadSaveResult<unknown, unknown> {
  if (envelope.version === targetVersion) {
    return { ok: true, state: envelope.state, envelope, migrated: false };
  }
  if (envelope.version > targetVersion) {
    return { ok: false, reason: 'version-too-new', envelope };
  }

  let currentEnvelope = { ...envelope };
  let migrated = false;
  while (currentEnvelope.version < targetVersion) {
    const migration = migrations.find((candidate) => candidate.fromVersion === currentEnvelope.version);
    if (!migration || migration.toVersion <= currentEnvelope.version || migration.toVersion > targetVersion) {
      return { ok: false, reason: 'version-unsupported', envelope: currentEnvelope };
    }
    try {
      const nextState = migration.migrate(currentEnvelope.state, currentEnvelope);
      currentEnvelope = {
        ...currentEnvelope,
        version: migration.toVersion,
        state: nextState,
      };
      migrated = true;
    } catch (error) {
      return { ok: false, reason: 'migration-failed', error, envelope: currentEnvelope };
    }
  }

  return {
    ok: true,
    state: currentEnvelope.state,
    envelope: currentEnvelope,
    migrated,
  };
}

export function createLocalStorageAdapter(storage: {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}): SaveStorage {
  return storage;
}

async function loadFromKey<TState, TSummary>(
  key: string,
  config: SaveSystemConfig<TState, TSummary>,
): Promise<LoadSaveResult<TState, TSummary>> {
  try {
    const raw = await config.storage.getItem(key);
    if (!raw) return { ok: false, reason: 'missing' };
    const parsed = safeParse(raw);
    if (!parsed.ok) return { ok: false, reason: 'parse-error', error: parsed.error };
    if (!isSaveEnvelope(parsed.value)) return { ok: false, reason: 'invalid-envelope' };
    const migrated = migrateSaveEnvelope(parsed.value, config.version, config.migrations);
    if (!migrated.ok) return migrated as LoadSaveResult<TState, TSummary>;
    if (config.validate && !config.validate(migrated.state)) {
      return { ok: false, reason: 'validation-failed', envelope: migrated.envelope };
    }
    return {
      ok: true,
      state: migrated.state as TState,
      envelope: migrated.envelope as SaveEnvelope<TState, TSummary>,
      migrated: migrated.migrated,
    };
  } catch (error) {
    config.onError?.('load', error);
    return { ok: false, reason: 'storage-error', error };
  }
}

async function readSlotIndex(storage: SaveStorage, key: string): Promise<string[]> {
  const raw = await storage.getItem(key);
  if (!raw) return [];
  const parsed = safeParse(raw);
  if (!parsed.ok || !Array.isArray(parsed.value)) return [];
  return parsed.value.filter((item): item is string => typeof item === 'string');
}

async function writeSlotIndex(storage: SaveStorage, key: string, ids: readonly string[]): Promise<void> {
  await storage.setItem(key, JSON.stringify(ids));
}

async function withStorageErrors<T>(
  operation: string,
  config: { onError?: (operation: string, error: unknown) => void },
  run: () => Promise<T>,
  fallback?: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    config.onError?.(operation, error);
    if (arguments.length >= 4) return fallback as T;
    throw error;
  }
}

function currentIso<TState, TSummary>(config: SaveSystemConfig<TState, TSummary>): string {
  const value = config.now?.() ?? new Date();
  return typeof value === 'string' ? value : value.toISOString();
}

function safeParse(raw: string): { ok: true; value: unknown } | { ok: false; error: unknown } {
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch (error) {
    return { ok: false, error };
  }
}
