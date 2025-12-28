'use client';
import { useMemo, useRef, useState, useCallback } from 'react';
import { VerifyAndDecodeJWT } from '@/wailsjs/go/app/App';

// UI components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, File as FileIcon } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';

function b64urlToString(b64url: string): string {
  try {
    const pad = b64url.length % 4 === 2 ? '==' : b64url.length % 4 === 3 ? '=' : '';
    return atob(b64url.replace(/-/g, '+').replace(/_/g, '/') + pad);
  } catch {
    return '';
  }
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export default function Page() {
  const { t } = useI18n();
  const [token, setToken] = useState('');
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Extract algorithm from JWT token header
  const alg = useMemo(() => {
    try {
      const [h] = token.split('.');
      if (!h) return '';
      const hdr = JSON.parse(b64urlToString(h));
      return hdr.alg || '';
    } catch {
      return '';
    }
  }, [token]);

  // Convert File to byte array for verification
  const readKeyBytes = useCallback(async (file: File | null): Promise<number[]> => {
    if (!file) return [];
    const buf = await file.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }, []);

  // Handle JWT verification
  const handleVerify = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const keyBytes = await readKeyBytes(keyFile);
      const res = await VerifyAndDecodeJWT(token, keyBytes);
      setResult(res);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [token, keyFile, readKeyBytes]);

  // Clear all form data and results
  const handleClear = useCallback(() => {
    setToken('');
    setKeyFile(null);
    setResult(null);
    setError(null);
    // Reset file input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Handle file selection from input
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setKeyFile(e.target.files?.[0] ?? null);
  }, []);

  // Handle token text change
  const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setToken(e.target.value);
  }, []);

  // Remove selected file
  const handleRemoveFile = useCallback(() => {
    setKeyFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Trigger file input click
  const handleSelectFileClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
        <LanguageSwitcher />
      </div>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>{t('input.title')}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* Input section: 2 columns (left: JWT / right: Key file) */}
          <div className="grid gap-6 md:grid-cols-2 items-start">
            {/* Left column: JWT input */}
            <div className="grid gap-2">
              <Label htmlFor="jwt">{t('input.jwt.label')}</Label>
              <Textarea 
                id="jwt" 
                placeholder={t('input.jwt.placeholder')} 
                value={token} 
                onChange={handleTokenChange} 
              />
              <p className="text-xs text-zinc-400">
                {t('input.alg.detected')} <span className="font-mono">{alg || '-'}</span>
              </p>

              {/* Action buttons: Verify / Clear */}
              <div className="mt-2 flex items-center gap-3">
                <Button onClick={handleVerify} disabled={busy || !token}>
                  {busy ? t('input.verify.loading') : t('input.verify.button')}
                </Button>
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleClear} 
                  aria-label={t('input.clear.aria')}
                >
                  {t('input.clear.button')}
                </Button>
                {error && <div className="ml-2 text-sm text-red-500">{error}</div>}
              </div>
            </div>

            {/* Right column: Key file selection */}
            <div className="grid gap-2">
              <Label>{t('keyfile.label')}</Label>

              {/* Hidden file input */}
              <Input
                ref={fileInputRef}
                id="keyHidden"
                type="file"
                accept=".pem,.crt,.cer,.der,.key,.pub,.txt,application/x-x509-ca-cert,application/pkcs8,application/pkix-cert"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* File selection box */}
              <div className="rounded-lg border border-zinc-700 p-5 text-center">
                <div className="text-sm text-zinc-600 mb-3">{t('keyfile.instruction')}</div>
                <Button type="button" variant="outline" onClick={handleSelectFileClick}>
                  {t('keyfile.select.button')}
                </Button>
                <div className="mt-3 text-xs text-zinc-500">
                  {t('keyfile.format.hint')}
                </div>
              </div>

              {/* Selected file chip */}
              {keyFile && (
                <div className="flex items-center gap-2 rounded-md border border-zinc-700 bg-black/5 px-3 py-2 text-sm">
                  <FileIcon className="h-4 w-4" />
                  <span className="truncate" title={keyFile.name}>{keyFile.name}</span>
                  <span className="text-xs text-zinc-500">{formatBytes(keyFile.size)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-7 w-7"
                    aria-label={t('keyfile.clear.aria')}
                    onClick={handleRemoveFile}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>{t('result.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-sm text-zinc-500">{t('result.not.verified')}</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div>
                  {t('result.signature')}: {result.valid ? (
                    <span className="text-green-600">{t('result.signature.ok')}</span>
                  ) : (
                    <span className="text-red-600">{t('result.signature.ng')}</span>
                  )}
                </div>
                {result.algorithm && (
                  <div>alg: <span className="font-mono">{result.algorithm}</span></div>
                )}
                {result.error && <div className="text-red-600">{t('result.error')}: {result.error}</div>}
                {Array.isArray(result.warnings) && result.warnings.length > 0 && (
                  <ul className="list-disc ml-5 text-amber-600">
                    {result.warnings.map((w: string, i: number) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                )}
                {result.signature && (
                  <div className="text-xs text-zinc-500">
                    sig: <span className="font-mono break-all">{result.signature}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('header.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap overflow-auto">{result ? JSON.stringify(result.header, null, 2) : '-'}</pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('payload.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap overflow-auto">{result ? JSON.stringify(result.claims, null, 2) : '-'}</pre>
        </CardContent>
      </Card>
    </main>
  );
}