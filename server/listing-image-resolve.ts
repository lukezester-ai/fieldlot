/**
 * Избор на локална снимка за обява по id, crop: таг, заглавие и категория.
 */
import type { FieldlotListing } from './borsa-listings-fetcher.js';
import { listingCrop, normalizeCategory, type FieldlotCategoryId } from './fieldlot-categories.js';

export type ListingImageMeta = {
	src: string;
	altBg: string;
	altEn: string;
	crop?: string;
	category: FieldlotCategoryId;
};

export const CROP_IMAGE: Record<string, string> = {
	wheat: '/images/crops/wheat.jpg',
	barley: '/images/crops/barley.jpg',
	corn: '/images/crops/corn.jpg',
	oats: '/images/crops/barley.jpg',
	lentil: '/images/crops/feed.jpg',
	sunflower: '/images/crops/sunflower.jpg',
	rapeseed: '/images/crops/rapeseed.jpg',
	soy: '/images/crops/oil.jpg',
	tomato: '/images/hero/tomatoes.jpg',
	pepper: '/images/crops/hot-pepper.jpg',
	cucumber: '/images/hero/cucumbers.jpg',
	apple: '/images/crops/apple.jpg',
	herbs: '/images/crops/pepper.jpg',
	preserves: '/images/crops/canned.jpg',
	hay: '/images/crops/hay.jpg',
	fertilizer: '/images/crops/fertilizer.jpg',
	tractor: '/images/crops/machines.jpg',
};

export const CATEGORY_IMAGE: Record<FieldlotCategoryId, string> = {
	grain: CROP_IMAGE.wheat,
	oil: CROP_IMAGE.sunflower,
	fruit: CROP_IMAGE.apple,
	veg: CROP_IMAGE.pepper,
	feed: CROP_IMAGE.hay,
	canned: CROP_IMAGE.preserves,
	fertilizer: CROP_IMAGE.fertilizer,
	machines: CROP_IMAGE.tractor,
};

const IMAGE_ALT_BG: Record<string, string> = {
	'/images/crops/wheat.jpg': 'Пшеница — зърно на поле',
	'/images/crops/barley.jpg': 'Ечемик — житни класове',
	'/images/crops/corn.jpg': 'Царевица — посев',
	'/images/crops/sunflower.jpg': 'Слънчоглед — маслодайни',
	'/images/crops/rapeseed.jpg': 'Рапица — маслодайни',
	'/images/crops/oil.jpg': 'Олио / соеви продукти',
	'/images/crops/apple.jpg': 'Ябълки — плодове',
	'/images/crops/hot-pepper.jpg': 'Чушки / пипер',
	'/images/crops/hay.jpg': 'Сено / фураж',
	'/images/crops/canned.jpg': 'Консерви / преработка',
	'/images/crops/fertilizer.jpg': 'Торове / агро входове',
	'/images/crops/machines.jpg': 'Селскостопанска техника',
	'/images/hero/tomatoes.jpg': 'Домати — зеленчуци',
	'/images/hero/cucumbers.jpg': 'Краставици',
};

const IMAGE_ALT_EN: Record<string, string> = {
	'/images/crops/wheat.jpg': 'Wheat — grain field',
	'/images/crops/barley.jpg': 'Barley — cereals',
	'/images/crops/corn.jpg': 'Maize / corn field',
	'/images/crops/sunflower.jpg': 'Sunflower — oilseed',
	'/images/crops/rapeseed.jpg': 'Rapeseed',
	'/images/crops/oil.jpg': 'Oil / soy products',
	'/images/crops/apple.jpg': 'Apples — fruit',
	'/images/crops/hot-pepper.jpg': 'Peppers',
	'/images/crops/hay.jpg': 'Hay / forage',
	'/images/crops/canned.jpg': 'Preserves / canned',
	'/images/crops/fertilizer.jpg': 'Fertilizers',
	'/images/crops/machines.jpg': 'Farm machinery',
	'/images/hero/tomatoes.jpg': 'Tomatoes',
	'/images/hero/cucumbers.jpg': 'Cucumbers',
};

/** По-специфичните правила първи (експелер преди слънчоглед в текста). */
const TITLE_RULES: { re: RegExp; crop: keyof typeof CROP_IMAGE }[] = [
	{ re: /експелер|кюспе|шрот/i, crop: 'sunflower' },
	{ re: /олио\s*соев|соево|соев/i, crop: 'soy' },
	{ re: /олио|нерафиниран/i, crop: 'soy' },
	{ re: /пшеница|пшен\b/i, crop: 'wheat' },
	{ re: /ечемик/i, crop: 'barley' },
	{ re: /царевица/i, crop: 'corn' },
	{ re: /слънчоглед/i, crop: 'sunflower' },
	{ re: /рапиц/i, crop: 'rapeseed' },
	{ re: /лещ/i, crop: 'lentil' },
	{ re: /овес/i, crop: 'oats' },
	{ re: /сено|фураж/i, crop: 'hay' },
	{ re: /домат/i, crop: 'tomato' },
	{ re: /ябъл/i, crop: 'apple' },
	{ re: /чушк|пипер/i, crop: 'pepper' },
	{ re: /крастав/i, crop: 'cucumber' },
	{ re: /тор|npk|уреа/i, crop: 'fertilizer' as keyof typeof CROP_IMAGE },
	{ re: /трактор|комбайн|jcb/i, crop: 'tractor' },
	{ re: /консерв|лютениц/i, crop: 'preserves' },
];

function altForPath(src: string, title?: string): { altBg: string; altEn: string } {
	return {
		altBg: IMAGE_ALT_BG[src] || (title ? `${title} — агро продукт` : 'Агро продукт'),
		altEn: IMAGE_ALT_EN[src] || (title ? `${title} — agricultural product` : 'Agricultural product'),
	};
}

function cropFromTags(item: FieldlotListing): string | undefined {
	const tagged = (item.tags ?? []).find((t) => /^crop:/i.test(t));
	if (tagged) return tagged.replace(/^crop:/i, '').trim().toLowerCase();
	return listingCrop(item);
}

export function resolveListingImage(
	item: FieldlotListing,
	manifestListings?: Record<string, string>,
): ListingImageMeta {
	const category = normalizeCategory(item.category);
	const title = item.title || '';

	if (item.imageUrl && /^https?:\/\//i.test(item.imageUrl)) {
		return {
			src: item.imageUrl,
			altBg: title,
			altEn: title,
			category,
			crop: cropFromTags(item),
		};
	}

	if (item.id && manifestListings?.[item.id]) {
		const src = manifestListings[item.id];
		if (src.startsWith('/images/')) {
			const alts = altForPath(src, title);
			return { src, ...alts, category, crop: cropFromTags(item) };
		}
	}

	const crop = cropFromTags(item);
	if (crop && CROP_IMAGE[crop]) {
		const src = CROP_IMAGE[crop];
		return { src, ...altForPath(src, title), category, crop };
	}

	const hay = [title, item.subtitle, item.quality, ...(item.tags ?? [])].join(' ');
	for (const { re, crop: c } of TITLE_RULES) {
		if (re.test(hay) && CROP_IMAGE[c]) {
			const src = CROP_IMAGE[c];
			return { src, ...altForPath(src, title), category, crop: c };
		}
	}

	const src = CATEGORY_IMAGE[category] || CROP_IMAGE.wheat;
	return { src, ...altForPath(src, title), category, crop };
}

/** Текст за RAG — AI да не обърква културите на снимките. */
export function listingImageRagLine(item: FieldlotListing, manifestListings?: Record<string, string>): string {
	const meta = resolveListingImage(item, manifestListings);
	const cropPart = meta.crop ? `култура=${meta.crop}` : `категория=${meta.category}`;
	return `Снимка в UI: ${meta.src} (${meta.altBg}) — ${cropPart}; НЕ показвай царевица при пшеница/ечемик и обратно.`;
}
