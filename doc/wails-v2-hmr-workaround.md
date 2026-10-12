# Wails v2 Next.js HMR Workaround

## Overview

This repository stays on **Wails v2** on the main branch, but still supports **Next.js HMR** during `wails dev`.

The workaround is intentionally **frontend-only**. It does **not** patch the Wails runtime. It rewrites the Next.js HMR WebSocket request so it connects directly to the local Next dev server and disables development HTML compression for Wails script injection.

## Why this exists

When the app runs inside the Wails v2 webview, the page origin is not a normal `http(s)` browser origin. Next.js derives its HMR WebSocket URL from `window.location`, so the generated socket target does not correctly reach the dev server.

The result is:

- the desktop app renders,
- the frontend dev server is running,
- but HMR does not reconnect correctly from inside the Wails window.

## Files involved

| File | Role |
| --- | --- |
| `frontend/app/layout.tsx` | Injects the dev-only patch script before the app loads |
| `frontend/public/wails-v2-hmr-socket-rewrite.js` | Rewrites the HMR WebSocket URL at runtime |
| `frontend/next.config.mjs` | Allows dev-server origins, disables dev compression, and pins the Turbopack root |
| `wails.json` | Defines the frontend dev server URL and port |

## How it works

### 1. Inject a dev-only script from `<head>`

`frontend/app/layout.tsx` inserts `wails-v2-hmr-socket-rewrite.js` only in development.

This script is loaded with a normal synchronous `<script>` tag on purpose:

- it must run **before** the Next.js dev client captures `window.WebSocket`,
- and the scope is limited to a single, documented exception to `lint/performance/noSyncScripts`.

The current implementation also avoids inline script content because the earlier inline approach caused a dev-time hydration mismatch.

### 2. Patch `window.WebSocket`

`frontend/public/wails-v2-hmr-socket-rewrite.js` wraps `window.WebSocket` and rewrites only requests whose path is:

```text
/_next/webpack-hmr
/_next/hmr
```

Those requests are redirected to:

```text
ws://localhost:3000/_next/webpack-hmr
ws://localhost:3000/_next/hmr
```

Next.js 16.4 uses `/_next/hmr`; the older path remains supported. The query string is preserved. Everything else is left untouched.

### 3. Leave the rest of the app alone

This is important:

- normal page and asset requests still use the existing Wails dev flow,
- only the HMR socket bypasses the Wails webview origin issue.

That keeps the workaround small and reduces the chance of breaking other dev behavior.

## Change guardrails

If you need to modify this workaround, keep these constraints intact:

1. **Keep it dev-only.** The patch must not ship in production builds.
2. **Do not broaden the rewrite.** Only `/_next/webpack-hmr` and `/_next/hmr` should be redirected.
3. **Keep the port in sync.** `frontend/public/wails-v2-hmr-socket-rewrite.js` and `wails.json` must agree on the Next dev server port.
4. **Do not revert to inline script injection.** The inline `beforeInteractive` variant caused a hydration mismatch in dev.
5. **Do not widen the Biome suppression.** The `noSyncScripts` suppression should stay on the single injected script only.

## Related configuration

### `frontend/next.config.mjs`

Three settings are part of the workaround:

- `compress`: disabled only in development because Wails rewrites HTML to inject runtime scripts; compressed upstream responses can otherwise retain a gzip header on an HTML body
- `allowedDevOrigins`: lets the Next dev server accept the Wails-driven development origin flow
- `turbopack.root`: keeps Turbopack resolution anchored to the frontend project root

### `wails.json`

The workaround assumes:

```json
"frontend:dev:serverUrl": "http://localhost:3000"
```

If that URL changes, update the WebSocket rewrite target too.

## Validation

Use this when touching the workaround:

```bash
bun run --cwd frontend build
bun run --cwd frontend lint
bun run --cwd frontend test:e2e
wails dev
```

For the manual smoke check:

1. Start `wails dev`
2. Open the desktop window
3. Switch Japanese/English, enter a test JWT, and decode it through the real Go backend
4. Edit a visible label in `frontend/app/page.tsx`
5. Confirm the desktop app updates without a manual reload and retains the JWT input
6. Restore the temporary label, check the update again, and quit the application

## Next.js upgrade checklist

HMR paths and initialization order are Next.js implementation details, not a stable integration contract. A future upgrade can change them again. A successful production build or browser E2E run does not establish that the custom-scheme Wails WebView works; the E2E suite mocks the Wails bridge and uses an HTTP browser origin.

After upgrading Next.js, React, Wails, or the frontend runtime:

1. Record the installed versions (`mise ls --current` and `frontend/package.json`), then run the build, lint, and E2E commands above.
2. Run a normal `wails build -f` to exercise frontend installation, build, bindings generation, and packaging. Inspect generated bindings for unexpected changes; do not repair them by hand.
3. Run `wails dev` and complete the native smoke check above. In the WebView inspector, confirm that the HMR socket connects to `ws://localhost:3000` with the path and query emitted by the installed Next.js version.
4. Check HTTP response decoding through the Wails dev server using the diagnostic commands below. Direct Next.js access alone does not cover Wails HTML rewriting.
5. Confirm the exported production HTML does not reference `wails-v2-hmr-socket-rewrite.js`; the development hook must remain inactive in production.
6. Record the versions, observed socket URL, native smoke result, and any changed workaround in the upgrade PR and this document. Restore all temporary debug code before committing.

## Troubleshooting a recurrence

### 1. Separate the development server from the WebView

Start `wails dev` and compare the desktop window with the printed Wails DevServer URL (normally `http://localhost:34115`) and the direct Next.js URL (`http://localhost:3000`). Ports in the Wails startup log are authoritative.

If HTTP works but the desktop window only displays initial HTML, language buttons do nothing, or JWT input never enables verification, check frontend initialization before investigating JWT verification. Open the desktop WebView's context menu and select **Inspect Element**, then inspect **Console** and **Network**. Capture the first error and failed request; repeated reloads can hide the original error.

### 2. Check the actual HMR path

In the Next.js 16.4 incident, the Console reported a failed connection to `wss://wails.localhost:34115/_next/hmr?id=...`. The old rewrite only recognized `/_next/webpack-hmr`, so the new socket bypassed it and failed TLS. Supporting the new exact path restored frontend initialization and native HMR. This also reproduced under Node.js before the Bun migration.

Inspect the socket request emitted by the installed version. Source inspection can help locate it:

```bash
rg -n --glob '*.js' 'webpack-hmr|/_next/hmr' frontend/node_modules/next/dist/client
```

If Next.js changes the endpoint again, update `rewriteHMRUrl` in `frontend/public/wails-v2-hmr-socket-rewrite.js` to recognize the observed exact path. Preserve the query string and keep the destination port aligned with `wails.json`. Do not redirect every WebSocket, change unrelated application sockets, or disable TLS validation. If the path matches but the patch is not taking effect, check that `frontend/app/layout.tsx` still loads the synchronous development script before the HMR client initializes.

### 3. Check HTML compression through Wails

With both servers running, use their actual ports:

```bash
curl --compressed --fail --show-error --silent http://localhost:3000/ -o /tmp/jwt-next-dev.html
curl --compressed --fail --show-error --silent http://localhost:34115/ -o /tmp/jwt-wails-dev.html
curl --silent --show-error -D /tmp/jwt-wails-dev.headers -H 'Accept-Encoding: gzip' http://localhost:34115/ -o /tmp/jwt-wails-dev.body
cat /tmp/jwt-wails-dev.headers
xxd -l 24 /tmp/jwt-wails-dev.body
```

The incident produced `ERR_CONTENT_DECODING_FAILED` in an HTTP browser and `incorrect header check` in compressed curl. The Wails response retained `Content-Encoding: gzip`, but its body started with `<html>` rather than gzip's `1f 8b` bytes. Wails modifies the upstream HTML to inject its runtime scripts. `compress: process.env.NODE_ENV !== 'development'` in `frontend/next.config.mjs` avoids the inconsistent development response while retaining the production setting.

If the workaround no longer suffices, compare direct Next.js and Wails headers/bodies before changing runtime or dependency versions. Restart `wails dev` after configuration changes and verify both response decoding and the native smoke check. Do not remove compression globally or change production behavior merely to hide a development proxy problem.

### 4. Validate and leave evidence

Keep `frontend/app/layout.tsx`, the HMR rewrite, `frontend/next.config.mjs`, `wails.json`, and this document aligned. Verify both the native HMR path and ordinary HTTP browser behavior after a fix. Include the observed error, affected versions, minimal fix, build/lint/E2E results, and native smoke result in the PR. If native execution was unavailable, state that boundary explicitly.

## Non-goals

- This is **not** a general WebSocket proxy layer.
- This is **not** a Wails runtime patch.
