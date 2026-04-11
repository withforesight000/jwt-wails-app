import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

import jwt from 'jsonwebtoken';
import { expect, test } from '@playwright/test';
import { importPKCS8, importSPKI, SignJWT, jwtVerify } from 'jose';

type SupportedAlgorithm = jwt.Algorithm | 'EdDSA';

interface AlgorithmCase {
  name: string;
  algorithm: SupportedAlgorithm;
  signingKeyFile: string;
  keyFile: string;
};

const jsonWebTokenAlgorithms: jwt.Algorithm[] = [
  'HS256',
  'HS384',
  'HS512',
  'RS256',
  'RS384',
  'RS512',
  'ES256',
  'ES384',
  'ES512',
  'PS256',
  'PS384',
  'PS512',
  'none',
];

const testsDir = path.dirname(fileURLToPath(import.meta.url));
const fixturesDir = path.join(testsDir, 'fixtures');

const algorithmCases: AlgorithmCase[] = [
  {
    name: 'HS256',
    algorithm: 'HS256',
    signingKeyFile: 'hs-secret.txt',
    keyFile: 'hs-secret.txt',
  },
  {
    name: 'RS256',
    algorithm: 'RS256',
    signingKeyFile: 'rsa-private.pem',
    keyFile: 'rsa-public.pem',
  },
  {
    name: 'PS256',
    algorithm: 'PS256',
    signingKeyFile: 'rsa-private.pem',
    keyFile: 'rsa-public.pem',
  },
  {
    name: 'ES256',
    algorithm: 'ES256',
    signingKeyFile: 'ecdsa-private.pem',
    keyFile: 'ecdsa-public.pem',
  },
  {
    name: 'EdDSA',
    algorithm: 'EdDSA',
    signingKeyFile: 'ed25519-private.pem',
    keyFile: 'ed25519-public.pem',
  },
];

const tokenPayload = {
  sub: 'playwright-tester',
  role: 'inspector',
};

const readFixture = (filename: string) => readFileSync(path.join(fixturesDir, filename), 'utf-8');

const createToken = async (algCase: AlgorithmCase) => {
  if (algCase.algorithm === 'EdDSA') {
    const privateKey = await importPKCS8(readFixture(algCase.signingKeyFile).trim(), 'EdDSA');
    return new SignJWT(tokenPayload)
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setIssuedAt()
      .setNotBefore('0s')
      .setExpirationTime('1h')
      .sign(privateKey);
  }
  return jwt.sign(tokenPayload, readFixture(algCase.signingKeyFile).trim(), {
    algorithm: algCase.algorithm,
    expiresIn: '1h',
    notBefore: '0s',
  });
};

test.beforeEach(async ({ page }) => {
  await page.exposeFunction(
    'playwrightVerifyJWT',
    async (tokenString: string, keyBytes: number[]) => {
      if (!tokenString?.trim()) {
        throw new Error('empty token');
      }
      const decoded = jwt.decode(tokenString, { complete: true });
      if (
        !decoded ||
        typeof decoded !== 'object' ||
        !decoded.header ||
        typeof decoded.payload !== 'object' ||
        decoded.payload === null ||
        Array.isArray(decoded.payload)
      ) {
        throw new Error('parse (unverified): malformed token');
      }
      const header = decoded.header;
      const claims = decoded.payload as jwt.JwtPayload;
      const base = {
        algorithm: typeof header.alg === 'string' ? header.alg : '',
        header,
        claims,
        signature: tokenString.split('.')[2] ?? '',
        issuedAt: toUnixNumber(claims.iat),
        notBefore: toUnixNumber(claims.nbf),
        expiresAt: toUnixNumber(claims.exp),
      };

      const candidate =
        keyBytes?.length && keyBytes.length > 0 ? Buffer.from(keyBytes).toString('utf-8').trim() : '';
      if (!candidate) {
        return {
          valid: false,
          warnings: ['no_key_warning'],
          ...base,
        };
      }

      try {
        if (base.algorithm === 'EdDSA') {
          const key = await importSPKI(candidate, 'EdDSA');
          await jwtVerify(tokenString, key, { algorithms: ['EdDSA'] });
        } else if (isJsonWebTokenAlgorithm(base.algorithm)) {
          jwt.verify(tokenString, candidate, {
            algorithms: [base.algorithm],
          });
        } else {
          jwt.verify(tokenString, candidate);
        }
        return {
          valid: true,
          warnings: [],
          ...base,
        };
      } catch (err) {
        return {
          valid: false,
          warnings: [],
          error: toBackendErrorCode(err),
          ...base,
        };
      }
    },
  );

  await page.addInitScript(() => {
    // Set locale to Japanese for consistent test behavior
    localStorage.setItem('jwt-inspector-locale', 'ja');
    
    window.go = {
      app: {
        App: {
          VerifyAndDecodeJWT: (tokenString: string, keyBytes: number[]) =>
            window.playwrightVerifyJWT(tokenString, keyBytes),
        },
      },
    };
  });
});

test('shows warning when key file is not provided', async ({ page }) => {
  const token = await createToken(algorithmCases[0]);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.fill('#jwt', token);
  await expect(page.locator('#jwt')).toHaveValue(token);
  await page.getByRole('button', { name: '検証する' }).click();
  await expect(page.getByText('署名検証: NG')).toBeVisible();
  await expect(
    page.getByText('鍵が指定されていないため署名は検証されていません'),
  ).toBeVisible();
});

test('shows warning in English after switching locale', async ({ page }) => {
  const token = await createToken(algorithmCases[0]);
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'English' }).click();
  await page.fill('#jwt', token);
  await expect(page.locator('#jwt')).toHaveValue(token);
  await page.getByRole('button', { name: 'Verify' }).click();
  await expect(page.getByText('Signature Verification: NG')).toBeVisible();
  await expect(
    page.getByText('No key was provided, so the signature was not verified'),
  ).toBeVisible();
});

for (const algCase of algorithmCases) {
  test(`validates ${algCase.name} token when key file exists`, async ({ page }) => {
    const token = await createToken(algCase);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.setInputFiles('#keyHidden', path.join(fixturesDir, algCase.keyFile));
    await page.fill('#jwt', token);
    await expect(page.locator('#jwt')).toHaveValue(token);
    const verifyButton = page.getByRole('button', { name: '検証する' });
    await expect(verifyButton).toBeEnabled();
    await verifyButton.click();
    await expect(page.getByText('署名検証: OK')).toBeVisible();
    await expect(page.getByText(`alg: ${algCase.algorithm}`, { exact: true })).toBeVisible();
    await expect(page.locator('text=role')).toBeVisible();
  });
}

function toUnixNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Math.floor(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.floor(parsed) : null;
  }
  return null;
}

function toBackendErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'empty token') {
    return 'empty_token';
  }
  if (message.startsWith('parse (unverified)')) {
    return 'parse_unverified';
  }
  if (/expired/i.test(message)) {
    return 'token_expired';
  }
  if (/not valid yet|not active/i.test(message)) {
    return 'token_not_valid_yet';
  }
  if (/signature/i.test(message)) {
    return 'token_signature_invalid';
  }
  if (/unverifiable/i.test(message)) {
    return 'token_unverifiable';
  }
  return message;
}

function isJsonWebTokenAlgorithm(algorithm: string): algorithm is jwt.Algorithm {
  return jsonWebTokenAlgorithms.includes(algorithm as jwt.Algorithm);
}
