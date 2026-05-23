/**
 * Проверка: снимки от manifest, ключови HTML страници, API health (ако dev-api работи).
 * npm run verify
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
let failed = 0;

function fail(msg) {
	console.error('FAIL', msg);
	failed += 1;
}

function ok(msg) {
	console.log('OK', msg);
}

const manifest = JSON.parse(
	fs.readFileSync(path.join(root, 'data/fieldlot-image-manifest.json'), 'utf8'),
);
const paths = new Set();
function walk(o) {
	if (typeof o === 'string' && o.startsWith('/images/')) paths.add(o.slice(1));
	else if (o && typeof o === 'object') for (const v of Object.values(o)) walk(v);
}
walk(manifest);
for (const p of paths) {
	if (!fs.existsSync(path.join(root, 'public', p))) fail(`missing image public/${p}`);
}
if (failed === 0) ok(`${paths.size} manifest images on disk`);

for (const page of ['index.html', 'catalog.html', 'admin.html']) {
	if (!fs.existsSync(path.join(root, page))) fail(`missing ${page}`);
	else ok(page);
}

const listings = JSON.parse(fs.readFileSync(path.join(root, 'data/live-listings.json'), 'utf8'));
ok(`listings: ${listings.count ?? listings.listings?.length ?? 0} from ${listings.source || '?'}`);

const apiBase = process.env.FIELDLOT_SMOKE_BASE || 'http://127.0.0.1:8789';
try {
	const chat = await fetch(`${apiBase}/api/fieldlot-chat`);
	if (!chat.ok) fail(`GET /api/fieldlot-chat ${chat.status}`);
	else ok('GET /api/fieldlot-chat');
	const ex = await fetch(`${apiBase}/api/exchange-prices`);
	if (!ex.ok) fail(`GET /api/exchange-prices ${ex.status}`);
	else ok('GET /api/exchange-prices');
} catch {
	console.warn('SKIP API probes (start: npm run dev)');
}

if (failed) process.exit(1);
console.log('verify-fieldlot: all checks passed');
