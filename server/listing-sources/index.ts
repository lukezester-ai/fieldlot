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
import { fetchEuropeListings } from './europe-scraper.js';
import { fetchMockListings } from '../mock-listings-generator.js';

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

export async function fetchAllListingsSnapshot(detailLimit = 40): Promise<ListingsSnapshot> {
	const sources = loadSourcesConfig();
	const all: FieldlotListing[] = [];
	const sourceNames: string[] = [];

	const fetchTasks = sources.map(async (src) => {
		if (src.enabled === false) return null;
		
		let rows: FieldlotListing[] = [];
		let name = '';
		
		if (src.type === 'borsa') {
			const snap = await fetchBorsaListingsSnapshot(detailLimit);
			rows = snap.listings;
			name = 'borsaagro.com';
		} else if (src.type === 'agri-borsa' || src.id === 'agri-bg') {
			rows = await fetchAgriListings(src.maxLinks ?? 30);
			name = 'agri.bg';
		} else if (src.type === 'agro-obyavi' || src.id === 'agro-bg') {
			rows = await fetchAgroListings(src.maxLinks ?? 25);
			name = 'agro.bg';
		} else if (src.type === 'gov-html' && src.listUrl) {
			const cfg: GovHtmlSourceConfig = {
				id: src.id,
				name: src.name || src.id,
				listUrl: src.listUrl,
				baseUrl: src.baseUrl,
				linkInclude: src.linkInclude,
				linkExclude: src.linkExclude,
				maxLinks: src.maxLinks,
			};
			rows = await fetchGovHtmlListings(cfg);
			name = cfg.name;
		} else if (src.type === 'global-feed') {
			rows = await fetchGlobalFeedListings(src.maxLinks ?? 20);
			name = 'Global Feed Exchange';
		} else if (src.type === 'europe') {
			rows = await fetchEuropeListings(src.maxLinks ?? 30);
			name = 'Fieldlot Europe';
		}
		
		return { srcId: src.id, rows, name };
	});

	const results = await Promise.allSettled(fetchTasks);

	for (const res of results) {
		if (res.status === 'fulfilled' && res.value) {
			all.push(...res.value.rows);
			if (res.value.name) sourceNames.push(res.value.name);
		} else if (res.status === 'rejected') {
			console.warn(`[listing-sources] fetch task failed:`, res.reason instanceof Error ? res.reason.message : res.reason);
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
