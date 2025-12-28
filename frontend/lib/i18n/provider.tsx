'use client';

import { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback, 
  useMemo, 
  type ReactNode 
} from 'react';
import type { Locale, I18nContext } from './types';
import { translations, type TranslationKey } from './translations';
import { detectLocale, saveLocale } from './detect';

const I18nReactContext = createContext<I18nContext | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  // Initialize locale on mount from localStorage or OS settings
  useEffect(() => {
    const detectedLocale = detectLocale();
    setLocaleState(detectedLocale);
    setMounted(true);
  }, []);

  // Memoized function to update locale and persist to localStorage
  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    saveLocale(newLocale);
    
    // Update html lang attribute for accessibility
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  }, []);

  // Memoized translation function
  const t = useCallback((key: string): string => {
    const translationKey = key as TranslationKey;
    return translations[locale][translationKey] || key;
  }, [locale]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<I18nContext>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  return (
    <I18nReactContext.Provider value={contextValue}>
      {children}
    </I18nReactContext.Provider>
  );
}

export function useI18n(): I18nContext {
  const context = useContext(I18nReactContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
