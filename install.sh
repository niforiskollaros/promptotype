#!/bin/bash
# Promptotype installer
# Usage: curl -fsSL https://locusai.design/install.sh | bash
#
# Since v0.3.0, Promptotype ships as a Node.js package. This script verifies
# Node is installed at a supported version, then defers to `npm install -g`.

set -euo pipefail

MIN_NODE_MAJOR=22

echo ""
echo "  Promptotype Installer"
echo "  ====================="
echo ""

# --- Node.js check ---
if ! command -v node >/dev/null 2>&1; then
  echo "  Error: Node.js is required (>= ${MIN_NODE_MAJOR})."
  echo ""
  echo "  Install Node.js from https://nodejs.org/, then re-run this script."
  echo "  Or install via a version manager:"
  echo "    • brew:      brew install node"
  echo "    • fnm:       fnm install ${MIN_NODE_MAJOR}"
  echo "    • nvm:       nvm install ${MIN_NODE_MAJOR}"
  echo ""
  exit 1
fi

NODE_VERSION="$(node -v)"
NODE_MAJOR="$(echo "${NODE_VERSION}" | sed -E 's/^v([0-9]+).*/\1/')"

if [ "${NODE_MAJOR}" -lt "${MIN_NODE_MAJOR}" ]; then
  echo "  Error: Node.js ${NODE_VERSION} is too old."
  echo "  Promptotype requires Node >= ${MIN_NODE_MAJOR}."
  echo ""
  echo "  Upgrade your Node.js install and try again."
  echo ""
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "  Error: npm is not available."
  echo "  npm normally ships with Node.js — reinstall Node.js from https://nodejs.org/"
  echo ""
  exit 1
fi

echo "  Using Node ${NODE_VERSION} — installing promptotype via npm..."
echo ""

# --- Install ---
# Prefer -g when we clearly own node_modules; fall back to --prefix for
# Homebrew-managed Node on macOS where -g wants sudo.
if npm install -g promptotype; then
  :
elif [ "$(uname -s)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
  echo ""
  echo "  Global install failed (likely a permission issue)."
  echo "  Retrying with sudo..."
  sudo npm install -g promptotype
else
  echo ""
  echo "  npm install -g failed. Try one of:"
  echo "    sudo npm install -g promptotype"
  echo "    npm install -g promptotype --prefix \"\$HOME/.npm-global\""
  exit 1
fi

echo ""
echo "  Done! Usage:"
echo ""
echo "    promptotype                              # auto-detect dev server"
echo "    promptotype http://localhost:3000        # proxy a specific URL"
echo "    promptotype serve                        # start MCP server (Claude Code)"
echo ""
echo "  The /promptotype slash command and MCP server were registered automatically"
echo "  if the Claude Code CLI is installed."
echo ""
