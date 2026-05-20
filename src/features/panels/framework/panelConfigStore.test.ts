import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ensurePanelConfig,
  getPanelConfig,
  hasPanelConfig,
  listPanelConfigs,
  removePanelConfig,
  replacePanelConfigs,
  setPanelConfig,
  subscribeAllPanelConfigs,
  subscribePanelConfig,
} from './panelConfigStore';

/**
 * The store is a simple keyed Map with listener sets; these tests pin down
 * the invariants the Sidebar settings tab and PanelRuntimeShell rely on.
 */

describe('panelConfigStore', () => {
  beforeEach(() => {
    // Clear state by replacing with an empty map.
    replacePanelConfigs({});
  });

  it('stores and retrieves a config', () => {
    expect(hasPanelConfig('Image!a')).toBe(false);
    setPanelConfig('Image!a', { topic: '/cam' });
    expect(hasPanelConfig('Image!a')).toBe(true);
    expect(getPanelConfig('Image!a')).toEqual({ topic: '/cam' });
  });

  it('ensurePanelConfig is idempotent and does not clobber existing data', () => {
    ensurePanelConfig('3D!x', { pointSize: 0.05 });
    ensurePanelConfig('3D!x', { pointSize: 999 });
    expect(getPanelConfig('3D!x')).toEqual({ pointSize: 0.05 });
  });

  it('replacePanelConfigs wipes out previous entries', () => {
    setPanelConfig('Image!a', { topic: '/a' });
    setPanelConfig('Image!b', { topic: '/b' });
    replacePanelConfigs({ 'Image!c': { topic: '/c' } });
    expect(listPanelConfigs()).toEqual({ 'Image!c': { topic: '/c' } });
  });

  it('notifies per-panel subscribers only for their id', () => {
    const listenerA = vi.fn();
    const listenerB = vi.fn();
    subscribePanelConfig('Image!a', listenerA);
    subscribePanelConfig('Image!b', listenerB);
    setPanelConfig('Image!a', { topic: '/a' });
    expect(listenerA).toHaveBeenCalledTimes(1);
    expect(listenerB).not.toHaveBeenCalled();
  });

  it('notifies global subscribers on every mutation', () => {
    const globalListener = vi.fn();
    subscribeAllPanelConfigs(globalListener);
    setPanelConfig('Image!a', { topic: '/a' });
    setPanelConfig('Image!a', { topic: '/b' });
    removePanelConfig('Image!a');
    expect(globalListener).toHaveBeenCalledTimes(3);
  });

  it('unsubscribe prevents further notifications', () => {
    const listener = vi.fn();
    const unsub = subscribePanelConfig('X!1', listener);
    setPanelConfig('X!1', 'first');
    unsub();
    setPanelConfig('X!1', 'second');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
