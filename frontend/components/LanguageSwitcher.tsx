'use client';

import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n';

export function LanguageSwitcher() {
  const { locale, setLocale } = useI18n();

  return (
    <div className="flex gap-2">
      <Button
        variant={locale === 'ja' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLocale('ja')}
        aria-label="Switch to Japanese"
      >
        日本語
      </Button>
      <Button
        variant={locale === 'en' ? 'default' : 'outline'}
        size="sm"
        onClick={() => setLocale('en')}
        aria-label="Switch to English"
      >
        English
      </Button>
    </div>
  );
}
