#!/bin/bash
# Prints the Claude Code binary to check the mod with: $CLAUDE_BIN when set,
# else the newest engine bundled with the Claude desktop app, since that is the
# one a desktop session runs, else the `claude` on the PATH.
set -euo pipefail

if [[ -n "${CLAUDE_BIN:-}" ]]; then
  echo "$CLAUDE_BIN"
  exit 0
fi

bundled="$(ls -d "$HOME/Library/Application Support/Claude/claude-code"/*/*/claude.app/Contents/MacOS/claude 2>/dev/null | sort -V | tail -1 || true)"

if [[ -n "$bundled" ]]; then
  echo "$bundled"
else
  command -v claude
fi
