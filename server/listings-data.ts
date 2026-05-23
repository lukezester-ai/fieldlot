import liveSnapshot from '../data/live-listings.json' with { type: 'json' };
import demoListings from '../data/demo-listings.json' with { type: 'json' };
import type { FieldlotListing, ListingsSnapshot } from './borsa-listings-fetcher.js';
import { fetchAllListingsSnapshot } from './listing-sources/index.js';
import { getMaxListingAgeDays, pruneStaleListings } from './listings-freshness.js';

export type { FieldlotListing, ListingsSnapshot };

/** Обяви без снимки — само текст (жълти страници). */
export function stripListingMedia(listing: FieldlotListing): FieldlotListing {
	const { imageUrl, image, ...rest } = listing as FieldlotListing & { image?: string };
	return rest;
}

export function stripSnapshotMedia(snap: ListingsSnapshot): ListingsSnapshot {
	return {
		...snap,
		listings: snap.listings.map(stripListingMedia),
	};
}

const STATIC = liveSnapshot as ListingsSnapshot;
const DEMO = demoListings as FieldlotListing[];

let memoryCache: { at: number; data: ListingsSnapshot } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

function applyFreshnessFilter(listings: FieldlotListing[]): ListingsSnapshot {
	const { kept, removed } = pruneStaleListings(listings);
	return {
		source: STATIC?.source ?? 'fieldlot',
		sourceUrl: STATIC?.sourceUrl ?? '/data/live-listings.json',
		fetchedAt: STATIC?.fetchedAt ?? new Date().toISOString(),
		maxAgeDays: getMaxListingAgeDays(),
		pruned: removed,
		count: kept.length,
		listings: kept,
	};
}

function staticListings(): FieldlotListing[] {
	if (STATIC?.listings?.length) {
		return applyFreshnessFilter(STATIC.listings as FieldlotListing[]).listings;
	}
	return DEMO;
}

export function getStaticListingsSnapshot(): ListingsSnapshot {
	if (STATIC?.listings?.length) {
		return applyFreshnessFilter(STATIC.listings as FieldlotListing[]);
	}
	return {
		source: 'fieldlot.demo',
		sourceUrl: '/data/demo-listings.json',
		fetchedAt: '',
		maxAgeDays: getMaxListingAgeDays(),
		pruned: 0,
		count: DEMO.length,
		listings: DEMO,
	};
}

export async function getListingsSnapshot(forceRefresh = false): Promise<ListingsSnapshot> {
	if (
		!forceRefresh &&
		memoryCache &&
		Date.now() - memoryCache.at < CACHE_MS &&
		memoryCache.data.listings.length > 0
	) {
		return memoryCache.data;
	}
	try {
		const fresh = await fetchAllListingsSnapshot(40);
		if (fresh.listings.length > 0) {
			memoryCache = { at: Date.now(), data: fresh };
			return fresh;
		}
	} catch (e) {
		console.warn('[listings-data] live fetch failed:', e instanceof Error ? e.message : e);
	}
	const fallback = getStaticListingsSnapshot();
	memoryCache = { at: Date.now(), data: fallback };
	return fallback;
}

export async function getAllListings(): Promise<FieldlotListing[]> {
	const snap = await getListingsSnapshot();
	return snap.listings;
}

export function getAllListingsSync(): FieldlotListing[] {
	return staticListings();
}
