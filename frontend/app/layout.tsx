import './globals.css';
import type { Metadata } from 'next';
import React, { type ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'JWT Inspector',
  description: 'JWT decode and verify',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
