/**
 * Copy user-provided category photos from Cursor workspace assets.
 */
import fs from 'node:fs';
import path from 'node:path';

const assetsDir =
	'C:\\Users\\expre\\.cursor\\projects\\c-Users-expre-OneDrive-Desktop-agrinexus-final-main\\assets';
const cropsDir = path.resolve('public/images/crops');

function findAsset(prefix) {
	const hit = fs.readdirSync(assetsDir).find((f) => f.includes(prefix));
	if (!hit) throw new Error(`Asset not found: ${prefix}`);
	return path.join(assetsDir, hit);
}

function copy(prefix, destName) {
	const src = findAsset(prefix);
	const dest = path.join(cropsDir, destName);
	fs.mkdirSync(cropsDir, { recursive: true });
	fs.copyFileSync(src, dest);
	const size = fs.statSync(dest).size;
	console.log(`${destName}: ${size} bytes`);
}

const pairs = [
	['fruits-and-berries_shutterstock', 'apple.jpg'],
	['sundew-sunflower-oil', 'oil.webp'],
	['768x432', 'feed.jpg'],
	['T8_435_Gene', 'machines.webp'],
	['11-11966f58', 'fertilizer.jpg'],
	['download-37788ac9', 'canned.jpg'],
];

for (const [prefix, dest] of pairs) copy(prefix, dest);
