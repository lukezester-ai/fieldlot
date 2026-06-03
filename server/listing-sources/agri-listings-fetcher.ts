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
	'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';
const HOME = 'https://agri.bg/';

export async function fetchAgriListings(maxItems = 100): Promise<FieldlotListing[]> {
	const res = await fetch(HOME, {
		headers: { 
			'User-Agent': UA, 
			'Accept-Language': 'bg-BG,bg;q=0.9,en-US;q=0.8,en;q=0.7',
			'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
			'Referer': 'https://www.google.com/'
		},
		signal: AbortSignal.timeout(25_000),
	});
	if (!res.ok) {
		console.warn(`[agri.bg] HTTP ${res.status} Forbidden - skipping instead of crashing`);
		return [];
	}
	const html = await res.text();

	const re =
		/<h2>\s*<a href="(https:\/\/agri\.bg\/agroborsa\/ad\/[^"]+)" title="([^"]+)">/gi;
	const out: FieldlotListing[] = [];
	const seen = new Set<string>();

	let m: RegExpExecArray | null;
	while ((m = re.exec(html)) && out.length < maxItems) {
		const sourceUrl = m[1].replace(/\/$/, '');
		if (seen.has(sourceUrl)) continue;
		if (/\/(barter|barteri)\//i.test(sourceUrl)) continue;
		seen.add(sourceUrl);

		const chunk = html.slice(m.index, m.index + 2800);
		const title = stripHtml(m[2]);
		const desc = stripHtml(chunk.match(/trading-desc[^>]*>([\s\S]*?)<\/p>/i)?.[1] || '');
		const loc = stripHtml(chunk.match(/ico-location[\s\S]*?<\/i>\s*([^<]+)/i)?.[1] || '');
		let img = chunk.match(/<img[^>]+src="([^"]+)"/i)?.[1] || '';
		if (img && !img.startsWith('http')) img = new URL(img, HOME).href;
		if (img.includes('docs-pdf') || img.includes('.svg')) img = '';

		const role = roleFromUrl(sourceUrl);
		const roleTag = role === 'buy' ? 'Търсене' : 'Продажба';
		const parsed = parsePriceFromText(`${title} ${desc}`);
		const cat = inferCategory(`${title} ${desc}`);
		const reg = inferRegion(loc || desc);

		out.push({
			id: slugId('agri-bg', sourceUrl),
			title,
			subtitle: `${reg.label} · agri.bg`,
			category: cat,
			region: reg.region,
			role,
			qty: desc.match(/\d+[\d,.]*\s*(тона|т\.|кг|бали)/i)?.[0] || '—',
			price: parsed?.price || 'По обява',
			priceUnit: parsed?.priceUnit || '',
			incoterm: loc || 'България',
			harvest: '—',
			quality: desc || 'Виж пълното описание на agri.bg.',
			contact: `Източник: agri.bg · ${sourceUrl}`,
			tags: [categoryTag(cat), roleTag, 'agri.bg'],
			source: 'agri-bg',
			sourceUrl,
			imageUrl: img || undefined,
			publishedAt: new Date().toISOString().slice(0, 10),
		});
	}

	return out;
}
