import { describe, it, expect, beforeEach } from 'vitest';
import { MCAP_VIEWER_PREFERENCES_STORAGE_KEY } from './storageKeys';
import { readPreferences, writePreferences } from './readWritePreferences';
import { mergeInitialUiPreferences, readUiPreferenceParamsFromSearch } from './mergeInitialUiPreferences';
import { MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION } from './types';

function mockLocalStorage() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return [...map.keys()][index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
  return map;
}

describe('mergeInitialUiPreferences', () => {
  it('uses props over URL and stored', () => {
    const r = mergeInitialUiPreferences({
      persistence: 'localStorage',
      propsTheme: 'dark',
      propsLanguage: 'zh',
      urlTheme: 'light',
      urlLanguage: 'zh',
      stored: { schemaVersion: 1, theme: 'light', language: 'en' },
    });
    expect(r.theme).toBe('dark');
    expect(r.language).toBe('zh');
  });

  it('uses URL when props omit theme/language', () => {
    const r = mergeInitialUiPreferences({
      persistence: 'localStorage',
      urlTheme: 'light',
      urlLanguage: 'zh',
      stored: null,
    });
    expect(r.theme).toBe('light');
    expect(r.language).toBe('zh');
  });

  it('maps BCP-47 style URL language (zh-CN) to zh', () => {
    const r = mergeInitialUiPreferences({
      persistence: 'localStorage',
      urlTheme: null,
      urlLanguage: 'zh-CN',
      stored: null,
    });
    expect(r.language).toBe('zh');
  });

  it('ignores stored when persistence is off', () => {
    const r = mergeInitialUiPreferences({
      persistence: 'off',
      urlTheme: null,
      urlLanguage: null,
      stored: { schemaVersion: 1, theme: 'dark', language: 'zh' },
    });
    expect(r.theme).toBe('system');
    expect(r.language).toBe('en');
  });

  it('still applies URL when persistence is off', () => {
    const r = mergeInitialUiPreferences({
      persistence: 'off',
      urlTheme: 'light',
      urlLanguage: 'zh',
      stored: { schemaVersion: 1, theme: 'dark', language: 'zh' },
    });
    expect(r.theme).toBe('light');
    expect(r.language).toBe('zh');
  });

  it('rejects invalid URL values', () => {
    const r = mergeInitialUiPreferences({
      persistence: 'localStorage',
      urlTheme: 'neon',
      urlLanguage: 'xx',
      stored: null,
    });
    expect(r.theme).toBe('system');
    expect(r.language).toBe('en');
  });
});

describe('readUiPreferenceParamsFromSearch', () => {
  it('reads theme and language/lang', () => {
    expect(readUiPreferenceParamsFromSearch('?theme=dark&language=zh')).toEqual({
      urlTheme: 'dark',
      urlLanguage: 'zh',
    });
    expect(readUiPreferenceParamsFromSearch('?lang=fr')).toEqual({
      urlTheme: null,
      urlLanguage: 'fr',
    });
    expect(readUiPreferenceParamsFromSearch('?lang=zh-CN')).toEqual({
      urlTheme: null,
      urlLanguage: 'zh-CN',
    });
    expect(readUiPreferenceParamsFromSearch('?list=https%3A%2F%2Fexample.com%2Fa.json')).toEqual({
      urlTheme: null,
      urlLanguage: null,
    });
  });
});

describe('readPreferences / writePreferences', () => {
  beforeEach(() => {
    mockLocalStorage();
  });

  it('returns null for empty or corrupt storage', () => {
    expect(readPreferences()).toBe(null);
    localStorage.setItem(MCAP_VIEWER_PREFERENCES_STORAGE_KEY, 'not-json');
    expect(readPreferences()).toBe(null);
    localStorage.setItem(MCAP_VIEWER_PREFERENCES_STORAGE_KEY, JSON.stringify({ theme: 'dark' }));
    expect(readPreferences()).toBe(null);
    localStorage.setItem(
      MCAP_VIEWER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ schemaVersion: 999, theme: 'dark' }),
    );
    expect(readPreferences()).toBe(null);
  });

  it('reads valid v1 blob', () => {
    localStorage.setItem(
      MCAP_VIEWER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        schemaVersion: MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION,
        theme: 'light',
        language: 'zh',
        sidebarWidth: 312,
        sidebarPanelPercent: 24,
        autoDataQualityScan: true,
      }),
    );
    expect(readPreferences()).toEqual({
      schemaVersion: MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION,
      theme: 'light',
      language: 'zh',
      sidebarWidth: 312,
      sidebarPanelPercent: 24,
      autoDataQualityScan: true,
    });
  });

  it('writePreferences merges with previous', () => {
    writePreferences({
      theme: 'dark',
      language: 'en',
      sidebarWidth: 280,
      sidebarPanelPercent: 22,
      autoDataQualityScan: true,
    });
    writePreferences({ language: 'zh', sidebarPanelPercent: 31, autoDataQualityScan: false });
    expect(readPreferences()).toEqual({
      schemaVersion: MCAP_VIEWER_PREFERENCE_SCHEMA_VERSION,
      theme: 'dark',
      language: 'zh',
      sidebarWidth: 280,
      sidebarPanelPercent: 31,
      autoDataQualityScan: false,
    });
  });
});
