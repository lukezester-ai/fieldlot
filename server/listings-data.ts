import liveSnapshot from '../data/live-listings.json' with { type: 'json' };
import demoListings from '../data/demo-listings.json' with { type: 'json' };
import type { FieldlotListing, ListingsSnapshot } from './borsa-listings-fetcher.js';
import { fetchAllListingsSnapshot } from './listing-sources/index.js';
import { getMaxListingAgeDays, pruneStaleListings } from './listings-freshness.js';
import {
	loadPersistedListingsSnapshot,
	persistListingsSnapshot,
} from './listings-snapshot-store.js';

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

export function isSyntheticListing(listing: FieldlotListing): boolean {
	if (process.env.FIELDLOT_ENABLE_SYNTHETIC_FEED === '1') return false;
	const source = String((listing as { source?: string }).source ?? '');
	const subtitle = String(listing.subtitle ?? '');
	const id = String(listing.id ?? '');
	return source === 'GlobalFeed' || id.startsWith('gf-') || subtitle.includes('Global Feed');
}

export function redactListingPii(listing: FieldlotListing): FieldlotListing {
	const scrub = (value: string | undefined): string =>
		String(value ?? '')
			.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[контакт скрит]')
			.replace(/(?:\+|00)?\d[\d\s()./-]{7,}\d/g, '[телефон скрит]');
	return {
		...listing,
		quality: scrub(listing.quality),
		contact: scrub(listing.contact),
		harvest: scrub(listing.harvest),
	};
}

export function withoutSyntheticListings(listings: FieldlotListing[]): FieldlotListing[] {
	return listings.filter((row) => !isSyntheticListing(row)).map(redactListingPii);
}

const STATIC = liveSnapshot as ListingsSnapshot;
const DEMO = demoListings as FieldlotListing[];

let memoryCache: { at: number; data: ListingsSnapshot } | null = null;
const CACHE_MS = 6 * 60 * 60 * 1000;

function applyFreshnessFilter(listings: FieldlotListing[]): ListingsSnapshot {
	const { kept, removed } = pruneStaleListings(withoutSyntheticListings(listings));
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
		const filtered = applyFreshnessFilter(STATIC.listings as FieldlotListing[]).listings;
		return filtered.length > 0 ? filtered : DEMO;
	}
	return DEMO;
}

export function getStaticListingsSnapshot(): ListingsSnapshot {
	if (STATIC?.listings?.length) {
		const filtered = applyFreshnessFilter(STATIC.listings as FieldlotListing[]);
		if (filtered.listings.length > 0) return filtered;
		return {
			...filtered,
			source: 'fieldlot.demo',
			sourceUrl: '/data/demo-listings.json',
			count: DEMO.length,
			listings: DEMO,
		};
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

export function setListingsMemoryCache(data: ListingsSnapshot): void {
	memoryCache = { at: Date.now(), data };
}

function finalizeSnapshot(snap: ListingsSnapshot): ListingsSnapshot {
	const listings = withoutSyntheticListings(snap.listings);
	return { ...snap, listings, count: listings.length };
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

	if (!forceRefresh) {
		const persisted = await loadPersistedListingsSnapshot();
		if (persisted?.listings?.length) {
			const data = finalizeSnapshot(persisted);
			if (data.listings.length > 0) {
				setListingsMemoryCache(data);
				return data;
			}
		}
	}

	try {
		const fresh = await fetchAllListingsSnapshot(40);
		const data = finalizeSnapshot(fresh);
		if (data.listings.length > 0) {
			setListingsMemoryCache(data);
			void persistListingsSnapshot(data);
			return data;
		}
	} catch (e) {
		console.warn('[listings-data] live fetch failed:', e instanceof Error ? e.message : e);
	}
	const fallback = getStaticListingsSnapshot();
	setListingsMemoryCache(fallback);
	return fallback;
}

export async function getAllListings(): Promise<FieldlotListing[]> {
	const snap = await getListingsSnapshot();
	return snap.listings;
}

export function getAllListingsSync(): FieldlotListing[] {
	return staticListings();
}
