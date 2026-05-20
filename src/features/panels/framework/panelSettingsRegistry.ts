import { useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { PanelSettingsContext } from './types';

/**
 * Registry of every mounted panel's `renderSettings` function, keyed by
 * `panelId`. `PanelRuntimeShell` registers on mount and clears on unmount;
 * the Sidebar "Settings" tab reads from the registry to render the active
 * panel's settings editor without having to import panel modules directly.
 */

export type PanelSettingsRenderer = (ctx: PanelSettingsContext<unknown>) => ReactNode;

type Listener = () => void;

const renderers = new Map<string, PanelSettingsRenderer>();
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function registerPanelSettings(panelId: string, renderer: PanelSettingsRenderer): void {
  renderers.set(panelId, renderer);
  notify();
}

export function unregisterPanelSettings(panelId: string): void {
  if (renderers.delete(panelId)) {
    notify();
  }
}

export function getPanelSettingsRenderer(panelId: string): PanelSettingsRenderer | undefined {
  return renderers.get(panelId);
}

export function hasPanelSettingsRenderer(panelId: string): boolean {
  return renderers.has(panelId);
}

/** React binding: re-render whenever any panel registers or unregisters. */
export function usePanelSettingsRegistryVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => renderers.size,
    () => renderers.size,
  );
}

/** React binding: observe a specific panel's renderer (returns undefined when absent). */
export function usePanelSettingsRenderer(
  panelId: string | null | undefined,
): PanelSettingsRenderer | undefined {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => renderers.size,
    () => renderers.size,
  );
  return panelId ? renderers.get(panelId) : undefined;
}
