/** Публични потребителски обяви от borsaagro.com (Борса Агро). */

import {
	getMaxListingAgeDays,
	getMaxListingAgeMs,
	pruneStaleListings,
} from './listings-freshness.js';

export type BorsaListingRaw = {
	sourceId: string;
	title: string;
	role: 'sell' | 'buy';
	good: string;
	qty: string;
	price: string;
	priceUnit: string;
	description: string;
	publishedAt: string;
	publishedTs: number;
	sourceUrl: string;
	verified: boolean;
};

export type FieldlotListing = {
	id: string;
	title: string;
	subtitle: string;
	category: string;
	region: string;
	role: 'sell' | 'buy' | string;
	qty: string;
	price: string;
	priceUnit: string;
	incoterm: string;
	harvest: string;
	quality: string;
	contact: string;
	tags: string[];
	source?: string;
	sourceUrl?: string;
	imageUrl?: string;
	publishedAt?: string;
};

export type ListingsSnapshot = {
	source: string;
	sourceUrl: string;
	fetchedAt: string;
	count: number;
	maxAgeDays: number;
	pruned: number;
	listings: FieldlotListing[];
};

const UA = 'Fieldlot/1.0 (+https://fieldlot-two.vercel.app)';
const SOURCE = 'borsaagro.com';
const LIST_URL = 'https://borsaagro.com/potrebitelski-obqvi';

const CATEGORY_RULES: { re: RegExp; cat: string }[] = [
	{ re: /пшеница|ечемик|царевица|лещ|зърн|пшен|wheat|corn|barley|lentil/i, cat: 'grain' },
	{ re: /слънчоглед|рапиц|олио|експелер|соев|sunflower|rapeseed|oil/i, cat: 'oilseed' },
	{ re: /ябъл|домат|чушк|плод|fruit|apple/i, cat: 'fruit' },
	{ re: /крастав|зелен|veg|pepper/i, cat: 'veg' },
	{ re: /сено|фураж|feed|hay/i, cat: 'feed' },
];

const REGION_RULES: { re: RegExp; region: string; label: string }[] = [
	{ re: /силистра|добрич|тутракан|добруджа/i, region: 'dobrudzha', label: 'Добруджа' },
	{ re: /плевен|русе|шумен|търговище|разград|север/i, region: 'north', label: 'Север' },
	{ re: /пловдив|стара загора|хасково|пазарджик|кърджали|юг/i, region: 'south', label: 'Юг' },
	{ re: /видин|монтана|враца|перник|запад/i, region: 'west', label: 'Североизапад' },
];

const CATEGORY_TAGS: Record<string, string> = {
	grain: 'Зърно',
	oilseed: 'Маслодайни',
	fruit: 'Плодове',
	veg: 'Зеленчуци',
	feed: 'Фураж',
};

function stripHtml(s: string): string {
	return s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseBgDate(raw: string): { iso: string; ts: number } {
	const m = raw.match(/(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
	if (!m) return { iso: raw, ts: 0 };
	const [, d, mo, y, h = '0', mi = '0'] = m;
	const dt = new Date(`${y}-${mo}-${d}T${h}:${mi}:00+03:00`);
	const ts = dt.getTime();
	return { iso: Number.isFinite(ts) ? dt.toISOString() : raw, ts: Number.isFinite(ts) ? ts : 0 };
}

function inferCategory(text: string): string {
	for (const { re, cat } of CATEGORY_RULES) {
		if (re.test(text)) return cat;
	}
	return 'grain';
}

function inferRegion(text: string): { region: string; label: string } {
	for (const r of REGION_RULES) {
		if (r.re.test(text)) return { region: r.region, label: r.label };
	}
	return { region: 'national', label: 'България' };
}

function normalizeGood(title: string): string {
	return title
		.replace(/^(продава|купува):\s*/i, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function parseListCards(html: string): { id: string; title: string; date: string; price: string }[] {
	const out: { id: string; title: string; date: string; price: string }[] = [];
	const re =
		/href="https:\/\/borsaagro\.com\/potrebitelski-obqvi\/(\d+)"[^>]*class="stretched-link[^"]*"[^>]*>([^<]+)<\/a>[\s\S]*?fa-clock[\s\S]*?>([^<]+)<[\s\S]*?fw-semibold fs-5">\s*([\d.,]+)/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		out.push({
			id: m[1],
			title: stripHtml(m[2]),
			date: stripHtml(m[3]),
			price: stripHtml(m[4]),
		});
	}
	return out;
}

function parseDetailKv(html: string): Record<string, string> {
	const kv: Record<string, string> = {};
	const re = /<td class="kv-k">([^<]+)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>/gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		kv[m[1].trim()] = stripHtml(m[2]);
	}
	return kv;
}

async function fetchHtml(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, Accept: 'text/html; charset=utf-8' },
		signal: AbortSignal.timeout(20000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.text();
}

export async function fetchBorsaListingDetails(
	id: string,
	card?: { title: string; date: string; price: string },
): Promise<BorsaListingRaw> {
	const url = `${LIST_URL}/${id}`;
	const html = await fetchHtml(url);
	const kv = parseDetailKv(html);
	const h1 = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim() || card?.title || '';
	const verified = !/НЕПРОВЕРЕНА/i.test(html);

	const typeRaw = kv['Тип'] || '';
	const role: 'sell' | 'buy' = /купува/i.test(typeRaw) || /купува/i.test(h1) ? 'buy' : 'sell';
	const good = normalizeGood(kv['Стока'] || h1.replace(/^(Продава|Купува):\s*/i, '') || card?.title || 'Обява');
	const qtyRaw = kv['Количество'] || '';
	const qty = qtyRaw || '—';
	const priceRaw = kv['Цена'] || card?.price || '—';
	const priceUnit = /€|eur/i.test(priceRaw) ? '€' : 'лв';
	const price = priceRaw.replace(/\s*€.*$/i, '').trim() || priceRaw;
	const description = kv['Описание'] || '';
	const pubBadge = html.match(/Публикувана:\s*([^<]+)/i)?.[1]?.trim() || card?.date || '';
	const { iso, ts } = parseBgDate(pubBadge);

	return {
		sourceId: id,
		title: good,
		role,
		good,
		qty,
		price,
		priceUnit,
		description,
		publishedAt: iso,
		publishedTs: ts,
		sourceUrl: url,
		verified,
	};
}

export function mapBorsaToFieldlot(raw: BorsaListingRaw): FieldlotListing {
	const cat = inferCategory(`${raw.good} ${raw.description}`);
	const reg = inferRegion(`${raw.description} ${raw.good}`);
	const catTag = CATEGORY_TAGS[cat] || 'Агро';
	const roleTag = raw.role === 'buy' ? 'Търсене' : 'Продажба';
	const verifiedTag = raw.verified ? 'Проверена' : 'Непроверена';

	return {
		id: `ba-${raw.sourceId}`,
		title: raw.good,
		subtitle: `${reg.label} · ${SOURCE}`,
		category: cat,
		region: reg.region,
		role: raw.role,
		qty: raw.qty,
		price: raw.price,
		priceUnit: raw.priceUnit === '€' ? '€' : 'лв',
		incoterm: 'По обява на източника',
		harvest: raw.publishedAt
			? `Публикувана ${new Date(raw.publishedAt).toLocaleDateString('bg-BG')}`
			: '—',
		quality: raw.description || 'Без допълнително описание в източника.',
		contact: `Източник: ${SOURCE} · ${verifiedTag}. Оригинал: ${raw.sourceUrl}`,
		tags: [catTag, roleTag, SOURCE],
		source: SOURCE,
		sourceUrl: raw.sourceUrl,
		publishedAt: raw.publishedAt,
	};
}

function isCardDateFresh(dateStr: string, nowMs = Date.now()): boolean {
	const { ts } = parseBgDate(dateStr);
	if (ts <= 0) return false;
	return nowMs - ts <= getMaxListingAgeMs();
}

export async function fetchBorsaListingsSnapshot(maxItems = 40): Promise<ListingsSnapshot> {
	const html = await fetchHtml(LIST_URL);
	const cards = parseListCards(html);
	const unique = new Map<string, (typeof cards)[0]>();
	for (const c of cards) unique.set(c.id, c);
	const nowMs = Date.now();
	const freshCards = [...unique.values()]
		.filter((c) => isCardDateFresh(c.date, nowMs))
		.slice(0, maxItems);
	const skippedOld = unique.size - freshCards.length;
	if (skippedOld > 0) {
		console.info(`[borsa-listings] пропуснати ${skippedOld} стари обяви от индекса (>${getMaxListingAgeDays()} дни)`);
	}

	const raws: BorsaListingRaw[] = [];
	for (const card of freshCards) {
		try {
			raws.push(await fetchBorsaListingDetails(card.id, card));
		} catch (e) {
			console.warn(`[borsa-listings] skip ${card.id}:`, e instanceof Error ? e.message : e);
		}
	}

	raws.sort((a, b) => b.publishedTs - a.publishedTs);
	const mapped = raws.map(mapBorsaToFieldlot);
	const { kept, removed } = pruneStaleListings(mapped, nowMs);
	if (removed > 0) {
		console.info(`[borsa-listings] премахнати ${removed} изтекли/стари обяви (>${getMaxListingAgeDays()} дни)`);
	}

	return {
		source: `${SOURCE} · потребителски обяви`,
		sourceUrl: LIST_URL,
		fetchedAt: new Date().toISOString(),
		maxAgeDays: getMaxListingAgeDays(),
		pruned: skippedOld + removed,
		count: kept.length,
		listings: kept,
	};
}
