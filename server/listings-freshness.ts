import type { FieldlotListing } from './borsa-listings-fetcher.js';

/** Максимална възраст на обява в каталога (дни). Env: LISTINGS_MAX_AGE_DAYS */
export function getMaxListingAgeDays(): number {
	const n = Number(process.env.LISTINGS_MAX_AGE_DAYS ?? '60');
	return Number.isFinite(n) && n > 0 ? Math.floor(n) : 60;
}

export function getMaxListingAgeMs(): number {
	return getMaxListingAgeDays() * 24 * 60 * 60 * 1000;
}

export function listingPublishedTs(listing: FieldlotListing): number {
	const ts = Date.parse(listing.publishedAt || '');
	return Number.isFinite(ts) ? ts : 0;
}

/** true = остава в каталога; без валидна дата или по-стара от лимита → изтрива се */
export function isListingFresh(listing: FieldlotListing, nowMs = Date.now()): boolean {
	const ts = listingPublishedTs(listing);
	if (ts <= 0) return false;
	return nowMs - ts <= getMaxListingAgeMs();
}

export function pruneStaleListings(
	listings: FieldlotListing[],
	nowMs = Date.now(),
): { kept: FieldlotListing[]; removed: number } {
	const kept = listings.filter((l) => isListingFresh(l, nowMs));
	return { kept, removed: listings.length - kept.length };
}
