/**
 * Fieldlot — локални снимки от /images/ + manifest за RAG.
 * Не разчита на Unsplash CDN (често блокиран на production).
 */
(function initFieldlotImages(global) {
	const M = {
		hero: {
			background: '/images/hero/background.jpg',
			gallery: {
				fresh: '/images/hero/fresh.jpg',
				tomatoes: '/images/hero/tomatoes.jpg',
				farm: '/images/hero/farm.jpg',
			},
		},
		categories: {
			veg: '/images/crops/pepper.jpg',
			fruit: '/images/crops/apple.jpg',
			grain: '/images/crops/wheat.jpg',
			oil: '/images/crops/sunflower.jpg',
			canned: '/images/crops/pepper.jpg',
			fertilizer: '/images/crops/hay.jpg',
			machines: '/images/hero/farm.jpg',
			feed: '/images/crops/hay.jpg',
		},
		byListingId: {
			'wheat-dobr': '/images/crops/wheat.jpg',
			'sun-pl': '/images/crops/sunflower.jpg',
			'corn-buy': '/images/crops/corn.jpg',
			'barley-sz': '/images/crops/barley.jpg',
			'apple-plov': '/images/crops/apple.jpg',
			'pepper-buy': '/images/crops/pepper.jpg',
			'rapeseed-vt': '/images/crops/rapeseed.jpg',
			'hay-vid': '/images/crops/hay.jpg',
		},
		farmer: '/images/farmers/spotlight.jpg',
		farmers: [
			{ name: 'Иван П.', role: 'Зърно · Добруджа', rating: '4.9', img: '/images/farmers/ivan.jpg' },
			{ name: 'Мария К.', role: 'Зеленчуци · Юг', rating: '4.8', img: '/images/farmers/maria.jpg' },
			{ name: 'Георги Д.', role: 'Овощевъд · Пловдив', rating: '4.7', img: '/images/farmers/georgi.jpg' },
			{ name: 'Петър С.', role: 'Маслодайни · Север', rating: '4.9', img: '/images/farmers/petar.jpg' },
		],
		logistics: {
			transport: '/images/logistics/transport.jpg',
			warehouse: '/images/logistics/warehouse.jpg',
			tracking: '/images/logistics/tracking.jpg',
		},
	};

	const byCategory = {
		grain: M.categories.grain,
		oilseed: M.categories.oil,
		fruit: M.categories.fruit,
		veg: M.categories.veg,
		feed: M.categories.feed,
	};

	const byTitleKeyword = [
		[/пшеница/i, M.byListingId['wheat-dobr']],
		[/слънчоглед/i, M.byListingId['sun-pl']],
		[/царевица/i, M.byListingId['corn-buy']],
		[/ечемик/i, M.byListingId['barley-sz']],
		[/ябъл/i, M.byListingId['apple-plov']],
		[/пипер/i, M.byListingId['pepper-buy']],
		[/рапиц/i, M.byListingId['rapeseed-vt']],
		[/сено/i, M.byListingId['hay-vid']],
	];

	function fromTitle(title) {
		if (!title) return null;
		for (const [re, src] of byTitleKeyword) {
			if (re.test(title)) return src;
		}
		return null;
	}

	function imgTag(src, alt, cls) {
		const safeAlt = alt ? String(alt).replace(/"/g, '&quot;') : '';
		return `<img class="${cls || 'fl-photo'}" src="${src}" alt="${safeAlt}" loading="lazy" decoding="async" />`;
	}

	global.FieldlotImages = {
		manifestPath: '/data/fieldlot-image-manifest.json',
		hero: M.hero.background,
		heroGallery: M.hero.gallery,
		categories: M.categories,
		farmer: M.farmer,
		farmers: M.farmers,
		logistics: M.logistics,
		byCategory,
		byListingId: M.byListingId,
		forListing(item) {
			if (!item) return byCategory.grain;
			if (item.id && M.byListingId[item.id]) return M.byListingId[item.id];
			const fromT = fromTitle(item.title);
			if (fromT) return fromT;
			if (item.category && byCategory[item.category]) return byCategory[item.category];
			return byCategory.grain;
		},
		imgTag,
	};
})(window);
