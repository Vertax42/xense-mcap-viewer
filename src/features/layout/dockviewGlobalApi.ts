import type { DockviewApi } from 'dockview';

/**
 * Module-level singleton for the active DockviewApi instance.
 * Extracted here to avoid a circular dependency between DockviewLayout
 * (which creates the api) and WelcomePanelContent (which needs to close panels).
 */

let _api: DockviewApi | null = null;

export function setGlobalDockviewApi(api: DockviewApi | null): void {
  _api = api;
}

export function getDockviewApi(): DockviewApi | null {
  return _api;
}
