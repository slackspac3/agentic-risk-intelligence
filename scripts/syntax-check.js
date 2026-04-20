'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const checkedFiles = [];

function walk(currentPath) {
  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  entries.forEach((entry) => {
    const fullPath = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(fullPath);
      return;
    }
    if (entry.isFile() && /\.js$/i.test(entry.name)) checkedFiles.push(fullPath);
  });
}

walk(ROOT);

checkedFiles.forEach((filePath) => {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    stdio: 'pipe',
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${filePath}\n`);
    process.exit(result.status || 1);
  }
});

process.stdout.write(`Syntax check passed for ${checkedFiles.length} JavaScript files.\n`);
