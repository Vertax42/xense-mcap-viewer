import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearSavedDockviewLayout,
  readSavedDockviewLayout,
  saveDockviewLayoutToStorage,
} from './layoutStorage';
import { MCAP_VIEWER_LAYOUT_STORAGE_KEY } from './storageKeys';
import type { FoxgloveLayoutData } from './foxgloveLayout';

const validLayout: FoxgloveLayoutData = {
  layout: '3D!abc',
  configById: { '3D!abc': { foxglovePanelTitle: '3D' } },
  globalVariables: {},
  userNodes: {},
};

describe('layoutStorage', () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => (storage.has(k) ? storage.get(k)! : null),
        setItem: (k: string, v: string) => {
          storage.set(k, v);
        },
        removeItem: (k: string) => {
          storage.delete(k);
        },
      },
      configurable: true,
    });
  });

  it('returns null when empty', () => {
    expect(readSavedDockviewLayout()).toBeNull();
  });

  it('saves and reads a valid Foxglove layout', () => {
    saveDockviewLayoutToStorage(validLayout);
    const read = readSavedDockviewLayout();
    expect(read).not.toBeNull();
    expect(read?.layout).toBe('3D!abc');
    expect(read?.configById['3D!abc']).toEqual({ foxglovePanelTitle: '3D' });
  });

  it('returns null for corrupt JSON', () => {
    storage.set(MCAP_VIEWER_LAYOUT_STORAGE_KEY, 'not-json');
    expect(readSavedDockviewLayout()).toBeNull();
  });

  it('returns null for non-object payload', () => {
    storage.set(MCAP_VIEWER_LAYOUT_STORAGE_KEY, JSON.stringify(42));
    expect(readSavedDockviewLayout()).toBeNull();
  });

  it('hard-cuts legacy V1 payloads and clears the key', () => {
    storage.set(
      MCAP_VIEWER_LAYOUT_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 1, dockview: { panels: {} }, panels: {} }),
    );
    expect(readSavedDockviewLayout()).toBeNull();
    expect(storage.has(MCAP_VIEWER_LAYOUT_STORAGE_KEY)).toBe(false);
  });

  it('clear removes key', () => {
    saveDockviewLayoutToStorage(validLayout);
    clearSavedDockviewLayout();
    expect(readSavedDockviewLayout()).toBeNull();
  });
});
