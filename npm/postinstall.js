#!/usr/bin/env node

/**
 * Postinstall script:
 * 1. Installs the /promptotype slash command for Claude Code
 * 2. Registers the MCP server in Claude Code (if available)
 * 3. Auto-allows the MCP tools in Claude Code permissions
 *
 * The CLI itself is a pre-bundled Node.js script (dist/cli.mjs) that ships in
 * the npm tarball — no platform-specific binaries to download.
 */

import { mkdirSync, copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { homedir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));

function installSlashCommand() {
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

function registerMcpServer() {
  try {
    execSync('which claude', { stdio: 'ignore' });
    execSync('claude mcp add promptotype -s user -- promptotype serve', { stdio: 'ignore' });
    console.log('Registered promptotype MCP server in Claude Code (global)');
  } catch {
    console.log('Tip: To register MCP server manually, run:');
    console.log('  claude mcp add promptotype -s user -- promptotype serve');
  }

  // Auto-allow MCP tools so continuous mode doesn't prompt every iteration.
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
      writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
      console.log('Auto-allowed promptotype MCP tools in Claude Code permissions');
    }
  } catch {
    // Non-critical — user can allow manually
  }
}

installSlashCommand();
registerMcpServer();
