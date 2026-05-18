/**
 * Fieldlot — единна таксономия: категории, култури, текстово и филтърно съвпадение.
 */
import type { FieldlotListing } from './borsa-listings-fetcher.js';

export const FIELDLOT_CATEGORY_IDS = [
	'veg',
	'fruit',
	'grain',
	'oil',
	'canned',
	'fertilizer',
	'machines',
	'feed',
] as const;

export type FieldlotCategoryId = (typeof FIELDLOT_CATEGORY_IDS)[number];

export const FIELDLOT_CROP_IDS = [
	'wheat',
	'barley',
	'corn',
	'oats',
	'lentil',
	'sunflower',
	'rapeseed',
	'soy',
	'tomato',
	'pepper',
	'cucumber',
	'apple',
	'herbs',
	'preserves',
	'hay',
	'tractor',
] as const;

export type FieldlotCropId = (typeof FIELDLOT_CROP_IDS)[number];

/** Стари/синонимни id → канонична категория на сайта */
export const CATEGORY_ALIASES: Record<string, FieldlotCategoryId> = {
	oilseed: 'oil',
	oil: 'oil',
	маслодайни: 'oil',
	зърно: 'grain',
	grain: 'grain',
	зеленчуци: 'veg',
	veg: 'veg',
	плодове: 'fruit',
	fruit: 'fruit',
	фураж: 'feed',
	feed: 'feed',
	консерви: 'canned',
	canned: 'canned',
	торове: 'fertilizer',
	fertilizer: 'fertilizer',
	техника: 'machines',
	machines: 'machines',
	машини: 'machines',
	билки: 'veg',
};

export const CATEGORY_LABELS_BG: Record<FieldlotCategoryId, string> = {
	veg: 'Зеленчуци',
	fruit: 'Плодове',
	grain: 'Зърно',
	oil: 'Олио / маслодайни',
	canned: 'Консерви',
	fertilizer: 'Торове',
	machines: 'Машини / техника',
	feed: 'Фураж',
};

export const CATEGORY_LABELS_EN: Record<FieldlotCategoryId, string> = {
	veg: 'Vegetables',
	fruit: 'Fruit',
	grain: 'Grain',
	oil: 'Oil / oilseeds',
	canned: 'Preserves / canned',
	fertilizer: 'Fertilizers',
	machines: 'Machinery',
	feed: 'Feed / forage',
};

export const CROP_LABELS_BG: Record<string, string> = {
	wheat: 'Пшеница',
	barley: 'Ечемик',
	corn: 'Царевица',
	oats: 'Овес',
	lentil: 'Леща',
	sunflower: 'Слънчоглед',
	rapeseed: 'Рапица',
	soy: 'Соя',
	tomato: 'Домати',
	pepper: 'Чушки / пипер',
	cucumber: 'Краставици',
	apple: 'Ябълки',
	herbs: 'Билки / подправки',
	preserves: 'Консерви / преработка',
	hay: 'Сено / фураж',
	tractor: 'Трактор / техника',
};

const CATEGORY_RULES: { re: RegExp; cat: FieldlotCategoryId }[] = [
	{ re: /консерв|лютениц|туршия|маринован|замразен|preserv|canned|jam|pickle/i, cat: 'canned' },
	{ re: /тор|азот|фосфор|калий|urea|npk|fertiliz|агрохим/i, cat: 'fertilizer' },
	{
		re: /jcb|комбайн|трактор|сеялк|пръскач|машин|техник|агрегат|контейнер|plug|harvester|tractor/i,
		cat: 'machines',
	},
	{ re: /билк|подправк|риган|мащерка|mint|herb|лавандул|салвия/i, cat: 'veg' },
	{ re: /пшеница|ечемик|царевица|лещ|зърн|овес|пшен|wheat|corn|barley|oves|rye|жито/i, cat: 'grain' },
	{ re: /слънчоглед|рапиц|олио|експелер|соев|sunflower|rapeseed|oilseed|liucerna|люцерн/i, cat: 'oil' },
	{ re: /ябъл|домат|чушк|плод|fruit|apple|круш|слив|грозд/i, cat: 'fruit' },
	{ re: /крастав|зеленч|зелен |veg|pepper|лук|чесън|морков|тикв/i, cat: 'veg' },
	{ re: /сено|фураж|feed|hay|бали|силоз/i, cat: 'feed' },
	{ re: /бик|теле|овце|животн|саран|риб/i, cat: 'feed' },
];

const CROP_RULES: { re: RegExp; crop: FieldlotCropId }[] = [
	{ re: /пшеница|пшен|wheat|жито/i, crop: 'wheat' },
	{ re: /ечемик|barley/i, crop: 'barley' },
	{ re: /царевица|corn|maize/i, crop: 'corn' },
	{ re: /овес|oves|oats/i, crop: 'oats' },
	{ re: /лещ|lentil/i, crop: 'lentil' },
	{ re: /слънчоглед|sunflower|експелер/i, crop: 'sunflower' },
	{ re: /рапиц|rapeseed/i, crop: 'rapeseed' },
	{ re: /соя|soy/i, crop: 'soy' },
	{ re: /домат|tomato/i, crop: 'tomato' },
	{ re: /чушк|пипер|pepper/i, crop: 'pepper' },
	{ re: /крастав|cucumber/i, crop: 'cucumber' },
	{ re: /ябъл|apple/i, crop: 'apple' },
	{ re: /билк|herb|подправк/i, crop: 'herbs' },
	{ re: /консерв|лютениц|туршия|preserv/i, crop: 'preserves' },
	{ re: /сено|hay/i, crop: 'hay' },
	{ re: /трактор|комбайн|tractor|harvester/i, crop: 'tractor' },
];

const CATEGORY_TAGS: Record<FieldlotCategoryId, string> = {
	grain: 'Зърно',
	oil: 'Олио',
	fruit: 'Плодове',
	veg: 'Зеленчуци',
	feed: 'Фураж',
	machines: 'Техника',
	canned: 'Консерви',
	fertilizer: 'Торове',
};

export function normalizeCategory(raw: string | undefined | null): FieldlotCategoryId {
	const k = String(raw ?? '')
		.trim()
		.toLowerCase();
	if (!k) return 'grain';
	const alias = CATEGORY_ALIASES[k];
	if (alias) return alias;
	if ((FIELDLOT_CATEGORY_IDS as readonly string[]).includes(k)) return k as FieldlotCategoryId;
	return 'grain';
}

export function inferCategory(text: string): FieldlotCategoryId {
	for (const { re, cat } of CATEGORY_RULES) {
		if (re.test(text)) return cat;
	}
	return 'grain';
}

export function inferCrop(text: string): FieldlotCropId | undefined {
	for (const { re, crop } of CROP_RULES) {
		if (re.test(text)) return crop;
	}
	return undefined;
}

export function categoryTag(cat: string): string {
	const n = normalizeCategory(cat);
	return CATEGORY_TAGS[n] || 'Агро';
}

export function listingCrop(item: FieldlotListing): string | undefined {
	const tagged = (item.tags ?? []).find((t) => /^crop:/i.test(t));
	if (tagged) return tagged.replace(/^crop:/i, '').trim();
	const hay = [item.title, item.subtitle, item.quality, ...(item.tags ?? [])].join(' ');
	return inferCrop(hay);
}

export function enrichListing<T extends FieldlotListing>(item: T): T {
	const hay = [item.title, item.subtitle, item.quality, ...(item.tags ?? [])].join(' ');
	const category = normalizeCategory(inferCategory(hay) || item.category);
	const crop = inferCrop(hay) ?? listingCrop(item);
	const tags = [...(item.tags ?? [])];
	if (crop && !tags.some((t) => t.toLowerCase() === `crop:${crop}`)) {
		tags.push(`crop:${crop}`);
	}
	const catLabel = categoryTag(category);
	if (!tags.includes(catLabel)) tags.unshift(catLabel);
	return { ...item, category, tags };
}

export function matchListingCategory(item: FieldlotListing, filterCategory: string): boolean {
	if (!filterCategory.trim()) return true;
	const want = normalizeCategory(filterCategory);
	const have = normalizeCategory(item.category);
	return want === have;
}

export function matchListingCrop(item: FieldlotListing, filterCrop: string): boolean {
	if (!filterCrop.trim()) return true;
	const want = filterCrop.trim().toLowerCase();
	const crop = listingCrop(item);
	if (crop === want) return true;
	const hay = [item.title, item.subtitle, item.quality, ...(item.tags ?? [])]
		.join(' ')
		.toLowerCase();
	const label = CROP_LABELS_BG[want]?.toLowerCase();
	if (label && hay.includes(label)) return true;
	return hay.includes(want);
}

export function matchListingRegion(item: FieldlotListing, filterRegion: string): boolean {
	if (!filterRegion.trim()) return true;
	const reg = filterRegion.trim();
	if (reg === 'national') return true;
	if (item.region === reg) return true;
	if (item.region === 'national') return true;
	return false;
}

export function formatCategoriesForRag(lang: 'bg' | 'en'): string {
	const labels = lang === 'en' ? CATEGORY_LABELS_EN : CATEGORY_LABELS_BG;
	const lines = FIELDLOT_CATEGORY_IDS.map((id) => `• ${id} — ${labels[id]}`).join('\n');
	const crops = FIELDLOT_CROP_IDS.map((id) => `${id} (${CROP_LABELS_BG[id] || id})`).join(', ');
	const head =
		lang === 'en'
			? '=== FIELDLOT CATEGORIES (filter listings & sort photos) ==='
			: '=== КАТЕГОРИИ FIELDLOT (филтрирай обяви и снимки) ===';
	return `${head}\n${lines}\n\n${lang === 'en' ? 'Crops (sub-tags crop:wheat etc.):' : 'Култури (подтагове crop:wheat и т.н.):'} ${crops}\n\n${lang === 'en' ? 'Vision: user may send a photo — classify veg/fruit/grain/oil/canned/fertilizer/machines/feed and wheat/barley/corn/sunflower etc., then search_listings with category + crop.' : 'Vision: потребителят може да прати снимка — разпознай категория и култура (пшеница, ечемик, домати, консерви, техника, билки…), после search_listings с category и crop.'}`;
}
