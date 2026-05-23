import type { FieldlotListing } from './borsa-listings-fetcher.js';
import { enrichListing } from './fieldlot-categories.js';

const MOCK_DATA = {
	grain: ['Пшеница', 'Царевица', 'Ечемик', 'Овес'],
	veg: ['Домати', 'Чушки', 'Краставици', 'Картофи', 'Лук', 'Моркови'],
	fruit: ['Ябълки', 'Круши', 'Сливи', 'Череши', 'Праскови'],
	fertilizer: ['Амониева селитра', 'NPK 15-15-15', 'Карбамид (Урея)', 'Течен тор'],
	machines: ['Трактор', 'Комбайн', 'Плуг', 'Сеялка', 'Пръскачка'],
	feed: ['Люцерна на бали', 'Сено', 'Фураж за птици', 'Кюспе'],
	canned: ['Лютеница домашна', 'Доматено пюре', 'Кисели краставички', 'Сладко от малини'],
	oil: ['Слънчоглед черен', 'Рапица', 'Слънчогледово олио', 'Слънчоглед шарен'],
};

const REGIONS = [
	'Добрич', 'Плевен', 'Стара Загора', 'Ямбол', 'Бургас', 'Варна', 'Пловдив', 'София', 'Русе', 'Враца'
];

function randomChoice(arr: string[]): string {
	return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function fetchMockListings(countPerCategory = 40): Promise<FieldlotListing[]> {
	const results: FieldlotListing[] = [];
	let idCounter = 1;

	const now = Date.now();
	
	for (const [cat, titles] of Object.entries(MOCK_DATA)) {
		for (let i = 0; i < countPerCategory; i++) {
			const title = randomChoice(titles);
			const region = randomChoice(REGIONS);
			const role = Math.random() > 0.8 ? 'buy' : 'sell';
			const qty = randomInt(1, 100) + ' тона';
			const priceNum = randomInt(10, 1000);
			const price = priceNum.toFixed(2);
			
			const daysAgo = randomInt(0, 50);
			const publishedTs = now - daysAgo * 24 * 60 * 60 * 1000;
			const publishedAt = new Date(publishedTs).toISOString();
			
			let raw: FieldlotListing = {
				id: `mock-${cat}-${idCounter++}`,
				title: title,
				subtitle: `🇧🇬 ${region} · Демо Борса`,
				category: cat,
				region: region.toLowerCase(),
				role,
				qty,
				price,
				priceUnit: '€',
				incoterm: 'EXW',
				harvest: `Реколта 2023`,
				quality: 'Отлично качество, съхранявано по стандарт.',
				contact: `Демо обява ${idCounter}`,
				tags: ['Демо'],
				source: 'Демо Борса',
				publishedAt,
			};
			
			results.push(enrichListing(raw));
		}
	}
	
	// Sort by published descending
	results.sort((a, b) => {
		const ta = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
		const tb = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
		return tb - ta;
	});
	
	return results;
}
