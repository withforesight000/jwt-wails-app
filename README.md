# jwt-wails-app (JWT Inspector)

JWT Inspector desktop tool for decoding and validating JSON Web Tokens (JWT). Enter a token, optionally attach a shared or public key, and review both the signature status and decoded data.

## Overview
- Decode JWT headers and claims with automatic extraction of `alg`, `iat`, `nbf`, and `exp`
- Verify signatures when a key is supplied (supports HS*, RS*, PS*, ES*, and EdDSA keys in PEM or DER form)
- Go-powered verification logic exposed to a Next.js/React UI via Wails v2
- Bilingual (Japanese/English) frontend text with automatic locale detection and a language switcher in the UI

## Prerequisites
- macOS + zsh (adjust shell configuration steps if you use another shell)
- [goenv](https://github.com/go-nv/goenv) for Go version management
- [nodenv](https://github.com/nodenv/nodenv) for Node.js version management
- Go 1.25.0 (matches `go.mod`)
- Node.js 24.6.0
- Wails CLI v2
- pnpm 10.15 (installed via Corepack or npm)

> Using goenv/nodenv is optional, but they keep local versions consistent with the project files.

## Table of Contents
1. Install goenv and nodenv
2. Install Go and Node.js
3. Install the Wails CLI
4. Set up the project
5. Common commands
6. Troubleshooting

---

## 1. Install goenv and nodenv (macOS + Homebrew)
Homebrew must be installed (`https://brew.sh/`).

```bash
brew update
brew install goenv nodenv node-build
```

Enable the shims by updating `~/.zshrc` (skip if already configured):

```bash
# goenv
export GOENV_ROOT="$HOME/.goenv"
export PATH="$GOENV_ROOT/bin:$PATH"
eval "$(goenv init -)"

# nodenv
export NODENV_ROOT="$HOME/.nodenv"
export PATH="$NODENV_ROOT/bin:$PATH"
eval "$(nodenv init -)"
```

Reload your shell:

```bash
source ~/.zshrc
```

## 2. Install Go and Node.js
`.go-version` and `.node-version` keep the required versions. Ensure they match `go.mod` and `frontend/package.json`:

```text
# .go-version
1.25.0

# .node-version
24.6.0
```

Install and activate the toolchains:

```bash
# Go
goenv install 1.25.0
goenv global 1.25.0

# Node.js
nodenv install 24.6.0
nodenv global 24.6.0
nodenv rehash
```

Check the versions:

```bash
go version
node -v
npm -v
```

Enable pnpm via Corepack (preferred) or install it globally:

```bash
corepack enable pnpm
corepack prepare pnpm@10.15.0 --activate
# or: npm install -g pnpm@10.15.0
```

## 3. Install the Wails CLI
Install Wails v2 using the configured Go environment.

```bash
go install github.com/wailsapp/wails/v2/cmd/wails@latest
```

Ensure the Go bin directory is on your `PATH` (add this to `~/.zshrc` if necessary):

```bash
export PATH="$(go env GOPATH)/bin:$PATH"
```

Validate the installation:

```bash
wails doctor
```

## 4. Set up the project
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

## 5. Common commands
- Development mode: `wails dev`
- Production build: `wails build` (outputs binaries under `build/bin/`)
- Frontend linting: `cd frontend && pnpm run lint`
- Frontend-only dev server (if needed): `cd frontend && pnpm run dev`
- Update Go dependencies: `go get -u ./... && go mod tidy`

## 6. Troubleshooting
- Run `wails doctor` to diagnose environment issues.
- If pnpm fails to install, confirm Corepack is enabled and you are using Node 24.6.0.
- For Go module errors, try `go clean -modcache` followed by `go mod download`.
- Ensure `.go-version`, `.node-version`, and the values in this README stay in sync after upgrades.
- Hot reload doesn't work. To work around, you manually reload the UI from the menu by right-clicking.

## Testing
- **Go unit tests:** `go test ./...`
- **Frontend E2E (Playwright):** `cd frontend && pnpm run test:e2e` — this spins up the Next dev server and runs Playwright tests that mock the Wails runtime to exercise the JWT Inspector UI.
