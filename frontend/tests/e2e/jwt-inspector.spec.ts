import { readFileSync } from 'node:fs';
import path from 'path';
import { fileURLToPath } from 'url';

import jwt from 'jsonwebtoken';
import { expect, test } from '@playwright/test';
import { importPKCS8, importSPKI, SignJWT, jwtVerify } from 'jose';

type AlgorithmCase = {
  name: string;
  algorithm: string;
  signingKeyFile: string;
  keyFile: string;
};

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
  await page.exposeFunction('playwrightVerifyJWT', async (tokenString: string, keyBytes: number[]) => {
    if (!tokenString?.trim()) {
      throw new Error('empty token');
    }
    const decoded = jwt.decode(tokenString, { complete: true });
    if (!decoded || typeof decoded !== 'object' || !decoded.header || !decoded.payload) {
      throw new Error('parse (unverified): malformed token');
    }
    const header = decoded.header as Record<string, unknown>;
    const claims = decoded.payload as Record<string, unknown>;
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
        warnings: ['鍵が指定されていないため署名は検証されていません'],
        ...base,
      };
    }

    try {
      if (base.algorithm === 'EdDSA') {
        const key = await importSPKI(candidate, 'EdDSA');
        await jwtVerify(tokenString, key, { algorithms: ['EdDSA'] });
      } else {
        const options = base.algorithm ? { algorithms: [base.algorithm] } : undefined;
        if (options) {
          jwt.verify(tokenString, candidate, options);
        } else {
          jwt.verify(tokenString, candidate);
        }
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
        error: err instanceof Error ? err.message : String(err),
        ...base,
      };
    }
  });

  await page.addInitScript(() => {
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
