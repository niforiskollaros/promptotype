#!/bin/bash
# Promptotype installer
# Usage: curl -fsSL https://locusai.design/install.sh | bash

set -euo pipefail

REPO="SignalOrg/designottaror"
BIN_DIR="${HOME}/.local/bin"
BIN_NAME="promptotype"

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Darwin) PLATFORM="darwin" ;;
  Linux)  PLATFORM="linux" ;;
  *)
    echo "Error: Unsupported OS: $OS"
    echo "Promptotype supports macOS and Linux."
    exit 1
    ;;
esac

case "$ARCH" in
  arm64|aarch64) ARCH_SUFFIX="arm64" ;;
  x86_64|amd64)  ARCH_SUFFIX="x64" ;;
  *)
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

BINARY_NAME="${BIN_NAME}-${PLATFORM}-${ARCH_SUFFIX}"

echo ""
echo "  Promptotype Installer"
echo "  ====================="
echo ""
echo "  Platform: ${PLATFORM}-${ARCH_SUFFIX}"
echo ""

# Get latest release URL
RELEASE_URL="https://github.com/${REPO}/releases/latest/download/${BINARY_NAME}"

# Create bin directory
mkdir -p "$BIN_DIR"

# Download binary
echo "  Downloading ${BINARY_NAME}..."
if command -v curl &>/dev/null; then
  curl -fsSL "$RELEASE_URL" -o "${BIN_DIR}/${BIN_NAME}"
elif command -v wget &>/dev/null; then
  wget -q "$RELEASE_URL" -O "${BIN_DIR}/${BIN_NAME}"
else
  echo "Error: curl or wget required"
  exit 1
fi

chmod +x "${BIN_DIR}/${BIN_NAME}"
echo "  Binary installed to ${BIN_DIR}/${BIN_NAME}"

# Install slash command for Claude Code (and compatible tools)
install_slash_command() {
  local CMD_DIR="$1"
  local TOOL_NAME="$2"

  if [ -d "$(dirname "$CMD_DIR")" ]; then
    mkdir -p "$CMD_DIR"
    cat > "${CMD_DIR}/promptotype.md" << 'SLASHEOF'
Annotate UI elements in a running app and return structured design feedback.

The user wants you to look at their running app and make design changes based on their annotations.
Run the Promptotype proxy to let them select elements, describe what they want changed, and submit structured feedback.

`!~/.local/bin/promptotype $ARGUMENTS`

The output above contains structured design annotations with CSS selectors, current computed styles, and user prompts for each annotated element. Use these annotations to make the requested changes to the codebase.
SLASHEOF
    echo "  Slash command installed for ${TOOL_NAME}"
  fi
}

# Claude Code
install_slash_command "${HOME}/.claude/commands" "Claude Code"

# Codex
install_slash_command "${HOME}/.codex/commands" "Codex"

# Gemini CLI
install_slash_command "${HOME}/.gemini/commands" "Gemini CLI"

echo ""

# Check PATH
if ! echo "$PATH" | tr ':' '\n' | grep -q "^${BIN_DIR}$"; then
  echo "  Note: ${BIN_DIR} is not in your PATH."
  echo "  Add this to your shell profile:"
  echo ""
  echo "    export PATH=\"\${HOME}/.local/bin:\${PATH}\""
  echo ""
fi

echo "  Done! Usage:"
echo ""
echo "    promptotype http://localhost:3000"
echo "    /promptotype http://localhost:3000    (from Claude Code)"
echo ""
