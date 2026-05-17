import type { FieldlotListing } from '../borsa-listings-fetcher.js';
import {
	categoryTag,
	inferCategory,
	inferRegion,
	parsePriceFromText,
	roleFromUrl,
	slugId,
	stripHtml,
} from '../listing-parse-utils.js';

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const BASE = 'https://agro.bg';
const LIST = `${BASE}/obyavi/`;

type AgroCard = { path: string; title: string; url: string };

async function fetchHtml(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, 'Accept-Language': 'bg-BG,bg;q=0.9' },
		signal: AbortSignal.timeout(20_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
	return res.text();
}

function parseListCards(html: string): AgroCard[] {
	const byPath = new Map<string, AgroCard>();
	const re = /href="(\/obyavi\/[^"/]+\/[^"/]+\/?)"[^>]*>([^<]{1,160})</gi;
	let m: RegExpExecArray | null;
	while ((m = re.exec(html))) {
		const path = m[1];
		if (/\/uslugi\/|\/rabota\//i.test(path)) continue;
		const title = stripHtml(m[2]);
		if (!title || title.length < 4) continue;
		const prev = byPath.get(path);
		if (!prev || title.length > prev.title.length) {
			byPath.set(path, { path, title, url: `${BASE}${path}` });
		}
	}
	return [...byPath.values()];
}

async function fetchAgroDetail(url: string, fallbackTitle: string): Promise<{
	title: string;
	imageUrl?: string;
	description: string;
}> {
	try {
		const html = await fetchHtml(url);
		const ogTitle = html.match(/property="og:title"\s+content="([^"]+)"/i)?.[1];
		const h1 = stripHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '');
		let ogImg = html.match(/property="og:image"\s+content="([^"]+)"/i)?.[1];
		if (ogImg && !ogImg.startsWith('http')) ogImg = new URL(ogImg, BASE).href;
		const body = stripHtml(
			html.match(/class="[^"]*offer[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/div>/i)?.[1] ||
				html.match(/<article[\s\S]*?<\/article>/i)?.[0] ||
				'',
		).slice(0, 500);
		return {
			title: stripHtml(ogTitle || h1 || fallbackTitle),
			imageUrl: ogImg || undefined,
			description: body,
		};
	} catch {
		return { title: fallbackTitle, description: '' };
	}
}

export async function fetchAgroListings(maxItems = 25): Promise<FieldlotListing[]> {
	const listHtml = await fetchHtml(LIST);
	const cards = parseListCards(listHtml).slice(0, maxItems);
	const out: FieldlotListing[] = [];

	for (const card of cards) {
		const detail = await fetchAgroDetail(card.url, card.title);
		const role = roleFromUrl(card.url);
		const roleTag = role === 'buy' ? 'Търсене' : 'Продажба';
		const parsed = parsePriceFromText(`${detail.title} ${detail.description}`);
		const cat = inferCategory(detail.title);
		const reg = inferRegion(detail.description);

		out.push({
			id: slugId('agro-bg', card.url),
			title: detail.title,
			subtitle: `${reg.label} · agro.bg`,
			category: cat,
			region: reg.region,
			role,
			qty: '—',
			price: parsed?.price || 'По обява',
			priceUnit: parsed?.priceUnit || '',
			incoterm: 'България',
			harvest: '—',
			quality: detail.description || 'Виж пълното описание на agro.bg.',
			contact: `Източник: agro.bg · ${card.url}`,
			tags: [categoryTag(cat), roleTag, 'agro.bg'],
			source: 'agro-bg',
			sourceUrl: card.url,
			imageUrl: detail.imageUrl,
			publishedAt: new Date().toISOString().slice(0, 10),
		});
	}

	return out;
}
