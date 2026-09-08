/**
 * Copies three.js's Draco and Basis/KTX2 decoders into an app's `public/`
 * folder so they ship inside the installed app.
 *
 * Providers return whatever compression they like — Meshy and Tripo both emit
 * Draco-compressed meshes for some models — and GLTFLoader refuses to open
 * those without a decoder. Loading the decoders from a CDN would also break
 * the moment the app is offline, so they are bundled.
 *
 * Usage: node scripts/copy-decoders.mjs apps/desktop/public
 */
import { cp, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(process.argv[2] ?? 'public');
const libs = join(root, 'node_modules', 'three', 'examples', 'jsm', 'libs');

if (!existsSync(libs)) {
  console.error(`three.js decoder libs not found at ${libs} — run npm ci first`);
  process.exit(1);
}

for (const name of ['draco', 'basis']) {
  const from = join(libs, name);
  const to = join(target, name);
  await mkdir(dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
  console.log(`decoders: ${name} -> ${to}`);
}
