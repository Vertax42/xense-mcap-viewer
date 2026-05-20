import type { DockviewTheme } from 'dockview-core';

/**
 * Xense MCAP Viewer Dockview chrome themes.
 * Keep built-in `dockview-theme-*` for Dockview defaults, and layer `xense-dockview-theme-*`
 * for explicit light/dark tab-strip tokens (see index.css).
 *
 * v6 theme properties:
 * - colorScheme: lets panel content adapt to light/dark
 * - dndPanelOverlay: 'group' covers the entire group (tab bar + content) for more visible drop feedback
 * - dndOverlayBorder: prominent border on the drop target overlay
 */
export const xenseDockviewThemeLight: DockviewTheme = {
  name: 'rosview-light',
  className: 'dockview-theme-light xense-dockview-theme-light',
  colorScheme: 'light',
  dndPanelOverlay: 'group',
  dndOverlayBorder: '2px solid rgba(33, 150, 243, 0.7)',
  tabAnimation: 'smooth',
  dndTabIndicator: 'line',
};

export const xenseDockviewThemeDark: DockviewTheme = {
  name: 'rosview-dark',
  className: 'dockview-theme-dark xense-dockview-theme-dark',
  colorScheme: 'dark',
  dndPanelOverlay: 'group',
  dndOverlayBorder: '2px solid rgba(33, 150, 243, 0.75)',
  tabAnimation: 'smooth',
  dndTabIndicator: 'line',
};
