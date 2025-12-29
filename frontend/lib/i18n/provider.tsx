'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode
} from 'react';
import type { Locale, I18nContext } from './types';
import { translations, type TranslationKey } from './translations';
import { detectLocale, saveLocale } from './detect';

const I18nReactContext = createContext<I18nContext | undefined>(undefined);

const localeListeners = new Set<() => void>();
let currentLocale: Locale = 'en';
let hasClientLocaleInitialized = false;

function setCurrentLocale(newLocale: Locale) {
  if (currentLocale === newLocale) {
    return;
  }
  currentLocale = newLocale;
  for (const listener of localeListeners) {
    listener();
  }
}

function initLocaleOnClient() {
  if (hasClientLocaleInitialized || typeof window === 'undefined') {
    return;
  }

  hasClientLocaleInitialized = true;
  const detectedLocale = detectLocale();
  if (detectedLocale !== currentLocale) {
    setCurrentLocale(detectedLocale);
  }
}

function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  initLocaleOnClient();
  return () => {
    localeListeners.delete(listener);
  };
}

function getLocaleSnapshot() {
  return currentLocale;
}

function getServerLocaleSnapshot(): Locale {
  return 'en';
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore<Locale>(
    subscribeLocale,
    getLocaleSnapshot,
    getServerLocaleSnapshot,
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Memoized translation function
  const setLocale = useCallback((newLocale: Locale) => {
    setCurrentLocale(newLocale);
    saveLocale(newLocale);
  }, []);

  const t = useCallback((key: string): string => {
    const translationKey = key as TranslationKey;
    return translations[locale][translationKey] || key;
  }, [locale]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<I18nContext>(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

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
