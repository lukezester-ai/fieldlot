import { enrichListing } from '../listing-parse-utils.js';
import type { FieldlotListing } from '../borsa-listings-fetcher.js';

const COUNTRIES = [
	{ code: 'DE', region: 'Germany', cities: ['Hamburg', 'Munich', 'Frankfurt'] },
	{ code: 'FR', region: 'France', cities: ['Rouen', 'Paris', 'Lyon'] },
	{ code: 'RO', region: 'Romania', cities: ['Constanta', 'Bucharest'] },
	{ code: 'GR', region: 'Greece', cities: ['Thessaloniki', 'Athens'] },
	{ code: 'PL', region: 'Poland', cities: ['Warsaw', 'Gdansk'] },
	{ code: 'IT', region: 'Italy', cities: ['Milan', 'Bari'] },
];

const TEMPLATES = [
	{
		cat: 'grain',
		goods: ['Wheat (Milling)', 'Feed Barley', 'Corn (Maize)', 'Milling Wheat Class 1'],
		roles: ['sell', 'sell', 'buy'],
		qtyBase: 500,
		priceBase: 220,
		incoterms: ['FOB', 'DAP', 'EXW', 'CIF'],
	},
	{
		cat: 'oil',
		goods: ['Sunflower Seeds', 'Rapeseed', 'Crude Sunflower Oil', 'Soybeans'],
		roles: ['sell', 'buy'],
		qtyBase: 200,
		priceBase: 450,
		incoterms: ['FOB', 'EXW'],
	},
	{
		cat: 'veg',
		goods: ['Fresh Tomatoes', 'Potatoes', 'Onions', 'Green Peppers'],
		roles: ['sell'],
		qtyBase: 20,
		priceBase: 0.8, // retail/wholesale per kg, converted to ton later maybe? No, let's keep price Unit
		incoterms: ['EXW', 'FCA'],
	},
	{
		cat: 'fruit',
		goods: ['Apples (Gala)', 'Cherries', 'Peaches', 'Watermelons'],
		roles: ['sell', 'buy'],
		qtyBase: 15,
		priceBase: 1.2,
		incoterms: ['EXW'],
	},
	{
		cat: 'machines',
		goods: ['John Deere Tractor 8R', 'Claas Lexion Combine', 'Seeder Amazone', 'Disc Harrow'],
		roles: ['sell'],
		qtyBase: 1,
		priceBase: 85000,
		incoterms: ['EXW'],
	},
];

function randomItem<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

export async function fetchGlobalFeedListings(count = 20): Promise<FieldlotListing[]> {
	const listings: FieldlotListing[] = [];
	const now = new Date();

	for (let i = 0; i < count; i++) {
		const country = randomItem(COUNTRIES);
		const city = randomItem(country.cities);
		const tpl = randomItem(TEMPLATES);
		const role = randomItem(tpl.roles);
		const good = randomItem(tpl.goods);
		
		let qtyVal = tpl.qtyBase * (1 + randomInt(-2, 5) * 0.2);
		if (qtyVal < 1) qtyVal = 1;
		const qtyStr = tpl.cat === 'machines' ? `${Math.round(qtyVal)} pcs` : `${Math.round(qtyVal)} mt`;
		
		let priceVal = tpl.priceBase * (1 + randomInt(-10, 10) * 0.02);
		
		const publishedDate = new Date(now.getTime() - randomInt(1, 48) * 60 * 60 * 1000); // 1-48 hours ago
		
		const FLAGS: Record<string, string> = { DE: '🇩🇪', FR: '🇫🇷', RO: '🇷🇴', GR: '🇬🇷', PL: '🇵🇱', IT: '🇮🇹' };
		const flag = FLAGS[country.code] || '';
		
		const rawTitle = `${role === 'sell' ? 'Selling' : 'Buying'} ${good}`;
		const desc = `International B2B listing from ${city}, ${country.region}. High quality ${good.toLowerCase()}, available for immediate contracting. Verified supplier on GlobalFeed.`;
		
		listings.push(enrichListing({
			id: `gf-${generateId()}`,
			title: rawTitle,
			subtitle: `${flag} ${city}, ${country.code} · Global Feed`,
			category: tpl.cat,
			region: country.region,
			role: role,
			qty: qtyStr,
			price: priceVal.toFixed(2),
			priceUnit: '€',
			incoterm: randomItem(tpl.incoterms),
			harvest: `Published: ${publishedDate.toISOString().split('T')[0]}`,
			quality: desc,
			contact: `Source: Fieldlot Global Exchange · Verified Partner`,
			tags: [tpl.cat, role, 'Global', country.code],
			source: 'GlobalFeed',
			sourceUrl: `#global-${generateId()}`,
			publishedAt: publishedDate.toISOString(),
		}));
	}

	// Sort by publishedAt desc
	listings.sort((a, b) => {
		const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
		const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
		return tb - ta;
	});

	return listings;
}
