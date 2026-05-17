/** Обобщен fetcher за държавни/институционални HTML страници — извлича линкове към обяви/търгове. */

import type { FieldlotListing } from '../borsa-listings-fetcher.js';

export type GovHtmlSourceConfig = {
	id: string;
	name: string;
	listUrl: string;
	baseUrl?: string;
	linkInclude?: string;
	linkExclude?: string;
	maxLinks?: number;
	userAgent?: string;
};

const DEFAULT_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Fieldlot/1.0';

function slugId(prefix: string, url: string): string {
	const tail = url.replace(/[^a-zA-Z0-9]+/g, '-').slice(-48);
	return `${prefix}-${tail}`.slice(0, 64);
}

function resolveUrl(href: string, base: string): string {
	try {
		return new URL(href, base).href;
	} catch {
		return '';
	}
}

function titleFromHref(url: string): string {
	try {
		const u = new URL(url);
		const seg = u.pathname.split('/').filter(Boolean).pop() || u.hostname;
		return decodeURIComponent(seg.replace(/-/g, ' ')).slice(0, 120);
	} catch {
		return url.slice(0, 80);
	}
}

export async function fetchGovHtmlListings(
	cfg: GovHtmlSourceConfig,
): Promise<FieldlotListing[]> {
	const ua = cfg.userAgent || DEFAULT_UA;
	const res = await fetch(cfg.listUrl, {
		headers: {
			'User-Agent': ua,
			Accept: 'text/html,application/xhtml+xml',
			'Accept-Language': 'bg-BG,bg;q=0.9,en;q=0.8',
		},
		signal: AbortSignal.timeout(25_000),
	});
	if (!res.ok) throw new Error(`HTTP ${res.status} for ${cfg.listUrl}`);
	const html = await res.text();
	const base = cfg.baseUrl || cfg.listUrl;
	const includeRe = new RegExp(cfg.linkInclude || 'обява|търг|продаж|закуп|auction|public', 'i');
	const excludeRe = cfg.linkExclude ? new RegExp(cfg.linkExclude, 'i') : null;
	const max = Math.min(cfg.maxLinks ?? 20, 40);
	const hrefRe = /href=["']([^"'#]+)["']/gi;
	const seen = new Set<string>();
	const out: FieldlotListing[] = [];

	let m: RegExpExecArray | null;
	while ((m = hrefRe.exec(html)) !== null && out.length < max) {
		const raw = m[1].trim();
		if (!raw || raw.startsWith('javascript:') || raw.startsWith('mailto:')) continue;
		const url = resolveUrl(raw, base);
		if (!url.startsWith('http') || seen.has(url)) continue;
		if (!includeRe.test(url) && !includeRe.test(raw)) continue;
		if (excludeRe && (excludeRe.test(url) || excludeRe.test(raw))) continue;
		if (/\/(barter|barteri)(\/|$|-|_)/i.test(url)) continue;
		seen.add(url);
		const title = titleFromHref(url);
		const role = /\/(kupuv|kupuva|kupuvam|купува|купувам)(\/|$|-|_)/i.test(url) ? 'buy' : 'sell';
		out.push({
			id: slugId(cfg.id, url),
			title: title.charAt(0).toUpperCase() + title.slice(1),
			subtitle: cfg.name,
			category: 'grain',
			region: 'north',
			role,
			qty: '—',
			price: '—',
			priceUnit: '',
			incoterm: '—',
			harvest: '—',
			quality: '—',
			contact: 'виж източника',
			tags: [cfg.name],
			source: cfg.id,
			sourceUrl: url,
			publishedAt: new Date().toISOString().slice(0, 10),
		});
	}
	return out;
}
