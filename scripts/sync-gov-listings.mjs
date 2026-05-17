/**
 * Синхронизира обяви от borsaagro.com → data/live-listings.json + public/data/
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const outData = path.join(root, 'data/live-listings.json');
const outPublic = path.join(root, 'public/data/live-listings.json');

const run = spawnSync('npx', ['tsx', path.join(root, 'scripts/sync-gov-listings.ts')], {
	stdio: 'inherit',
	shell: true,
});
if (run.status !== 0) process.exit(run.status ?? 1);

spawnSync('node', [path.join(root, 'scripts/sync-images-from-manifest.mjs')], { stdio: 'inherit' });

if (fs.existsSync(outData)) {
	fs.mkdirSync(path.dirname(outPublic), { recursive: true });
	fs.copyFileSync(outData, outPublic);
	console.log('[sync-gov-listings] → public/data/live-listings.json');
}
