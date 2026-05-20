import type {
  PreferencePersistence,
  McapViewerLanguageCode,
  McapViewerPersistedTheme,
  McapViewerPreferencesV1,
  McapViewerUiTheme,
} from './types';

export type MergeInitialUiPreferencesInput = {
  persistence: PreferencePersistence;
  /** Parent-controlled `theme` (`undefined` means leave that axis unmanaged). */
  propsTheme?: McapViewerUiTheme;
  propsLanguage?: McapViewerLanguageCode;
  urlTheme?: string | null;
  urlLanguage?: string | null;
  /** Result of `readPreferences()`; pass `null` when `persistence === 'off'`. */
  stored: McapViewerPreferencesV1 | null;
};

const UI_THEME = new Set<McapViewerUiTheme>(['light', 'dark', 'system']);
const LANG = new Set<McapViewerLanguageCode>(['en', 'zh', 'ja']);

function parseUrlTheme(raw: string | null | undefined): McapViewerUiTheme | undefined {
  if (raw == null || raw === '') return undefined;
  const v = raw.trim().toLowerCase();
  return UI_THEME.has(v as McapViewerUiTheme) ? (v as McapViewerUiTheme) : undefined;
}

function parseUrlLanguage(raw: string | null | undefined): McapViewerLanguageCode | undefined {
  if (raw == null || raw === '') return undefined;
  const v = raw.trim().toLowerCase().replace(/_/g, '-');
  // BCP-47 style params (e.g. ?lang=zh-CN) map to UI language codes.
  if (v === 'zh' || v === 'zh-cn' || v === 'zhcn' || v.startsWith('zh-cn')) return 'zh';
  if (v === 'ja' || v === 'ja-jp' || v.startsWith('ja-')) return 'ja';
  if (v === 'en' || v === 'en-us' || v === 'en-gb' || v.startsWith('en-')) return 'en';
  return LANG.has(v as McapViewerLanguageCode) ? (v as McapViewerLanguageCode) : undefined;
}

function storedToUiTheme(t: McapViewerPersistedTheme | undefined): McapViewerUiTheme | undefined {
  return t;
}

/**
 * Resolution order per key: explicit props > URL > localStorage (if enabled) > defaults.
 * Defaults: `theme = system`, `language = en` (matches McapViewerProvider).
 */
export function mergeInitialUiPreferences(input: MergeInitialUiPreferencesInput): {
  theme: McapViewerUiTheme;
  language: McapViewerLanguageCode;
} {
  const stored = input.persistence === 'localStorage' ? input.stored : null;

  const themeFromProps = input.propsTheme;
  const themeFromUrl = parseUrlTheme(input.urlTheme);
  const themeFromStored = storedToUiTheme(stored?.theme);

  const theme: McapViewerUiTheme =
    themeFromProps !== undefined
      ? themeFromProps
      : themeFromUrl !== undefined
        ? themeFromUrl
        : themeFromStored !== undefined
          ? themeFromStored
          : 'system';

  const langFromProps = input.propsLanguage;
  const langFromUrl = parseUrlLanguage(input.urlLanguage);
  const langFromStored = stored?.language;

  const language: McapViewerLanguageCode =
    langFromProps !== undefined
      ? langFromProps
      : langFromUrl !== undefined
        ? langFromUrl
        : langFromStored !== undefined
          ? langFromStored
          : 'en';

  return { theme, language };
}

/** Parse `window.location.search` (SPA only); returns empties when not in browser. */
export function readUiPreferenceParamsFromSearch(search: string): {
  urlTheme: string | null;
  urlLanguage: string | null;
} {
  if (typeof search !== 'string' || search === '') {
    return { urlTheme: null, urlLanguage: null };
  }
  try {
    const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
    return {
      urlTheme: params.get('theme'),
      urlLanguage: params.get('language') ?? params.get('lang'),
    };
  } catch {
    return { urlTheme: null, urlLanguage: null };
  }
}
