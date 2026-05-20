import enCommon from './messages/en/common.json';
import enLayout from './messages/en/layout.json';
import enNavbar from './messages/en/navbar.json';
import enPanels from './messages/en/panels.json';
import enPlayback from './messages/en/playback.json';
import enQuality from './messages/en/quality.json';
import enSidebar from './messages/en/sidebar.json';
import enWelcome from './messages/en/welcome.json';

import zhCommon from './messages/zh/common.json';
import zhLayout from './messages/zh/layout.json';
import zhNavbar from './messages/zh/navbar.json';
import zhPanels from './messages/zh/panels.json';
import zhPlayback from './messages/zh/playback.json';
import zhQuality from './messages/zh/quality.json';
import zhSidebar from './messages/zh/sidebar.json';
import zhWelcome from './messages/zh/welcome.json';

/**
 * Merges shard JSON files under `messages/<locale>/`.
 *
 * Panel UI message ids use dotted prefixes; see {@link PANEL_TYPE_MESSAGE_SLUG}
 * in `@/features/panels/framework/panelMessageSlug` for `PanelType` → slug map
 * and naming (`panels.<slug>.settings.*`, `panels.framework.*`, …).
 */

/** Flat ICU message map used by react-intl */
export type McapViewerMessages = Record<string, string>;

const EN_SHARDS = [
  enCommon,
  enWelcome,
  enNavbar,
  enLayout,
  enSidebar,
  enQuality,
  enPlayback,
  enPanels,
] as const;

const ZH_SHARDS = [
  zhCommon,
  zhWelcome,
  zhNavbar,
  zhLayout,
  zhSidebar,
  zhQuality,
  zhPlayback,
  zhPanels,
] as const;

function mergeFlatMessages(locale: string, ...parts: readonly Record<string, string>[]): McapViewerMessages {
  const out: Record<string, string> = {};
  for (const part of parts) {
    for (const [key, value] of Object.entries(part)) {
      if (import.meta.env.DEV && Object.prototype.hasOwnProperty.call(out, key)) {
        console.error(`[i18n] Duplicate message key "${key}" while merging locale "${locale}"`);
      }
      out[key] = value;
    }
  }
  return out;
}

const MERGED = {
  en: mergeFlatMessages('en', ...EN_SHARDS),
  zh: mergeFlatMessages('zh', ...ZH_SHARDS),
} as const;

export type McapViewerLocale = keyof typeof MERGED;

export function getMcapViewerMessages(lang: McapViewerLocale): McapViewerMessages {
  return MERGED[lang] ?? MERGED.en;
}
