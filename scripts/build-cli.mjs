#!/usr/bin/env node
/**
 * Bundle the CLI into a single self-contained ESM file.
 *
 * The banner does two things:
 * - Adds the shebang so the bundle is directly executable.
 * - Defines `require` via createRequire so CJS transitive deps (like `ws`,
 *   which uses `require('events')`) work inside the ESM bundle.
 */

import { build } from 'esbuild';
import { chmodSync } from 'node:fs';

const banner = `#!/usr/bin/env node
import { createRequire as __ptCreateRequire } from 'node:module';
import { fileURLToPath as __ptFileURLToPath } from 'node:url';
import { dirname as __ptDirname } from 'node:path';
const require = __ptCreateRequire(import.meta.url);
const __filename = __ptFileURLToPath(import.meta.url);
const __dirname = __ptDirname(__filename);`;

await build({
  entryPoints: ['cli/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: 'dist/cli.mjs',
  banner: { js: banner },
  legalComments: 'none',
});

chmodSync('dist/cli.mjs', 0o755);
console.log('Built dist/cli.mjs');
