import { createIntl, createIntlCache } from 'react-intl';
import { getMcapViewerMessages, type McapViewerLocale } from './loadMcapViewerMessages';

const intlCache = createIntlCache();

function localeFor(lang: McapViewerLocale): string {
  if (lang === 'zh') return 'zh-CN';
  return 'en';
}

/** For strings outside `IntlProvider` (e.g. `McapViewer` data effects). */
export function createMcapViewerIntl(lang: McapViewerLocale) {
  return createIntl(
    {
      locale: localeFor(lang),
      defaultLocale: 'en',
      messages: getMcapViewerMessages(lang),
    },
    intlCache,
  );
}
