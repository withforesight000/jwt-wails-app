'use client';

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { Locale, I18nContext } from './types';
import { translations, type TranslationKey } from './translations';
import { detectLocale, saveLocale } from './detect';

const I18nReactContext = createContext<I18nContext | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const [mounted, setMounted] = useState(false);

  // Initialize locale on mount
  useEffect(() => {
    setLocaleState(detectLocale());
    setMounted(true);
  }, []);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);
    saveLocale(newLocale);
    
    // Update html lang attribute
    if (typeof document !== 'undefined') {
      document.documentElement.lang = newLocale;
    }
  };

  const t = (key: string): string => {
    const translationKey = key as TranslationKey;
    return translations[locale][translationKey] || key;
  };

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return null;
  }

  return (
    <I18nReactContext.Provider value={{ locale, setLocale, t }}>
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
