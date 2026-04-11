# AGENTS

## Project summary
- Desktop JWT Inspector built with Wails v2: Go backend + Next.js/React UI.
- Decodes JWT headers/claims and verifies signatures when a key is provided.
- UI is bilingual (ja/en) with a custom i18n provider and locale switcher.

## Architecture & data flow
- Wails app entry: `main.go` embeds the exported frontend (`frontend/out`) and binds `internal/app.App`.
- Backend: `internal/app/jwtverify.go` exposes `VerifyAndDecodeJWT`, which:
  - Decodes header/claims without verification.
  - Extracts `iat/nbf/exp` as Unix seconds.
  - Verifies the signature when a key is supplied and returns a `JWTResult`.
- Frontend: `frontend/app/page.tsx` calls `VerifyAndDecodeJWT` via `frontend/wailsjs/go/app/App`.
- Dev-only HMR workaround: `frontend/app/layout.tsx` injects `frontend/public/wails-v2-hmr-socket-rewrite.js` to rewrite the Next.js HMR WebSocket to `ws://localhost:3000` when the app is running inside the Wails v2 custom-scheme webview. See `doc/wails-v2-hmr-workaround.md` for rationale and guardrails.
- E2E tests stub the Wails runtime by injecting `window.go.app.App.VerifyAndDecodeJWT`; shared test-only window typings live in `frontend/tests/e2e/global.d.ts`.

## Key handling rules (backend)
- HS* uses raw bytes (shared secret).
- RS*/PS* use RSA public/private keys (PEM or DER).
- ES* uses ECDSA public/private keys (PEM or DER).
- EdDSA uses Ed25519 public/private keys (PEM or DER).

## Repo layout
- `main.go`: Wails app setup and asset embedding.
- `internal/app/`: Go backend logic + tests.
- `frontend/app/`: Next.js App Router UI (`layout.tsx`, `page.tsx`).
- `frontend/lib/i18n/`: locale detection and translations.
- `frontend/components/`: UI components (shadcn-style).
- `frontend/wailsjs/`: generated Wails bindings (do not edit by hand).
- `frontend/tests/e2e/`: Playwright tests and JWT key fixtures.
- `doc/wails-v2-hmr-workaround.md`: detailed notes for the Wails v2 HMR WebSocket rewrite.
- `.github/workflows/ci.yml`: CI (Go tests, frontend build, Playwright, lint).

## Tooling & versions
- Go 1.26.2
- Node.js 24.14.1
- pnpm 10.15.0
- Wails v2, Next.js 16, React 19, Tailwind CSS 4

## Dev & test commands
- `wails dev` (desktop dev)
- `wails build` (desktop build, outputs to `build/bin/`)
- `go test ./...`
- `pnpm -C frontend run build`
- `pnpm -C frontend run test:e2e`
- `pnpm -C frontend run lint` (ESLint + TypeScript type-check; this is where frontend type mismatches should be caught)
- `golangci-lint run ./...` (backend lint; keep it aligned with `.golangci.yml`)

## Change guidance
- Keep `JWTResult` fields and JSON tags stable; `frontend/wailsjs` models are generated from Go types.
- Do not hand-edit `frontend/wailsjs`; regenerate via `wails dev` or `wails build` if needed.
- If frontend tests need browser-only globals, add the declaration under `frontend/tests/e2e/global.d.ts` instead of sprinkling `any` or per-test casts.
- UI copy lives in `frontend/lib/i18n/translations.ts`; update both locales together and adjust E2E tests if labels change.
- Frontend export goes to `frontend/out` (`frontend/next.config.mjs`); keep it in sync with `main.go` embedding.
- When touching the Wails v2 HMR workaround, keep `doc/wails-v2-hmr-workaround.md`, `frontend/public/wails-v2-hmr-socket-rewrite.js`, and `wails.json` aligned.
- When adding Go code, keep `golangci-lint` clean; prefer removing dead helpers/parameters rather than suppressing `unused` warnings.
