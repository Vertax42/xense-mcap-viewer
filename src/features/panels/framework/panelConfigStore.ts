import { useSyncExternalStore } from 'react';

/**
 * Live store of every mounted panel's typed config, keyed by `panelId`.
 *
 * The config store is the single source of truth at runtime:
 * - `PanelRuntimeShell` seeds it on mount and updates it via `setConfig`.
 * - The sidebar's Settings tab reads/writes the same record so that
 *   edits made from outside the panel body are reflected immediately.
 * - Layout export snapshots each panel's config straight from this store.
 *
 * Intentionally framework-agnostic: implemented with a plain `Map` plus
 * a listener set so tests (and non-React callers) can use it as well.
 */

type Listener = () => void;

const configs = new Map<string, unknown>();
const listenersByPanelId = new Map<string, Set<Listener>>();
const globalListeners = new Set<Listener>();

function notify(panelId: string): void {
  const perPanel = listenersByPanelId.get(panelId);
  if (perPanel) {
    for (const listener of perPanel) {
      listener();
    }
  }
  for (const listener of globalListeners) {
    listener();
  }
}

export function getPanelConfig<TConfig = unknown>(panelId: string): TConfig | undefined {
  return configs.get(panelId) as TConfig | undefined;
}

export function hasPanelConfig(panelId: string): boolean {
  return configs.has(panelId);
}

export function setPanelConfig<TConfig = unknown>(panelId: string, next: TConfig): void {
  configs.set(panelId, next);
  notify(panelId);
}

/**
 * Seed a panel's config only if it isn't already present. Useful on mount
 * so that multiple re-renders (or React strict-mode double mounts) don't
 * clobber existing state.
 */
export function ensurePanelConfig<TConfig = unknown>(panelId: string, seed: TConfig): TConfig {
  if (!configs.has(panelId)) {
    configs.set(panelId, seed);
    notify(panelId);
    return seed;
  }
  return configs.get(panelId) as TConfig;
}

export function removePanelConfig(panelId: string): void {
  if (configs.delete(panelId)) {
    notify(panelId);
  }
}

/**
 * Replace every entry in the store in a single operation. Used when a
 * layout import wipes out the previous session.
 */
export function replacePanelConfigs(next: Record<string, unknown>): void {
  const previousIds = new Set(configs.keys());
  configs.clear();
  for (const [id, cfg] of Object.entries(next)) {
    configs.set(id, cfg);
  }
  for (const id of previousIds) {
    notify(id);
  }
  for (const id of Object.keys(next)) {
    if (!previousIds.has(id)) {
      notify(id);
    }
  }
}

export function listPanelConfigs(): Record<string, unknown> {
  return Object.fromEntries(configs.entries());
}

/** Subscribe to changes for a specific panel id. Returns an unsubscribe fn. */
export function subscribePanelConfig(panelId: string, listener: Listener): () => void {
  let bucket = listenersByPanelId.get(panelId);
  if (!bucket) {
    bucket = new Set();
    listenersByPanelId.set(panelId, bucket);
  }
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
    if (bucket.size === 0) {
      listenersByPanelId.delete(panelId);
    }
  };
}

/** Subscribe to every store mutation. Returns an unsubscribe fn. */
export function subscribeAllPanelConfigs(listener: Listener): () => void {
  globalListeners.add(listener);
  return () => {
    globalListeners.delete(listener);
  };
}

/**
 * React binding for reading a single panel's config. Triggers a re-render
 * whenever that panel's config mutates. Returns `undefined` when the id
 * has not been seeded yet.
 */
export function usePanelConfig<TConfig>(panelId: string): TConfig | undefined {
  return useSyncExternalStore(
    (listener) => subscribePanelConfig(panelId, listener),
    () => configs.get(panelId) as TConfig | undefined,
    () => configs.get(panelId) as TConfig | undefined,
  );
}
