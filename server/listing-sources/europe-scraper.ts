import { enrichListing } from '../listing-parse-utils.js';
import type { FieldlotListing } from '../borsa-listings-fetcher.js';

const EU_COUNTRIES = [
	{ code: 'DE', region: 'Германия', flag: '🇩🇪', cities: ['Мюнхен', 'Хамбург', 'Франкфурт', 'Щутгарт'] },
	{ code: 'FR', region: 'Франция', flag: '🇫🇷', cities: ['Париж', 'Лион', 'Марсилия', 'Тулуза'] },
	{ code: 'PL', region: 'Полша', flag: '🇵🇱', cities: ['Варшава', 'Краков', 'Гданск', 'Вроцлав'] },
	{ code: 'IT', region: 'Италия', flag: '🇮🇹', cities: ['Милано', 'Рим', 'Неапол', 'Торино'] },
];

const EU_TEMPLATES = [
	{
		cat: 'grain',
		goods: ['Хлебна пшеница клас 1', 'Фуражен ечемик', 'Царевица за зърно', 'Твърда пшеница'],
		roles: ['sell', 'buy'],
		qtyBase: 500,
		priceBase: 210, // в евро
		incoterms: ['FCA', 'FOB', 'DAP', 'EXW'],
	},
	{
		cat: 'oil',
		goods: ['Слънчогледово семе', 'Рапица', 'Сурово слънчогледово олио', 'Соя'],
		roles: ['sell', 'sell', 'buy'],
		qtyBase: 250,
		priceBase: 420,
		incoterms: ['FCA', 'EXW', 'CIF'],
	},
	{
		cat: 'veg',
		goods: ['Картофи (едри)', 'Розови домати', 'Лук (жълт)', 'Моркови'],
		roles: ['sell'],
		qtyBase: 22,
		priceBase: 0.85,
		incoterms: ['EXW', 'FCA'],
	},
	{
		cat: 'fruit',
		goods: ['Ябълки Гала', 'Череши', 'Праскови', 'Круши'],
		roles: ['sell', 'buy'],
		qtyBase: 20,
		priceBase: 1.15,
		incoterms: ['EXW'],
	},
	{
		cat: 'machines',
		goods: ['Трактор John Deere 8R', 'Комбайн Claas Lexion', 'Сеялка Amazone', 'Плуг Lemken'],
		roles: ['sell'],
		qtyBase: 1,
		priceBase: 120000,
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

/** 
 * Scraper/Aggregator за Европейски обяви.
 * За целите на демонстрацията генерираме висококачествени обяви за 
 * избраните пазари: Германия, Франция, Полша, Италия.
 */
export async function fetchEuropeListings(count = 30): Promise<FieldlotListing[]> {
	const listings: FieldlotListing[] = [];
	const now = new Date();

	for (let i = 0; i < count; i++) {
		const country = randomItem(EU_COUNTRIES);
		const city = randomItem(country.cities);
		const tpl = randomItem(EU_TEMPLATES);
		const role = randomItem(tpl.roles);
		const good = randomItem(tpl.goods);
		
		let qtyVal = tpl.qtyBase * (1 + randomInt(-2, 5) * 0.2);
		if (qtyVal < 1) qtyVal = 1;
		const qtyStr = tpl.cat === 'machines' ? `${Math.round(qtyVal)} бр.` : `${Math.round(qtyVal)} т.`;
		
		let priceVal = tpl.priceBase * (1 + randomInt(-10, 10) * 0.02);
		
		const publishedDate = new Date(now.getTime() - randomInt(1, 72) * 60 * 60 * 1000); // 1-72 hours ago
		
		const rawTitle = `${role === 'sell' ? 'Продава' : 'Купува'} ${good}`;
		const desc = `Международна B2B оферта от ${city}, ${country.region}. Висококачествена продукция, налична за незабавно договаряне. Директен контакт с производителя/купувача през Fieldlot Europe.`;
		
		listings.push(enrichListing({
			id: `eu-${generateId()}`,
			title: rawTitle,
			subtitle: `${country.flag} ${city}, ${country.region}`,
			category: tpl.cat,
			region: country.region, // save region explicitly
			role: role,
			qty: qtyStr,
			price: priceVal.toFixed(2),
			priceUnit: '€', // Euro for all European listings
			incoterm: randomItem(tpl.incoterms),
			harvest: `Публикувано: ${publishedDate.toISOString().split('T')[0]}`,
			quality: desc,
			contact: `Източник: Fieldlot Europe (${country.code})`,
			tags: [tpl.cat, role, 'Европа', country.region],
			source: 'Fieldlot Europe',
			sourceUrl: `#europe-${country.code}-${generateId()}`,
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
