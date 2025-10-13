'use client';
import { useMemo, useRef, useState } from 'react';
import { VerifyAndDecodeJWT } from '@/wailsjs/go/app/App';

// shadcn/ui コンポーネントを使用
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, File as FileIcon } from 'lucide-react';

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
  const [token, setToken] = useState('');
  const [keyFile, setKeyFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function readKeyBytes(file: File | null): Promise<number[]> {
    if (!file) return [];
    const buf = await file.arrayBuffer();
    return Array.from(new Uint8Array(buf));
  }

  async function handleVerify() {
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
  }

  function handleClear() {
    setToken('');
    setKeyFile(null);
    setResult(null);
    setError(null);
    // 重要: file input 自体も値をクリアしないと、同じファイルを再選択しても onChange が発火しない
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <main className="mx-auto max-w-6xl p-6 space-y-6">
      <h1 className="text-2xl font-semibold">JWT Inspector</h1>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle>入力</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {/* 入力 2 カラム（左: JWT / 右: 鍵ファイル） */}
          <div className="grid gap-6 md:grid-cols-2 items-start">
            {/* 左カラム: JWT 入力（ボタンをここに入れて縦の間延びを抑える） */}
            <div className="grid gap-2">
              <Label htmlFor="jwt">JWT</Label>
              <Textarea id="jwt" placeholder="eyJhbGciOi..." value={token} onChange={(e) => setToken(e.target.value)} />
              <p className="text-xs text-zinc-400">検出された alg: <span className="font-mono">{alg || '-'}</span></p>

              {/* アクション行: 検証 / クリア（左カラムに内包） */}
              <div className="mt-2 flex items-center gap-3">
                <Button onClick={handleVerify} disabled={busy || !token}>
                  {busy ? '検証中…' : '検証する'}
                </Button>
                <Button type="button" variant="secondary" onClick={handleClear} aria-label="クリア">
                  クリア
                </Button>
                {error && <div className="ml-2 text-sm text-red-500">{error}</div>}
              </div>
            </div>

            {/* 右カラム: 鍵ファイル（クリックで選択のみ／ドラッグ&ドロップは無効化） */}
            <div className="grid gap-2">
              <Label>鍵ファイル（任意: 共有鍵/公開鍵/秘密鍵）</Label>

              {/* 実体の input は隠して制御（shadcn の Input を流用） */}
              <Input
                ref={fileInputRef}
                id="keyHidden"
                type="file"
                accept=".pem,.crt,.cer,.der,.key,.pub,.txt,application/x-x509-ca-cert,application/pkcs8,application/pkix-cert"
                className="hidden"
                onChange={(e) => setKeyFile(e.target.files?.[0] ?? null)}
              />

              {/* シンプルな選択ボックス（クリックでファイルを選択） */}
              <div className="rounded-lg border border-zinc-700 p-5 text-center">
                <div className="text-sm text-zinc-600 mb-3">ファイル選択ボタンから指定してください</div>
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  ファイルを選択
                </Button>
                <div className="mt-3 text-xs text-zinc-500">
                  HS* は生バイト（共有鍵）。RS/PS/ES/EdDSA は <strong>PEM と生 DER の両方</strong>（公開鍵/証明書/秘密鍵）をサポート。
                </div>
              </div>

              {/* 選択済みファイルのチップ表示 */}
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
                    aria-label="選択をクリア"
                    onClick={() => { setKeyFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
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
            <CardTitle>結果</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <p className="text-sm text-zinc-500">まだ検証していません。</p>
            ) : (
              <div className="space-y-2 text-sm">
                <div>
                  署名検証: {result.valid ? (
                    <span className="text-green-600">OK</span>
                  ) : (
                    <span className="text-red-600">NG</span>
                  )}
                </div>
                {result.algorithm && (
                  <div>alg: <span className="font-mono">{result.algorithm}</span></div>
                )}
                {result.error && <div className="text-red-600">エラー: {result.error}</div>}
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
            <CardTitle>ヘッダ</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="text-xs whitespace-pre-wrap overflow-auto">{result ? JSON.stringify(result.header, null, 2) : '-'}</pre>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>ペイロード</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs whitespace-pre-wrap overflow-auto">{result ? JSON.stringify(result.claims, null, 2) : '-'}</pre>
        </CardContent>
      </Card>
    </main>
  );
}