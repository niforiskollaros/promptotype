#!/usr/bin/env node

/**
 * Postinstall script:
 * 1. Downloads the correct platform binary from GitHub release
 * 2. Installs the /promptotype slash command for Claude Code
 * 3. Registers the MCP server in Claude Code (if available)
 */

import { createWriteStream, chmodSync, mkdirSync, copyFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';
import { execSync } from 'child_process';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

const REPO = 'niforiskollaros/promptotype';
const BIN_NAME = 'promptotype';

function getPlatformBinary() {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin' && arch === 'arm64') return `${BIN_NAME}-darwin-arm64`;
  if (platform === 'darwin' && arch === 'x64') return `${BIN_NAME}-darwin-x64`;
  if (platform === 'linux' && arch === 'x64') return `${BIN_NAME}-linux-x64`;
  if (platform === 'linux' && arch === 'arm64') return `${BIN_NAME}-linux-arm64`;

  console.error(`Unsupported platform: ${platform}-${arch}`);
  console.error('Promptotype supports: macOS (arm64, x64) and Linux (x64, arm64)');
  process.exit(1);
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const follow = (url) => {
      get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          follow(res.headers.location);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: HTTP ${res.statusCode} from ${url}`));
          return;
        }
        const file = createWriteStream(dest);
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
        file.on('error', reject);
      }).on('error', reject);
    };
    follow(url);
  });
}

function installSlashCommand(binPath) {
  const claudeCommandsDir = join(homedir(), '.claude', 'commands');
  const slashCommandSrc = join(__dirname, '..', 'cli', 'promptotype.md');
  const slashCommandDest = join(claudeCommandsDir, 'promptotype.md');

  try {
    if (existsSync(slashCommandSrc)) {
      mkdirSync(claudeCommandsDir, { recursive: true });
      copyFileSync(slashCommandSrc, slashCommandDest);
      console.log(`Installed /promptotype slash command → ${slashCommandDest}`);
    }
  } catch (err) {
    console.warn(`Could not install slash command: ${err.message}`);
  }
}

function registerMcpServer(binPath) {
  try {
    // Check if claude CLI is available
    execSync('which claude', { stdio: 'ignore' });

    // Register the MCP server globally
    execSync(`claude mcp add promptotype -s user -- ${binPath} serve`, {
      stdio: 'ignore',
    });
    console.log('Registered promptotype MCP server in Claude Code (global)');
  } catch {
    // Claude CLI not available or registration failed — that's OK
    console.log('Tip: To register MCP server manually, run:');
    console.log(`  claude mcp add promptotype -s user -- ${binPath} serve`);
  }

  // Auto-allow MCP tools so continuous mode doesn't prompt every iteration
  try {
    const settingsPath = join(homedir(), '.claude', 'settings.json');
    let settings = {};
    if (existsSync(settingsPath)) {
      settings = JSON.parse(readFileSync(settingsPath, 'utf8'));
    }
    if (!settings.permissions) settings.permissions = {};
    if (!settings.permissions.allow) settings.permissions.allow = [];

    const tools = ['mcp__promptotype__wait_for_annotations', 'mcp__promptotype__get_annotations'];
    let changed = false;
    for (const tool of tools) {
      if (!settings.permissions.allow.includes(tool)) {
        settings.permissions.allow.push(tool);
        changed = true;
      }
    }

    if (changed) {
      const { writeFileSync } = await import('fs');
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.log('Auto-allowed promptotype MCP tools in Claude Code permissions');
    }
  } catch {
    // Non-critical — user can allow manually
  }
}

async function main() {
  const binaryName = getPlatformBinary();
  const binDir = join(__dirname, '..', 'bin');
  const binPath = join(binDir, BIN_NAME);

  // Read version from package.json
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  const version = pkg.version;

  const url = `https://github.com/${REPO}/releases/download/v${version}/${binaryName}`;

  console.log(`Downloading ${binaryName} v${version}...`);

  mkdirSync(binDir, { recursive: true });

  try {
    await download(url, binPath);
    chmodSync(binPath, 0o755);
    console.log(`Installed promptotype binary → ${binPath}`);
  } catch (err) {
    console.error(`Failed to download binary: ${err.message}`);
    console.error(`URL: ${url}`);
    console.error('You can install manually from: https://github.com/niforiskollaros/promptotype/releases');
    // Don't exit — still install slash command and register MCP
  }

  // Install slash command for Claude Code
  installSlashCommand(binPath);

  // Register MCP server in Claude Code
  registerMcpServer(binPath);
}

main();
