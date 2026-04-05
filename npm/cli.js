#!/usr/bin/env node

/**
 * Thin wrapper that exec's the platform-specific binary.
 * The binary is downloaded by postinstall.js into ../bin/promptotype.
 */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const binPath = join(__dirname, '..', 'bin', 'promptotype');

if (!existsSync(binPath)) {
  console.error('Binary not found. Try reinstalling: npm install -g promptotype');
  process.exit(1);
}

try {
  execFileSync(binPath, process.argv.slice(2), { stdio: 'inherit' });
} catch (err) {
  process.exit(err.status ?? 1);
}
