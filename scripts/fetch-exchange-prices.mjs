/**
 * Локално: node scripts/fetch-exchange-prices.mjs
 * Записва public/data/exchange-prices.json за статичен fallback.
 */
import fs from 'node:fs';
import path from 'node:path';

const EUR_BGN = 1.95583;

function parseEuNumber(raw) {
	return Number(String(raw).replace(/\s/g, '').replace(',', '.'));
}

async function main() {
	const res = await fetch('https://borsaagro.com/', {
		headers: { 'User-Agent': 'Fieldlot/1.0', Accept: 'text/html' },
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const html = await res.text();
	const priceAfter = (label) =>
		new RegExp(
			`${label}[\\s\\S]{0,500}?class="price[^"]*">\\s*([\\d.,]+)\\s*€\\s*/\\s*мт`,
			'i',
		);
	const defs = [
		{ id: 'wheat', name: 'Пшеница', re: priceAfter('Пшеница\\s+MATIF') },
		{ id: 'corn', name: 'Царевица', re: priceAfter('Царевица\\s+MATIF') },
		{ id: 'rapeseed', name: 'Рапица', re: priceAfter('Рапица\\s+MATIF') },
		{ id: 'sunflower', name: 'Слънчоглед', re: priceAfter('Слънчоглед[^<]{0,30}') },
	];
	const quotes = [];
	for (const d of defs) {
		const m = html.match(d.re);
		if (!m) continue;
		const priceEur = parseEuNumber(m[1]);
		const priceBgn = Math.round(priceEur * EUR_BGN);
		quotes.push({
			id: d.id,
			name: d.name,
			priceEur,
			priceBgn,
			unit: 'лв/тон',
			chg: 0,
		});
	}
	const snap = {
		source: 'borsaagro.com · MATIF/EUR',
		sourceUrl: 'https://borsaagro.com/',
		fetchedAt: new Date().toISOString(),
		eurToBgn: EUR_BGN,
		quotes,
		note: 'Индикативни борсови референтни цени. Обновяване: веднъж дневно.',
	};
	const out = path.resolve('public/data/exchange-prices.json');
	fs.mkdirSync(path.dirname(out), { recursive: true });
	fs.writeFileSync(out, JSON.stringify(snap, null, 2));
	fs.writeFileSync(path.resolve('data/exchange-prices.json'), JSON.stringify(snap, null, 2));
	console.log('Wrote', out, quotes.map((q) => `${q.name} ${q.priceBgn} лв/т`).join(', '));
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
