"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useCallback,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { Locale, I18nContext } from "./types";
import { translations, type TranslationKey } from "./translations";
import { detectLocale, saveLocale } from "./detect";

const I18nReactContext = createContext<I18nContext | undefined>(undefined);

// `localeListeners` stores listeners provided by React for each subscriber.
// Mounted components register a listener via `useSyncExternalStore`,
// and are re-rendered when `setCurrentLocale` notifies them.
const localeListeners = new Set<() => void>();

// In-memory current locale. We initialize it to 'en' to provide a stable SSR value.
// Actual detection (localStorage / navigator) runs once on the client.
let currentLocale: Locale = "en";

// Flag to ensure client-side initialization (reading localStorage, etc.) runs only once
let hasClientLocaleInitialized = false;

// Update the in-memory locale and notify all registered listeners.
// React will re-read the snapshot and re-render components as needed when a listener is called.
function setCurrentLocale(newLocale: Locale) {
  if (currentLocale === newLocale) {
    return;
  }
  currentLocale = newLocale;
  for (const listener of localeListeners) {
    listener();
  }
}

// Client-only initialization.
// Detect locale using browser APIs (localStorage / navigator) and update the in-memory value if needed.
// Not run during SSR.
function initLocaleOnClient() {
  if (hasClientLocaleInitialized || typeof window === "undefined") {
    return;
  }

  hasClientLocaleInitialized = true;
  const detectedLocale = detectLocale();
  if (detectedLocale !== currentLocale) {
    setCurrentLocale(detectedLocale);
  }
}

// Subscribe function called by useSyncExternalStore when a component mounts.
// Stores the provided listener and returns an unsubscribe function for unmounting.
function subscribeLocale(listener: () => void) {
  localeListeners.add(listener);
  initLocaleOnClient();
  return () => {
    localeListeners.delete(listener);
  };
}

// Returns the current snapshot on the client
function getLocaleSnapshot() {
  return currentLocale;
}

// Server-side snapshot used during SSR.
// Defined explicitly to create a stable initial output for hydration.
function getServerLocaleSnapshot(): Locale {
  return "en";
}

export function I18nProvider({ children }: { children: ReactNode }) {
  // Subscribe to the external store (currentLocale) using useSyncExternalStore in an SSR-safe way.
  // - subscribeLocale: register React's listener to receive update notifications
  // - getLocaleSnapshot: return the current value on the client
  // - getServerLocaleSnapshot: provide a stable default for SSR to reduce hydration mismatches
  const locale = useSyncExternalStore<Locale>(
    subscribeLocale,
    getLocaleSnapshot,
    getServerLocaleSnapshot
  );

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  // Function to switch locale from the UI.
  // Updates the in-memory value and persists it to localStorage.
  const setLocale = useCallback((newLocale: Locale) => {
    setCurrentLocale(newLocale);
    saveLocale(newLocale);
  }, []);

  const t = useCallback(
    (key: string): string => {
      const translationKey = key as TranslationKey;
      return translations[locale][translationKey] || key;
    },
    [locale]
  );

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
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}
