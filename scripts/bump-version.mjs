#!/usr/bin/env node
/**
 * Set the version everywhere it is written down, in one step.
 *
 * The Android in-place update guarantee depends on the version only ever going
 * up, and the desktop updater compares against tauri.conf.json — so a partial
 * bump ships a build that will not offer itself as an update.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const next = process.argv[2];
if (!/^\d+\.\d+\.\d+$/.test(next ?? '')) {
  console.error('usage: node scripts/bump-version.mjs <major.minor.patch>');
  process.exit(1);
}

const JSON_FILES = [
  'package.json',
  'apps/desktop/package.json',
  'apps/mobile/package.json',
  'packages/core/package.json',
  'packages/ui/package.json',
  'apps/desktop/src-tauri/tauri.conf.json',
];

const current = JSON.parse(readFileSync('package.json', 'utf8')).version;
if (current === next) {
  console.error(`already at ${next}`);
  process.exit(1);
}

for (const file of JSON_FILES) {
  const before = readFileSync(file, 'utf8');
  const after = before.replace(`"version": "${current}"`, `"version": "${next}"`);
  if (before === after) {
    console.error(`${file} does not carry version ${current}`);
    process.exit(1);
  }
  writeFileSync(file, after);
}

const cargo = 'apps/desktop/src-tauri/Cargo.toml';
const before = readFileSync(cargo, 'utf8');
const after = before.replace(`version = "${current}"`, `version = "${next}"`);
if (before === after) {
  console.error(`${cargo} does not carry version ${current}`);
  process.exit(1);
}
writeFileSync(cargo, after);

execFileSync('npm', ['install', '--package-lock-only', '--silent'], { stdio: 'inherit' });
console.log(`${current} → ${next}`);
