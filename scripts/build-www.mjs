/* Copies the web app into www/, which is what Capacitor bundles into the APK.
   The same files are served from the repo root by GitHub Pages, so the PWA and
   the Android app always ship identical code. */
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'www');
const ASSETS = ['index.html', 'styles.css', 'app.js', 'manifest.webmanifest', 'sw.js', 'icons'];

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const asset of ASSETS) {
  await cp(join(root, asset), join(out, asset), { recursive: true });
}
console.log('www/ built from', ASSETS.length, 'entries');
