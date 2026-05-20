import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { IntlProvider } from 'react-intl';
import { getMcapViewerMessages, type McapViewerLocale } from '@/shared/intl/loadMcapViewerMessages';
import { Toaster } from '@/shared/ui/sonner';

export interface McapViewerProviderProps {
  theme?: 'light' | 'dark' | 'system';
  language?: McapViewerLocale;
  children: React.ReactNode;
}

type ResolvedTheme = 'light' | 'dark';

type McapViewerThemeContextValue = {
  theme: 'light' | 'dark' | 'system';
  resolvedTheme: ResolvedTheme;
};

const McapViewerThemeContext = createContext<McapViewerThemeContextValue>({
  theme: 'system',
  resolvedTheme: 'dark',
});

function resolveTheme(theme: 'light' | 'dark' | 'system'): ResolvedTheme {
  if (theme !== 'system') {
    return theme;
  }
  if (typeof window === 'undefined') {
    return 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useMcapViewerTheme(): McapViewerThemeContextValue {
  return useContext(McapViewerThemeContext);
}

function intlLocaleFor(lang: McapViewerLocale): string {
  if (lang === 'zh') return 'zh-CN';
  if (lang === 'ja') return 'ja-JP';
  return 'en';
}

export const McapViewerProvider: React.FC<McapViewerProviderProps> = ({
  theme = 'system',
  language = 'en',
  children,
}) => {
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() => resolveTheme(theme));

  useEffect(() => {
    if (theme !== 'system') {
      setResolvedTheme(theme);
      return;
    }
    if (typeof window === 'undefined') {
      setResolvedTheme('dark');
      return;
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const updateResolvedTheme = () => {
      setResolvedTheme(mediaQuery.matches ? 'dark' : 'light');
    };
    updateResolvedTheme();
    mediaQuery.addEventListener('change', updateResolvedTheme);
    return () => mediaQuery.removeEventListener('change', updateResolvedTheme);
  }, [theme]);

  const contextValue = useMemo(
    () => ({ theme, resolvedTheme }),
    [theme, resolvedTheme],
  );

  const messages = useMemo(() => getMcapViewerMessages(language), [language]);

  return (
    <McapViewerThemeContext.Provider value={contextValue}>
      <div
        id="xense-mcap-viewer-root"
        data-language={language}
        data-theme={resolvedTheme}
        className={`w-full h-full ${resolvedTheme === 'dark' ? 'dark' : ''}`}
      >
        <IntlProvider locale={intlLocaleFor(language)} defaultLocale="en" messages={messages}>
          {children}
          <Toaster theme={resolvedTheme} />
        </IntlProvider>
      </div>
    </McapViewerThemeContext.Provider>
  );
};
