# jwt-wails-app (JWT Inspector)

JWT Inspector desktop tool for decoding and validating JSON Web Tokens (JWT). Enter a token, optionally attach a shared or public key, and review both the signature status and decoded data.

## Overview
- Decode JWT headers and claims with automatic extraction of `alg`, `iat`, `nbf`, and `exp`
- Verify signatures when a key is supplied (supports HS*, RS*, PS*, ES*, and EdDSA keys in PEM or DER form)
- Go-powered verification logic exposed to a Next.js/React UI via Wails v2
- Bilingual (Japanese/English) frontend text with automatic locale detection and a language switcher in the UI

## Prerequisites
- macOS 13 Ventura or later + zsh (Go 1.27 requires macOS 13+; adjust shell configuration steps if you use another shell)
- [mise](https://mise.jdx.dev/) for project tool management
- Go 1.27.2, Node.js 24.21.0, pnpm 12.11.2, Wails CLI 2.16.0, and golangci-lint 2.14.0 (installed by mise)

## Table of Contents
1. Install mise
2. Install project tools
3. Set up the project
4. Common commands
5. Troubleshooting

---

## 1. Install mise (macOS + Homebrew)
Homebrew must be installed ([brew.sh](https://brew.sh/)).

```bash
brew install mise
```

Add the following to `~/.zshrc` if mise is not already activated, then reload your shell:

```bash
eval "$(mise activate zsh)"
source ~/.zshrc
```

## 2. Install project tools
From the repository root, trust the configuration and install the pinned tools:

```bash
mise trust
mise install
```

`mise.toml` defines the project tool versions. `.go-version` and `.node-version` are retained for compatibility with other version managers; keep them synchronized with `mise.toml`. Go's minimum version in `go.mod`, pnpm's `packageManager` in `frontend/package.json`, and CI versions should also stay aligned.

Check the active versions:

```bash
mise exec -- go version
mise exec -- node --version
mise exec -- pnpm --version
mise exec -- wails version
mise exec -- golangci-lint version
mise exec -- wails doctor
```

An activated mise shell selects these tools automatically inside the repository. Use `mise exec -- <command>` when shell activation is unavailable, including non-interactive shells.

## 3. Set up the project
Clone the repository (or move into the existing checkout):

```bash
git clone <repo-url>
cd jwt-wails-app
```

Optional: configure environment variables. Create a `.env` file if your setup needs secrets such as JWT keys or database credentials.

Install backend dependencies:

```bash
go mod download
```

Install frontend dependencies (pnpm is defined in `frontend/package.json` and `wails.json`):

```bash
cd frontend
pnpm install
cd ..
```

> The Wails CLI also runs `pnpm install` automatically via `frontend:install`, but running it once manually ensures the lockfile is respected before your first build.

## 4. Common commands
- Development mode: `wails dev`
- Production build: `wails build` (outputs binaries under `build/bin/`)
- Frontend linting: `cd frontend && pnpm run lint` (Biome + TypeScript type-check)
- Backend linting: `cd frontend && pnpm run build && cd .. && golangci-lint run ./...`
- Frontend-only dev server (if needed): `cd frontend && pnpm run dev`
- Update Go dependencies: `go get -u ./... && go mod tidy`

## 5. Troubleshooting
- Run `wails doctor` to diagnose environment issues.
- If a tool is missing or has the wrong version, run `mise install` and check `mise ls --current`; use `mise exec -- <command>` to select the project tools explicitly.
- Go tests and Go lint depend on the generated `frontend/out` tree; build the frontend first with `cd frontend && pnpm run build` or use `wails build`.
- For Go module errors, try `go clean -modcache` followed by `go mod download`.
- Keep `mise.toml`, `.go-version`, `.node-version`, `go.mod`, `frontend/package.json`, CI, and this README synchronized after tool upgrades.
- `wails dev` uses a frontend-side WebSocket rewrite so Next.js HMR connects back to `ws://localhost:3000` even though the Wails v2 webview is not served from a normal `http(s)` origin. See [the HMR guide](doc/wails-v2-hmr-workaround.md) for the upgrade checklist and troubleshooting steps when the native window stops responding or updating.

## Frontend linting
`pnpm -C frontend run lint` runs Biome 2.5.15 and TypeScript's type checker. CI uses the same command. Biome is installed as a frontend development dependency through the mise-managed pnpm.

`frontend/biome.json` enables the recommended checks and React/Next.js domains, plus rules migrated from the previous ESLint setup. Generated Wails bindings, Next.js output, browser-test reports, and `next-env.d.ts` are excluded. Formatting is not part of the lint command, so the migration preserves the existing source formatting.

`frontend/pnpm-workspace.yaml` explicitly skips the sharp install script; the build uses its optional prebuilt binaries. Other unreviewed dependency scripts still require an explicit decision during installation.

The tools do not have identical rule coverage: React Compiler checks such as `react-hooks/set-state-in-effect`, `react-hooks/purity`, and `react-hooks/immutability`, along with some Next.js-specific checks, have no Biome equivalent. TypeScript type checking remains mandatory but does not replace those rules.

## Testing
- **Go unit tests:** `cd frontend && pnpm run build && cd .. && go test ./...`
- **Backend lint:** `cd frontend && pnpm run build && cd .. && golangci-lint run ./...`
- **Frontend lint:** `cd frontend && pnpm run lint`
- **Frontend E2E (Playwright):** `cd frontend && pnpm run test:e2e` — this spins up the Next dev server and runs Playwright tests that mock the Wails runtime to exercise the JWT Inspector UI.
