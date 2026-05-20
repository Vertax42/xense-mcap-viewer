export type McapViewerLanguageCode = 'en' | 'zh' | 'ja';

/** Persisted theme: light/dark only (navbar); `system` is resolved at runtime, not stored yet. */
export type McapViewerPersistedTheme = 'light' | 'dark';

export type McapViewerUiTheme = 'light' | 'dark' | 'system';

export const MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION = 1 as const;

export type McapViewerPreferencesV1 = {
  schemaVersion: typeof MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION;
  theme?: McapViewerPersistedTheme;
  language?: McapViewerLanguageCode;
  sidebarWidth?: number;
  sidebarPanelPercent?: number;
  autoDataQualityScan?: boolean;
};

export type PreferencePersistence = 'localStorage' | 'off';
