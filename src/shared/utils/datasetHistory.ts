/**
 * Recent dataset opens for the welcome screen (IndexedDB).
 * Persists FileSystemFileHandle / FileSystemDirectoryHandle when available for replay after refresh.
 */

import type { SourceLocatorLocalFile, SourceLocatorLocalFolder } from './sourceLocator';

const DB_NAME = 'xense.mcap.datasetHistory';
const DB_VERSION = 1;
const STORE = 'entries';
const MAX_ENTRIES = 50;

export type DatasetHistoryStoredKind =
  | 'url'
  | 'remote_tar'
  | 'directory'
  | 'directory_fallback'
  | 'files'
  | 'file_meta'
  | 'local_tar'
  | 'sample';

export type DatasetHistoryStoredEntry = {
  id: string;
  openedAt: number;
  kind: DatasetHistoryStoredKind;
  /** Primary label (file name, URL tail, folder name, sample title) */
  displayName: string;
  /** Optional second line */
  detail?: string;
  url?: string;
  sampleId?: string;
  /** When kind is `files` and browser supports handles */
  fileHandles?: FileSystemFileHandle[];
  directoryHandle?: FileSystemDirectoryHandle;
  /** Persisted dedupe key for upsert (optional on legacy rows) */
  dedupeKey?: string;
  /** Sorted fingerprint of local file set for `files` / `file_meta` */
  fileSetFingerprint?: string;
  /** `name:size:lastModified` for local tar */
  tarFingerprint?: string;
};

export type DatasetHistoryListItem = {
  id: string;
  openedAt: number;
  kind: DatasetHistoryStoredKind;
  displayName: string;
  detail?: string;
  replayable: boolean;
};

export type FileLikeFingerprint = Pick<File, 'name' | 'size' | 'lastModified'>;

function supportsIndexedDb(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(rejectReason(req.error, 'IndexedDB open failed'));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('openedAt', 'openedAt', { unique: false });
      }
    };
  });
}

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function rejectReason(reason: unknown, fallbackMessage: string): Error {
  if (reason instanceof Error) return reason;
  if (reason == null) return new Error(fallbackMessage);
  if (typeof reason === 'string' || typeof reason === 'number' || typeof reason === 'boolean') {
    return new Error(`${fallbackMessage}: ${reason}`);
  }
  try {
    return new Error(`${fallbackMessage}: ${JSON.stringify(reason)}`);
  } catch {
    return new Error(fallbackMessage);
  }
}

/** Normalize HTTP(S) URL for stable dedupe (hostname lowercased; path/query kept). */
export function normalizeDatasetHistoryUrl(raw: string): string {
  const trimmed = raw.trim();
  try {
    const u = new URL(trimmed);
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      u.hostname = u.hostname.toLowerCase();
      u.hash = '';
      return u.toString();
    }
  } catch {
    /* fall through */
  }
  return trimmed.toLowerCase();
}

/** Stable fingerprint for a set of local files (order-independent). */
export function fingerprintRosFileSet(files: FileLikeFingerprint[]): string {
  if (files.length === 0) return '';
  const sorted = [...files].sort((a, b) => {
    const c = a.name.localeCompare(b.name);
    if (c !== 0) return c;
    if (a.size !== b.size) return a.size - b.size;
    return a.lastModified - b.lastModified;
  });
  return sorted.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|');
}

export function tarFileFingerprint(file: FileLikeFingerprint): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Dedupe key for a stored or partial entry. Legacy rows without fingerprints fall back to displayName-based keys.
 */
export function computeDatasetHistoryDedupeKey(
  entry: DatasetHistoryStoredEntry | (Omit<DatasetHistoryStoredEntry, 'id' | 'openedAt'> & { id?: string; openedAt?: number }),
): string | null {
  if (entry.dedupeKey?.trim()) return entry.dedupeKey.trim();
  switch (entry.kind) {
    case 'url':
      return entry.url?.trim() ? `url:${normalizeDatasetHistoryUrl(entry.url.trim())}` : null;
    case 'remote_tar':
      return entry.url?.trim() ? `remote_tar:${normalizeDatasetHistoryUrl(entry.url.trim())}` : null;
    case 'sample':
      if (entry.sampleId?.trim()) return `sample:id:${entry.sampleId.trim()}`;
      return entry.url?.trim() ? `sample:url:${normalizeDatasetHistoryUrl(entry.url.trim())}` : null;
    case 'directory':
      return entry.directoryHandle ? `directory:${entry.directoryHandle.name}` : null;
    case 'directory_fallback':
      return 'directory_fallback';
    case 'files':
    case 'file_meta':
      if (entry.fileSetFingerprint) return `fileset:${entry.fileSetFingerprint}`;
      return entry.displayName.trim() ? `fileset_legacy:${entry.displayName.trim().toLowerCase()}` : null;
    case 'local_tar':
      if (entry.tarFingerprint) return `local_tar:${entry.tarFingerprint}`;
      return entry.displayName.trim() ? `local_tar_legacy:${entry.displayName.trim().toLowerCase()}` : null;
    default:
      return null;
  }
}

function shouldReplaceHistoryRow(current: DatasetHistoryStoredEntry, next: DatasetHistoryStoredEntry): boolean {
  const currentHasHandles =
    current.kind === 'files' && Array.isArray(current.fileHandles) && current.fileHandles.length > 0;
  const nextHasHandles = next.kind === 'files' && Array.isArray(next.fileHandles) && next.fileHandles.length > 0;
  if (nextHasHandles !== currentHasHandles) {
    return nextHasHandles;
  }
  return next.openedAt > current.openedAt;
}

function mergeStoredHistoryEntry(
  keeper: DatasetHistoryStoredEntry,
  patch: Omit<DatasetHistoryStoredEntry, 'id' | 'openedAt'> & { openedAt: number },
): DatasetHistoryStoredEntry {
  const openedAt = Math.max(keeper.openedAt, patch.openedAt);
  const key = computeDatasetHistoryDedupeKey(keeper);
  if (keeper.kind === 'url' || keeper.kind === 'remote_tar' || keeper.kind === 'sample') {
    return {
      ...keeper,
      id: keeper.id,
      openedAt,
      dedupeKey: key ?? keeper.dedupeKey,
      kind: patch.kind ?? keeper.kind,
      url: patch.url?.trim() ? patch.url.trim() : keeper.url,
      sampleId: patch.sampleId ?? keeper.sampleId,
      displayName: patch.displayName?.trim() ? patch.displayName : keeper.displayName,
      detail: patch.detail !== undefined ? patch.detail : keeper.detail,
    };
  }
  if (keeper.kind === 'directory_fallback') {
    return {
      ...keeper,
      id: keeper.id,
      openedAt,
      dedupeKey: key ?? keeper.dedupeKey,
      displayName: patch.displayName?.trim() ? patch.displayName : keeper.displayName,
      detail: patch.detail !== undefined ? patch.detail : keeper.detail,
    };
  }
  if (keeper.kind === 'files' || keeper.kind === 'file_meta') {
    const handles =
      patch.fileHandles && patch.fileHandles.length > 0 ? patch.fileHandles : keeper.fileHandles;
    const hasHandles = Boolean(handles && handles.length > 0);
    const next: DatasetHistoryStoredEntry = {
      ...keeper,
      id: keeper.id,
      openedAt,
      dedupeKey: key ?? keeper.dedupeKey,
      kind: hasHandles ? 'files' : 'file_meta',
      displayName: patch.displayName?.trim() ? patch.displayName : keeper.displayName,
      detail: patch.detail !== undefined ? patch.detail : keeper.detail,
      fileSetFingerprint: patch.fileSetFingerprint ?? keeper.fileSetFingerprint,
    };
    if (hasHandles && handles) {
      next.fileHandles = handles;
    } else {
      delete next.fileHandles;
    }
    return next;
  }
  if (keeper.kind === 'directory') {
    return {
      ...keeper,
      id: keeper.id,
      openedAt,
      dedupeKey: key ?? keeper.dedupeKey,
      directoryHandle: patch.directoryHandle ?? keeper.directoryHandle,
      displayName: patch.displayName?.trim() ? patch.displayName : keeper.displayName,
      detail: patch.detail !== undefined ? patch.detail : keeper.detail,
    };
  }
  if (keeper.kind === 'local_tar') {
    return {
      ...keeper,
      id: keeper.id,
      openedAt,
      dedupeKey: key ?? keeper.dedupeKey,
      displayName: patch.displayName?.trim() ? patch.displayName : keeper.displayName,
      detail: patch.detail !== undefined ? patch.detail : keeper.detail,
      tarFingerprint: patch.tarFingerprint ?? keeper.tarFingerprint,
    };
  }
  return {
    ...keeper,
    id: keeper.id,
    openedAt,
    dedupeKey: key ?? keeper.dedupeKey,
    displayName: patch.displayName?.trim() ? patch.displayName : keeper.displayName,
    detail: patch.detail !== undefined ? patch.detail : keeper.detail,
  };
}

function keeperMergePrecedence(row: DatasetHistoryStoredEntry): number {
  const handleBoost =
    row.kind === 'files' && Array.isArray(row.fileHandles) && row.fileHandles.length > 0 ? 1e15 : 0;
  return handleBoost + row.openedAt;
}

function pickKeeperForMerge(matches: DatasetHistoryStoredEntry[]): DatasetHistoryStoredEntry {
  let best = matches[0];
  for (let i = 1; i < matches.length; i++) {
    const m = matches[i];
    if (keeperMergePrecedence(m) > keeperMergePrecedence(best)) {
      best = m;
    }
  }
  return best;
}

function dedupeHistoryRows(rows: DatasetHistoryStoredEntry[]): DatasetHistoryStoredEntry[] {
  const map = new Map<string, DatasetHistoryStoredEntry>();
  const noKey: DatasetHistoryStoredEntry[] = [];
  for (const row of rows) {
    const key = computeDatasetHistoryDedupeKey(row);
    if (!key) {
      noKey.push(row);
      continue;
    }
    const current = map.get(key);
    if (!current || shouldReplaceHistoryRow(current, row)) {
      map.set(key, row);
    }
  }
  return [...noKey, ...map.values()];
}

function isReplayable(entry: DatasetHistoryStoredEntry): boolean {
  switch (entry.kind) {
    case 'url':
    case 'remote_tar':
    case 'sample':
      return !!entry.url?.trim();
    case 'directory':
      return !!entry.directoryHandle;
    case 'files':
      return Array.isArray(entry.fileHandles) && entry.fileHandles.length > 0;
    case 'directory_fallback':
    case 'file_meta':
    case 'local_tar':
      return false;
    default:
      return false;
  }
}

export function toListItem(entry: DatasetHistoryStoredEntry): DatasetHistoryListItem {
  return {
    id: entry.id,
    openedAt: entry.openedAt,
    kind: entry.kind,
    displayName: entry.displayName,
    detail: entry.detail,
    replayable: isReplayable(entry),
  };
}

async function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    tx.onerror = () => reject(rejectReason(tx.error, 'IndexedDB transaction failed'));
    tx.oncomplete = () => db.close();
    void Promise.resolve(fn(store)).then(resolve, reject);
  });
}

function getAllFromStore(store: IDBObjectStore): Promise<DatasetHistoryStoredEntry[]> {
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onerror = () => reject(rejectReason(req.error, 'IndexedDB getAll failed'));
    req.onsuccess = () => resolve((req.result as DatasetHistoryStoredEntry[]) ?? []);
  });
}

function deleteFromStore(store: IDBObjectStore, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const d = store.delete(id);
    d.onerror = () => reject(rejectReason(d.error, 'IndexedDB delete failed'));
    d.onsuccess = () => resolve();
  });
}

function putToStore(store: IDBObjectStore, row: DatasetHistoryStoredEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = store.put(row);
    req.onerror = () => reject(rejectReason(req.error, 'IndexedDB put failed'));
    req.onsuccess = () => resolve();
  });
}

async function trimOldEntries(store: IDBObjectStore): Promise<void> {
  const all = await getAllFromStore(store);
  if (all.length <= MAX_ENTRIES) return;
  const sorted = [...all].sort((a, b) => a.openedAt - b.openedAt);
  const toDelete = sorted.slice(0, all.length - MAX_ENTRIES);
  for (const row of toDelete) {
    await deleteFromStore(store, row.id);
  }
}

function assignWriteMetadata(
  entry: Omit<DatasetHistoryStoredEntry, 'id' | 'openedAt'> & { id?: string; openedAt?: number },
  openedAt: number,
): DatasetHistoryStoredEntry {
  const id = entry.id ?? randomId();
  const key = computeDatasetHistoryDedupeKey({ ...entry, id, openedAt });
  return {
    ...entry,
    id,
    openedAt,
    dedupeKey: key ?? entry.dedupeKey,
  };
}

export async function listDatasetHistory(): Promise<DatasetHistoryListItem[]> {
  if (!supportsIndexedDb()) return [];
  try {
    const rows = await withStore('readonly', (store) => getAllFromStore(store));
    return dedupeHistoryRows(rows)
      .map(toListItem)
      .sort((a, b) => b.openedAt - a.openedAt);
  } catch {
    return [];
  }
}

export async function getDatasetHistoryEntry(id: string): Promise<DatasetHistoryStoredEntry | null> {
  if (!supportsIndexedDb()) return null;
  try {
    return await withStore('readonly', (store) => {
      return new Promise<DatasetHistoryStoredEntry | null>((resolve, reject) => {
        const req = store.get(id);
        req.onerror = () => reject(rejectReason(req.error, 'IndexedDB get failed'));
        req.onsuccess = () => resolve((req.result as DatasetHistoryStoredEntry | undefined) ?? null);
      });
    });
  } catch {
    return null;
  }
}

export type SpaLocalHistoryLocator = SourceLocatorLocalFile | SourceLocatorLocalFolder;

/**
 * Latest replayable history row for SPA `file://` / `folder://` locators (match by display name).
 * Ambiguous when multiple sources share the same name; caller picks "most recent".
 */
export async function getLatestReplayableHistoryByLocalLocator(
  locator: SpaLocalHistoryLocator,
): Promise<DatasetHistoryStoredEntry | null> {
  if (!supportsIndexedDb()) return null;
  const name = locator.displayName.trim();
  if (!name) return null;
  try {
    return await withStore('readonly', async (store) => {
      const all = await getAllFromStore(store);
      const matches = all.filter((row) => {
        if (!isReplayable(row)) return false;
        if (locator.kind === 'local_folder') {
          return row.kind === 'directory' && row.displayName === name && !!row.directoryHandle;
        }
        return row.kind === 'files' && row.displayName === name;
      });
      if (matches.length === 0) return null;
      matches.sort((a, b) => b.openedAt - a.openedAt);
      return matches[0] ?? null;
    });
  } catch {
    return null;
  }
}

/**
 * Insert or merge by dedupe key, delete duplicate rows, then trim to MAX_ENTRIES.
 */
export async function upsertDatasetHistoryEntry(
  entry: Omit<DatasetHistoryStoredEntry, 'id' | 'openedAt'> & { id?: string; openedAt?: number },
): Promise<DatasetHistoryStoredEntry> {
  const openedAt = entry.openedAt ?? Date.now();
  if (!supportsIndexedDb()) {
    return assignWriteMetadata(entry, openedAt);
  }
  const incomingPrepared = assignWriteMetadata(entry, openedAt);
  const key = computeDatasetHistoryDedupeKey(incomingPrepared);
  if (!key) {
    await withStore('readwrite', async (store) => {
      await putToStore(store, incomingPrepared);
      await trimOldEntries(store);
    });
    return incomingPrepared;
  }
  return await withStore('readwrite', async (store) => {
    const all = await getAllFromStore(store);
    const matches = all.filter((r) => computeDatasetHistoryDedupeKey(r) === key);
    let merged: DatasetHistoryStoredEntry;
    if (matches.length === 0) {
      merged = { ...incomingPrepared, dedupeKey: key };
    } else {
      const keeper = pickKeeperForMerge(matches);
      merged = mergeStoredHistoryEntry(keeper, {
        ...entry,
        openedAt: incomingPrepared.openedAt,
      });
      merged.dedupeKey = key;
      for (const m of matches) {
        if (m.id !== merged.id) {
          await deleteFromStore(store, m.id);
        }
      }
    }
    await putToStore(store, merged);
    await trimOldEntries(store);
    return merged;
  });
}

/** @deprecated Prefer `upsertDatasetHistoryEntry`; kept for compatibility. */
export async function addDatasetHistoryEntry(
  entry: Omit<DatasetHistoryStoredEntry, 'id' | 'openedAt'> & { id?: string; openedAt?: number },
): Promise<DatasetHistoryStoredEntry> {
  return upsertDatasetHistoryEntry(entry);
}

type FileSystemHandleWithPermissions = FileSystemFileHandle | FileSystemDirectoryHandle;

/** Request read permission when needed; returns false if denied or unsupported. */
export async function ensureReadPermission(handle: FileSystemHandleWithPermissions): Promise<boolean> {
  const anyHandle = handle as FileSystemHandleWithPermissions & {
    queryPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
    requestPermission?: (o: { mode: 'read' }) => Promise<PermissionState>;
  };
  if (typeof anyHandle.queryPermission !== 'function') {
    return true;
  }
  try {
    let state = await anyHandle.queryPermission({ mode: 'read' });
    if (state === 'granted') return true;
    if (typeof anyHandle.requestPermission === 'function') {
      state = await anyHandle.requestPermission({ mode: 'read' });
    }
    return state === 'granted';
  } catch {
    return false;
  }
}
