export const translations = {
  ja: {
    // Page title
    'app.title': 'JWT Inspector',

    // Input section
    'input.title': '入力',
    'input.jwt.label': 'JWT',
    'input.jwt.placeholder': 'eyJhbGciOi...',
    'input.alg.detected': '検出された alg:',
    'input.verify.button': '検証する',
    'input.verify.loading': '検証中…',
    'input.clear.button': 'クリア',
    'input.clear.aria': 'クリア',

    // Key file section
    'keyfile.label': '鍵ファイル（任意: 共有鍵/公開鍵/秘密鍵）',
    'keyfile.instruction': 'ファイル選択ボタンから指定してください',
    'keyfile.select.button': 'ファイルを選択',
    'keyfile.format.hint': 'HS* は生バイト（共有鍵）。RS/PS/ES/EdDSA は PEM と生 DER の両方（公開鍵/証明書/秘密鍵）をサポート。',
    'keyfile.clear.aria': '選択をクリア',

    // Result section
    'result.title': '結果',
    'result.not.verified': 'まだ検証していません。',
    'result.signature': '署名検証',
    'result.signature.ok': 'OK',
    'result.signature.ng': 'NG',
    'result.error': 'エラー',

    // Header and payload sections
    'header.title': 'ヘッダ',
    'payload.title': 'ペイロード',
  },
  en: {
    // Page title
    'app.title': 'JWT Inspector',

    // Input section
    'input.title': 'Input',
    'input.jwt.label': 'JWT',
    'input.jwt.placeholder': 'eyJhbGciOi...',
    'input.alg.detected': 'Detected alg:',
    'input.verify.button': 'Verify',
    'input.verify.loading': 'Verifying…',
    'input.clear.button': 'Clear',
    'input.clear.aria': 'Clear',

    // Key file section
    'keyfile.label': 'Key File (Optional: Shared/Public/Private Key)',
    'keyfile.instruction': 'Please select a file using the button below',
    'keyfile.select.button': 'Select File',
    'keyfile.format.hint': 'HS* expects raw bytes (shared key). RS/PS/ES/EdDSA support both PEM and raw DER (public key/certificate/private key).',
    'keyfile.clear.aria': 'Clear selection',

    // Result section
    'result.title': 'Result',
    'result.not.verified': 'Not verified yet.',
    'result.signature': 'Signature Verification',
    'result.signature.ok': 'OK',
    'result.signature.ng': 'NG',
    'result.error': 'Error',

    // Header and payload sections
    'header.title': 'Header',
    'payload.title': 'Payload',
  },
} as const;

export type TranslationKey = keyof typeof translations.ja;
