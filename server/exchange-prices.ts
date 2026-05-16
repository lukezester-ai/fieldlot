/** Борсови референтни цени (MATIF/EUR → BGN) от borsaagro.com */

export type ExchangeQuote = {
	id: 'wheat' | 'sunflower' | 'corn' | 'rapeseed';
	name: string;
	priceEur: number;
	priceBgn: number;
	unit: string;
	chg: number;
};

export type ExchangeSnapshot = {
	source: string;
	sourceUrl: string;
	fetchedAt: string;
	eurToBgn: number;
	quotes: ExchangeQuote[];
	note: string;
};

const EUR_BGN = 1.95583;

function parseEuNumber(raw: string): number {
	return Number(String(raw).replace(/\s/g, '').replace(',', '.'));
}

export async function fetchExchangeSnapshot(): Promise<ExchangeSnapshot> {
	const res = await fetch('https://borsaagro.com/', {
		headers: {
			'User-Agent': 'Fieldlot/1.0 (+https://fieldlot-two.vercel.app)',
			Accept: 'text/html',
		},
		signal: AbortSignal.timeout(15000),
	});
	if (!res.ok) throw new Error(`borsaagro HTTP ${res.status}`);
	const html = await res.text();

	const priceAfter = (label: string) =>
		new RegExp(
			`${label}[\\s\\S]{0,500}?class="price[^"]*">\\s*([\\d.,]+)\\s*€\\s*/\\s*мт`,
			'i',
		);

	const defs: { id: ExchangeQuote['id']; name: string; re: RegExp }[] = [
		{ id: 'wheat', name: 'Пшеница', re: priceAfter('Пшеница\\s+MATIF') },
		{ id: 'corn', name: 'Царевица', re: priceAfter('Царевица\\s+MATIF') },
		{ id: 'rapeseed', name: 'Рапица', re: priceAfter('Рапица\\s+MATIF') },
		{ id: 'sunflower', name: 'Слънчоглед', re: priceAfter('Слънчоглед[^<]{0,30}') },
	];

	const chgById = await fetchYahooChgPercent();

	const quotes: ExchangeQuote[] = [];
	for (const d of defs) {
		const m = html.match(d.re);
		if (!m) continue;
		const priceEur = parseEuNumber(m[1]);
		if (!Number.isFinite(priceEur) || priceEur <= 0) continue;
		const priceBgn = Math.round(priceEur * EUR_BGN);
		quotes.push({
			id: d.id,
			name: d.name,
			priceEur,
			priceBgn,
			unit: 'лв/тон',
			chg: chgById[d.id] ?? 0,
		});
	}

	if (quotes.length < 4) {
		throw new Error(`Липсват котировки от borsaagro (намерени ${quotes.length}/4)`);
	}

	return {
		source: 'borsaagro.com · MATIF/EUR',
		sourceUrl: 'https://borsaagro.com/',
		fetchedAt: new Date().toISOString(),
		eurToBgn: EUR_BGN,
		quotes,
		note: 'Индикативни борсови референтни цени (MATIF), не са оферта за сделка. Обновяване: веднъж дневно.',
	};
}

const YAHOO_SYMBOLS: Record<ExchangeQuote['id'], string> = {
	wheat: 'ZW=F',
	corn: 'ZC=F',
	rapeseed: 'RS=F',
	sunflower: 'BO=F',
};

async function fetchYahooChgPercent(): Promise<Partial<Record<ExchangeQuote['id'], number>>> {
	const out: Partial<Record<ExchangeQuote['id'], number>> = {};
	await Promise.all(
		(Object.entries(YAHOO_SYMBOLS) as [ExchangeQuote['id'], string][]).map(async ([id, sym]) => {
			try {
				const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=5d`;
				const r = await fetch(url, {
					headers: { 'User-Agent': 'Mozilla/5.0' },
					signal: AbortSignal.timeout(10000),
				});
				if (!r.ok) return;
				const j = (await r.json()) as {
					chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number } }[] };
				};
				const meta = j.chart?.result?.[0]?.meta;
				const last = meta?.regularMarketPrice;
				const prev = meta?.chartPreviousClose;
				if (last == null || prev == null || prev === 0) return;
				out[id] = +(((last - prev) / prev) * 100).toFixed(1);
			} catch {
				/* optional */
			}
		}),
	);
	return out;
}

export function formatExchangeForRag(snap: ExchangeSnapshot): string {
	const lines = snap.quotes.map(
		(q) =>
			`• ${q.name}: ${q.priceBgn} ${q.unit} (MATIF ~${q.priceEur} €/т, промяна ${q.chg >= 0 ? '+' : ''}${q.chg}%)`,
	);
	return [
		'=== RAG: БОРСОВИ ЦЕНИ (живи) ===',
		`Източник: ${snap.source} · ${snap.sourceUrl}`,
		`Обновено: ${snap.fetchedAt} · курс EUR→BGN: ${snap.eurToBgn}`,
		lines.join('\n'),
		snap.note,
		'Правило за AI: следи котировките веднъж дневно; при въпрос за цени ползвай този блок.',
	].join('\n');
}

let memoryCache: { snap: ExchangeSnapshot; at: number } | null = null;
const CACHE_MS = 24 * 60 * 60 * 1000;

export async function getExchangeSnapshotCached(): Promise<ExchangeSnapshot> {
	const now = Date.now();
	if (memoryCache && now - memoryCache.at < CACHE_MS) return memoryCache.snap;
	const snap = await fetchExchangeSnapshot();
	memoryCache = { snap, at: now };
	return snap;
}
