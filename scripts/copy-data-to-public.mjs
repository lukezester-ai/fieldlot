import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SRC = path.join(ROOT, 'data');
const DEST = path.join(ROOT, 'public', 'data');

const FILES = [
	'live-listings.json',
	'demo-listings.json',
	'exchange-prices.json',
	'fieldlot-image-manifest.json',
];

fs.mkdirSync(DEST, { recursive: true });
for (const name of FILES) {
	const from = path.join(SRC, name);
	if (!fs.existsSync(from)) {
		console.warn('skip missing', from);
		continue;
	}
	const to = path.join(DEST, name);
	fs.copyFileSync(from, to);
	console.log('copied', name, '→ public/data/');
}
