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
pnpm -C frontend run build
pnpm -C frontend run lint
pnpm -C frontend run test:e2e
wails dev
```

For the manual smoke check:

1. Start `wails dev`
2. Open the desktop window
3. Edit a frontend file such as `frontend/app/page.tsx`
4. Confirm the desktop app updates without a manual reload

## Non-goals

- This is **not** a general WebSocket proxy layer.
- This is **not** a Wails runtime patch.
