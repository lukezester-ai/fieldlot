import fs from 'node:fs';
import path from 'node:path';
import {
	fetchBorsaListingsSnapshot,
	type FieldlotListing,
	type ListingsSnapshot,
} from '../borsa-listings-fetcher.js';
import { getMaxListingAgeDays, pruneStaleListings } from '../listings-freshness.js';
import { filterSalesOnly, salesOnlyEnabled } from '../listings-sales-filter.js';
import { fetchAgroListings } from './agro-listings-fetcher.js';
import { fetchAgriListings } from './agri-listings-fetcher.js';
import { fetchGovHtmlListings, type GovHtmlSourceConfig } from './gov-html-fetcher.js';
import { fetchGlobalFeedListings } from './global-feed-generator.js';

type SourceRow = {
	id: string;
	type: string;
	enabled?: boolean;
	name?: string;
	listUrl?: string;
	baseUrl?: string;
	linkInclude?: string;
	linkExclude?: string;
	maxLinks?: number;
};

function loadSourcesConfig(): SourceRow[] {
	const p = path.join(process.cwd(), 'data/listing-sources.json');
	try {
		const raw = JSON.parse(fs.readFileSync(p, 'utf8')) as { sources?: SourceRow[] };
		return Array.isArray(raw.sources) ? raw.sources : [];
	} catch {
		return [{ id: 'borsaagro', type: 'borsa', enabled: true }];
	}
}

function dedupeListings(items: FieldlotListing[]): FieldlotListing[] {
	const byKey = new Map<string, FieldlotListing>();
	for (const item of items) {
		const key = item.sourceUrl || item.id;
		const prev = byKey.get(key);
		if (!prev || (item.publishedAt && (!prev.publishedAt || item.publishedAt > prev.publishedAt))) {
			byKey.set(key, item);
		}
	}
	return [...byKey.values()];
}

/** Всички активни източници → един snapshot. */
export async function fetchAllListingsSnapshot(detailLimit = 40): Promise<ListingsSnapshot> {
	const sources = loadSourcesConfig();
	const all: FieldlotListing[] = [];
	const sourceNames: string[] = [];

	for (const src of sources) {
		if (src.enabled === false) continue;
		try {
			if (src.type === 'borsa') {
				const snap = await fetchBorsaListingsSnapshot(detailLimit);
				all.push(...snap.listings);
				sourceNames.push('borsaagro.com');
				continue;
			}
			if (src.type === 'agri-borsa' || src.id === 'agri-bg') {
				const rows = await fetchAgriListings(src.maxLinks ?? 30);
				all.push(...rows);
				sourceNames.push('agri.bg');
				continue;
			}
			if (src.type === 'agro-obyavi' || src.id === 'agro-bg') {
				const rows = await fetchAgroListings(src.maxLinks ?? 25);
				all.push(...rows);
				sourceNames.push('agro.bg');
				continue;
			}
			if (src.type === 'gov-html' && src.listUrl) {
				const cfg: GovHtmlSourceConfig = {
					id: src.id,
					name: src.name || src.id,
					listUrl: src.listUrl,
					baseUrl: src.baseUrl,
					linkInclude: src.linkInclude,
					linkExclude: src.linkExclude,
					maxLinks: src.maxLinks,
				};
				const rows = await fetchGovHtmlListings(cfg);
				all.push(...rows);
				sourceNames.push(cfg.name);
				continue;
			}
			if (src.type === 'global-feed') {
				const rows = await fetchGlobalFeedListings(src.maxLinks ?? 20);
				all.push(...rows);
				sourceNames.push('Global Feed Exchange');
				continue;
			}
		} catch (e) {
			console.warn(`[listing-sources] ${src.id} failed:`, e instanceof Error ? e.message : e);
		}
	}

	let merged = dedupeListings(all);
	if (salesOnlyEnabled()) {
		const before = merged.length;
		merged = filterSalesOnly(merged);
		if (before > merged.length) {
			console.info(`[listing-sources] само продажби: ${before - merged.length} премахнати`);
		}
	}
	const { kept, removed } = pruneStaleListings(merged);
	const fetchedAt = new Date().toISOString();

	return {
		source: sourceNames.length ? sourceNames.join(' + ') : 'fieldlot',
		sourceUrl: '/data/live-listings.json',
		fetchedAt,
		maxAgeDays: getMaxListingAgeDays(),
		pruned: removed,
		count: kept.length,
		listings: kept,
	};
}

export { loadSourcesConfig };
