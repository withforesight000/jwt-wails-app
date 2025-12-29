import type { Locale } from './types';

const LOCALE_STORAGE_KEY = 'jwt-inspector-locale';

/**
 * Detects the user's preferred locale.
 * Priority: localStorage > navigator.language > default 'en'
 */
export function detectLocale(): Locale {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return 'en';
  }

  // 1. Check localStorage for saved preference
  try {
    const saved = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (saved === 'ja' || saved === 'en') {
      return saved;
    }
  } catch {
    // localStorage might not be available
  }

  // 2. Check navigator.language or navigator.languages
  try {
    const navLang = navigator.language;
    if (navLang && navLang.startsWith('ja')) {
      return 'ja';
    }

    if (navigator.languages) {
      for (const lang of navigator.languages) {
        if (lang.startsWith('ja')) {
          return 'ja';
        }
      }
    }
  } catch {
    // navigator might not be available
  }

  // 3. Default to English
  return 'en';
}

/**
 * Saves the user's locale preference to localStorage
 */
export function saveLocale(locale: Locale): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // localStorage might not be available
  }
}
