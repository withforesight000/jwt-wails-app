import './globals.css';
import type { Metadata } from 'next';
import React, { type ReactNode } from 'react';
import { I18nProvider } from '@/lib/i18n';

export const metadata: Metadata = {
  title: 'JWT Inspector',
  description: 'JWT decode and verify',
};

const shouldInjectV2HMRPatch = process.env.NODE_ENV === 'development';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        {shouldInjectV2HMRPatch && (
          // eslint-disable-next-line @next/next/no-sync-scripts
          <script
            src="/wails-v2-hmr-socket-rewrite.js"
            suppressHydrationWarning
          />
        )}
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
