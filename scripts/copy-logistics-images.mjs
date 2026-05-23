/**
 * Logistics photos from user assets.
 * tracking → screen-shot | warehouse → 2-137418 | transport → GettyImages-512138127
 */
import fs from 'node:fs';
import path from 'node:path';

const assetsDir =
	'C:\\Users\\expre\\.cursor\\projects\\c-Users-expre-OneDrive-Desktop-agrinexus-final-main\\assets';
const outDir = path.resolve('public/images/logistics');

const pairs = [
	['screen-shot-2025-04-11', 'tracking.jpg'],
	['2-137418-015b1fd8', 'warehouse.jpg'],
	['0_GettyImages-512138127', 'transport.jpg'],
];

function findAsset(prefix) {
	const hit = fs.readdirSync(assetsDir).find((f) => f.includes(prefix));
	if (!hit) throw new Error(`Asset not found: ${prefix}`);
	return path.join(assetsDir, hit);
}

fs.mkdirSync(outDir, { recursive: true });

for (const [prefix, destName] of pairs) {
	const src = findAsset(prefix);
	const dest = path.join(outDir, destName);
	fs.copyFileSync(src, dest);
	console.log(destName, fs.statSync(dest).size);
}
