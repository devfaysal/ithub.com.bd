import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'dist');
const publicFiles = [
  'index.html', '404.html', '_headers', '_redirects', '_routes.json',
  'robots.txt', 'sitemap.xml', 'assets', 'about', 'contact', 'privacy',
  'products', 'services',
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const path of publicFiles) {
  await cp(join(root, path), join(output, path), { recursive: true });
}
const entries = await readdir(output);
console.log(`Prepared ${entries.length} public entries in dist/. Functions and configuration remain outside the public directory.`);
