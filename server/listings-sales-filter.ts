import type { FieldlotListing } from './borsa-listings-fetcher.js';

const BUY_URL_RE = /\/(kupuv|kupuva|kupuvam|купува|купувам|barter|barteri|tursq|tyrshenie)(\/|$|-|_)/i;
const BUY_TEXT_RE = /^(купува|купувам|търся|търси|barter|бартер)\b|купува\s|купувам\s|търсене/i;
const SELL_TEXT_RE = /^(продава|продавам|prodava|prodavam)\b|продажба/i;

/** Само обяви за продажба — без „купува“, бартер и новини. */
export function isSalesListing(item: FieldlotListing): boolean {
	if (item.role === 'buy') return false;

	const url = item.sourceUrl || '';
	if (BUY_URL_RE.test(url)) return false;

	const title = item.title || '';
	if (BUY_TEXT_RE.test(title)) return false;

	if (SELL_TEXT_RE.test(title) || item.role === 'sell') return true;

	// URL slug без явно „купува“
	if (/\/prodav|\/prodava|продавам|prodavam/i.test(url)) return true;

	// Източници с реални обяви (не статии)
	if (item.source === 'borsaagro.com' || item.source === 'agro-bg' || item.source === 'agri-bg') {
		return !BUY_URL_RE.test(url) && !BUY_TEXT_RE.test(title);
	}

	return false;
}

export function filterSalesOnly(listings: FieldlotListing[]): FieldlotListing[] {
	return listings.filter(isSalesListing);
}

export function salesOnlyEnabled(): boolean {
	return process.env.FIELDLOT_SALES_ONLY === '1';
}
