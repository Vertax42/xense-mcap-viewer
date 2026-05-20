import { useSyncExternalStore } from 'react';

export interface PanelActionHandlers {
  /** Whether this panel registered a `renderSettings` editor. */
  hasSettings: boolean;
  /**
   * Activate the panel inside DockView and surface its settings editor in
   * the app sidebar. Called by the gear icon in the tab header.
   */
  openSettingsSidebar: () => void;
  resetPanel: () => void;
  copyPanelId: () => void;
  duplicatePanel: () => void;
  closePanel: () => void;
}

type Listener = () => void;

const handlersByPanelId = new Map<string, PanelActionHandlers>();
const listeners = new Set<Listener>();

function notify(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function registerPanelActions(panelId: string, handlers: PanelActionHandlers): void {
  handlersByPanelId.set(panelId, handlers);
  notify();
}

export function unregisterPanelActions(panelId: string): void {
  if (handlersByPanelId.delete(panelId)) {
    notify();
  }
}

export function getPanelActions(panelId: string): PanelActionHandlers | undefined {
  return handlersByPanelId.get(panelId);
}

/** React binding: re-render when a panel registers or unregisters action handlers. */
export function usePanelActions(panelId: string | null | undefined): PanelActionHandlers | undefined {
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => handlersByPanelId.get(panelId ?? ''),
    () => handlersByPanelId.get(panelId ?? ''),
  );
  return panelId ? handlersByPanelId.get(panelId) : undefined;
}
