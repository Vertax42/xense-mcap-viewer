import {
  MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION,
  type McapViewerLanguageCode,
  type McapViewerPreferencesV1,
  type McapViewerPersistedTheme,
} from './types';
import { MCAP_VIEWER_PREFERENCES_STORAGE_KEY } from './storageKeys';

const LANGUAGE_SET = new Set<McapViewerLanguageCode>(['en', 'zh']);
const PERSISTED_THEME_SET = new Set<McapViewerPersistedTheme>(['light', 'dark']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function narrowLanguage(value: unknown): McapViewerLanguageCode | undefined {
  return typeof value === 'string' && LANGUAGE_SET.has(value as McapViewerLanguageCode)
    ? (value as McapViewerLanguageCode)
    : undefined;
}

function narrowPersistedTheme(value: unknown): McapViewerPersistedTheme | undefined {
  return typeof value === 'string' && PERSISTED_THEME_SET.has(value as McapViewerPersistedTheme)
    ? (value as McapViewerPersistedTheme)
    : undefined;
}

function narrowSidebarWidth(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}

function narrowSidebarPanelPercent(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 100 ? value : undefined;
}

function narrowBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

/** Read and validate prefs from localStorage; returns null on parse/version mismatch. */
export function readPreferences(): McapViewerPreferencesV1 | null {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return null;
  }
  try {
    const raw = globalThis.localStorage.getItem(MCAP_VIEWER_PREFERENCES_STORAGE_KEY);
    if (raw == null || raw === '') return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) return null;
    if (parsed.schemaVersion !== MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION) return null;
    const theme = narrowPersistedTheme(parsed.theme);
    const language = narrowLanguage(parsed.language);
    const sidebarWidth = narrowSidebarWidth(parsed.sidebarWidth);
    const sidebarPanelPercent = narrowSidebarPanelPercent(parsed.sidebarPanelPercent);
    const autoDataQualityScan = narrowBoolean(parsed.autoDataQualityScan);
    const out: McapViewerPreferencesV1 = { schemaVersion: MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION };
    if (theme !== undefined) out.theme = theme;
    if (language !== undefined) out.language = language;
    if (sidebarWidth !== undefined) out.sidebarWidth = sidebarWidth;
    if (sidebarPanelPercent !== undefined) out.sidebarPanelPercent = sidebarPanelPercent;
    if (autoDataQualityScan !== undefined) out.autoDataQualityScan = autoDataQualityScan;
    return out;
  } catch {
    return null;
  }
}

/** Merge patch into stored prefs and write back (browser + localStorage only). */
export function writePreferences(patch: {
  theme?: McapViewerPersistedTheme;
  language?: McapViewerLanguageCode;
  sidebarWidth?: number;
  sidebarPanelPercent?: number;
  autoDataQualityScan?: boolean;
}): void {
  if (typeof globalThis === 'undefined' || !('localStorage' in globalThis)) {
    return;
  }
  try {
    const prev = readPreferences();
    const merged: McapViewerPreferencesV1 = {
      schemaVersion: MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION,
    };
    if (patch.theme !== undefined) merged.theme = patch.theme;
    else if (prev?.theme !== undefined) merged.theme = prev.theme;

    if (patch.language !== undefined) merged.language = patch.language;
    else if (prev?.language !== undefined) merged.language = prev.language;

    if (patch.sidebarWidth !== undefined) merged.sidebarWidth = patch.sidebarWidth;
    else if (prev?.sidebarWidth !== undefined) merged.sidebarWidth = prev.sidebarWidth;

    if (patch.sidebarPanelPercent !== undefined) merged.sidebarPanelPercent = patch.sidebarPanelPercent;
    else if (prev?.sidebarPanelPercent !== undefined) merged.sidebarPanelPercent = prev.sidebarPanelPercent;

    if (patch.autoDataQualityScan !== undefined) merged.autoDataQualityScan = patch.autoDataQualityScan;
    else if (prev?.autoDataQualityScan !== undefined) merged.autoDataQualityScan = prev.autoDataQualityScan;

    if (merged.theme === undefined) delete merged.theme;
    if (merged.language === undefined) delete merged.language;
    if (merged.sidebarWidth === undefined) delete merged.sidebarWidth;
    if (merged.sidebarPanelPercent === undefined) delete merged.sidebarPanelPercent;
    if (merged.autoDataQualityScan === undefined) delete merged.autoDataQualityScan;

    globalThis.localStorage.setItem(MCAP_VIEWER_PREFERENCES_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // e.g. private mode or quota errors
  }
}
