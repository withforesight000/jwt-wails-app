#!/usr/bin/env bash
# Run frontend checks without relying on a host Node.js or package manager.
set -euo pipefail

if [[ $# -eq 0 ]]; then
  echo "Usage: $0 <command> [args...]" >&2
  exit 2
fi

bun_binary=$(bun -e 'console.log(process.execPath)')
tool_dir=$(mktemp -d "${TMPDIR:-/tmp}/jwt-without-node.XXXXXX")
trap 'rm -rf "$tool_dir"' EXIT
# Package installation can drop privileges to _apt; allow traversal, not writes.
chmod 755 "$tool_dir"

for system_dir in /usr/bin /bin; do
  for tool in "$system_dir"/*; do
    [[ -f "$tool" && -x "$tool" ]] || continue
    name=${tool##*/}
    case "$name" in
      node|nodejs|npm|npx|pnpm|pnpx|corepack|bun|bunx) continue ;;
    esac
    [[ -e "$tool_dir/$name" ]] || ln -s "$tool" "$tool_dir/$name"
  done
done
ln -s "$bun_binary" "$tool_dir/bun"
export PATH="$tool_dir"

for command in node nodejs npm npx pnpm pnpx corepack; do
  if command -v "$command" >/dev/null 2>&1; then
    echo "Unexpected host command in PATH: $command" >&2
    exit 1
  fi
done

# Bun's --bun/run.bun node alias executes Bun, and is intentionally permitted.
bun -e 'if (!process.versions.bun) throw new Error("Bun runtime required"); console.log(`Frontend runtime: Bun ${process.versions.bun}`)'
"$@"
