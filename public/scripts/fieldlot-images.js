/**
 * Fieldlot — curated agro photography (Unsplash CDN).
 * One distinct image per catalog crop / listing.
 */
(function initFieldlotImages(global) {
	const u = (id, w = 800) =>
		`https://images.unsplash.com/${id}?w=${w}&q=82&auto=format&fit=crop`;

	/** Per listing id — matches data/demo-listings.json */
	const byListingId = {
		'wheat-dobr': u('photo-1574941067030-5bbd88e19d2a'), // пшеница, жътва
		'sun-pl': u('photo-1597841267669-78581934c8c7'), // слънчоглед
		'corn-buy': u('photo-1551758555-2f57155f9948'), // царевица
		'barley-sz': u('photo-1574323347407-f5bb1c32ea81'), // ечемик
		'apple-plov': u('photo-1619548447819-4eb8c4bf26b2'), // ябълки
		'pepper-buy': u('photo-1608797174445-f9346d944ce4'), // лют пипер
		'rapeseed-vt': u('photo-1470115489034-24a7d4dae01e'), // рапица, жълто поле
		'hay-vid': u('photo-1501006848121-998f65afba42'), // сено, бали
	};

	/** Fallback by category */
	const byCategory = {
		grain: u('photo-1625246333198-78afa1c685ca'),
		oilseed: u('photo-1597841267669-78581934c8c7'),
		fruit: u('photo-1560806887-7866b2d20e81'),
		veg: u('photo-1592924357231-4f3031cef69d'),
		feed: u('photo-1501006848121-998f65afba42'),
	};

	/** Match crop from Bulgarian title when id is unknown */
	const byTitleKeyword = [
		[/пшеница/i, byListingId['wheat-dobr']],
		[/слънчоглед/i, byListingId['sun-pl']],
		[/царевица/i, byListingId['corn-buy']],
		[/ечемик/i, byListingId['barley-sz']],
		[/ябъл/i, byListingId['apple-plov']],
		[/пипер/i, byListingId['pepper-buy']],
		[/рапиц/i, byListingId['rapeseed-vt']],
		[/сено/i, byListingId['hay-vid']],
	];

	function fromTitle(title) {
		if (!title) return null;
		for (const [re, src] of byTitleKeyword) {
			if (re.test(title)) return src;
		}
		return null;
	}

	global.FieldlotImages = {
		hero: u('photo-1500382017468-9049fed747ef', 1800),
		heroGallery: [
			u('photo-1592924357231-4f3031cef69d', 640),
			u('photo-1574941067030-5bbd88e19d2a', 640),
			u('photo-1597841267669-78581934c8c7', 640),
		],
		categories: {
			veg: u('photo-1592924357231-4f3031cef69d', 500),
			fruit: u('photo-1560806887-7866b2d20e81', 500),
			grain: u('photo-1625246333198-78afa1c685ca', 500),
			oil: u('photo-1597841267669-78581934c8c7', 500),
			canned: u('photo-1488459710389-4647bb1535fc', 500),
			fertilizer: u('photo-1416879595882-3373a0480b5b', 500),
			machines: u('photo-1560493678-abe83653c198', 500),
			feed: u('photo-1501006848121-998f65afba42', 500),
		},
		farmer: u('photo-1574943328592-0f0bb9d00b8e', 400),
		farmers: [
			{ name: 'Иван П.', role: 'Зърно · Добруджа', rating: '4.9', img: u('photo-1574943328592-0f0bb9d00b8e', 200) },
			{ name: 'Мария К.', role: 'Зеленчуци · Юг', rating: '4.8', img: u('photo-1464226184884-943aaad88048', 200) },
			{ name: 'Георги Д.', role: 'Овощевъд · Пловдив', rating: '4.7', img: u('photo-1619548447819-4eb8c4bf26b2', 200) },
			{ name: 'Петър С.', role: 'Маслодайни · Север', rating: '4.9', img: u('photo-1597841267669-78581934c8c7', 200) },
		],
		logistics: {
			transport: u('photo-1601584116292-87c22cdc5e65', 600),
			warehouse: u('photo-1586528116311-ad8dd3c83130', 600),
			tracking: u('photo-1464226184884-943aaad88048', 600),
		},
		byCategory,
		byListingId,
		forListing(item) {
			if (!item) return byCategory.grain;
			if (item.id && byListingId[item.id]) return byListingId[item.id];
			const fromT = fromTitle(item.title);
			if (fromT) return fromT;
			if (item.category && byCategory[item.category]) return byCategory[item.category];
			return byCategory.grain;
		},
		imgTag(src, alt, cls) {
			const safeAlt = alt ? String(alt).replace(/"/g, '&quot;') : '';
			return `<img class="${cls || 'fl-photo'}" src="${src}" alt="${safeAlt}" loading="lazy" decoding="async" />`;
		},
	};
})(window);
