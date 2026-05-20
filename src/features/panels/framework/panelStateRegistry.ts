import type { PanelInstanceSnapshot } from './types';

const panelStateById = new Map<string, PanelInstanceSnapshot>();

export function upsertPanelState(snapshot: PanelInstanceSnapshot): void {
  panelStateById.set(snapshot.id, snapshot);
}

export function removePanelState(panelId: string): void {
  panelStateById.delete(panelId);
}

export function getPanelState(panelId: string): PanelInstanceSnapshot | undefined {
  return panelStateById.get(panelId);
}

export function listPanelStates(): Record<string, PanelInstanceSnapshot> {
  return Object.fromEntries(panelStateById.entries());
}

export function replacePanelStates(next: Record<string, PanelInstanceSnapshot>): void {
  panelStateById.clear();
  for (const [id, snapshot] of Object.entries(next)) {
    panelStateById.set(id, snapshot);
  }
}
