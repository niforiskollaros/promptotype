#!/usr/bin/env node

/**
 * Postinstall script that downloads the correct platform binary
 * from the GitHub release matching the package version.
 */

import { createWriteStream, chmodSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { get } from 'https';

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

async function main() {
  const binaryName = getPlatformBinary();
  const binDir = join(__dirname, '..', 'bin');
  const binPath = join(binDir, BIN_NAME);

  // Read version from package.json
  const { readFileSync } = await import('fs');
  const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8'));
  const version = pkg.version;

  const url = `https://github.com/${REPO}/releases/download/v${version}/${binaryName}`;

  console.log(`Downloading ${binaryName} v${version}...`);

  mkdirSync(binDir, { recursive: true });

  try {
    await download(url, binPath);
    chmodSync(binPath, 0o755);
    console.log(`Installed promptotype to ${binPath}`);
  } catch (err) {
    console.error(`Failed to download binary: ${err.message}`);
    console.error(`URL: ${url}`);
    console.error('You can install manually from: https://github.com/niforiskollaros/promptotype/releases');
    process.exit(1);
  }
}

main();
