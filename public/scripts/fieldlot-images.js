/**
 * Fieldlot — curated agro photography (Unsplash CDN, ixlib hotlink format).
 */
(function initFieldlotImages(global) {
	const u = (id, w = 800) =>
		`https://images.unsplash.com/${id}?ixlib=rb-4.0.3&auto=format&fit=crop&w=${w}&q=80`;

	/** Per listing id — matches data/demo-listings.json */
	const byListingId = {
		'wheat-dobr': u('photo-1574941067030-5bbd88e19d2a'),
		'sun-pl': u('photo-1597841267669-78581934c8c7'),
		'corn-buy': u('photo-1551758555-2f57155f9948'),
		'barley-sz': u('photo-1574323347407-f5bb1c32ea81'),
		'apple-plov': u('photo-1619548447819-4eb8c4bf26b2'),
		'pepper-buy': u('photo-1608797174445-f9346d944ce4'),
		'rapeseed-vt': u('photo-1470115489034-24a7d4dae01e'),
		'hay-vid': u('photo-1501006848121-998f65afba42'),
	};

	const byCategory = {
		grain: u('photo-1625246333198-78afa1c685ca'),
		oilseed: u('photo-1597841267669-78581934c8c7'),
		fruit: u('photo-1560806887-7866b2d20e81'),
		veg: u('photo-1592924357231-4f3031cef69d'),
		feed: u('photo-1501006848121-998f65afba42'),
	};

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

	function imgTag(src, alt, cls) {
		const safeAlt = alt ? String(alt).replace(/"/g, '&quot;') : '';
		return `<img class="${cls || 'fl-photo'}" src="${src}" alt="${safeAlt}" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`;
	}

	global.FieldlotImages = {
		/** Фон зад заглавието — зелено поле / жътва */
		hero: u('photo-1464246908011-87a19b8d9d71', 1920),
		heroGallery: {
			fresh: u('photo-1540422610-6a0897cfad21', 720),
			tomatoes: u('photo-1546095664-0f463e4b0b5e', 480),
			farm: u('photo-1625246333198-78afa1c685ca', 480),
		},
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
		farmer: u('photo-1628352081507-8c2e958b5b67', 400),
		farmers: [
			{ name: 'Иван П.', role: 'Зърно · Добруджа', rating: '4.9', img: u('photo-1500659848292-51869a7d3f2c', 200) },
			{ name: 'Мария К.', role: 'Зеленчуци · Юг', rating: '4.8', img: u('photo-1573496359142-b8d87734a5a2', 200) },
			{ name: 'Георги Д.', role: 'Овощевъд · Пловдив', rating: '4.7', img: u('photo-1595273670154-84ffe2938165', 200) },
			{ name: 'Петър С.', role: 'Маслодайни · Север', rating: '4.9', img: u('photo-1507003211169-0a1dd7228f2d', 200) },
		],
		logistics: {
			transport: u('photo-1601584116292-87c22cdc5e65', 640),
			warehouse: u('photo-1586528116311-ad8dd3c83130', 640),
			tracking: u('photo-1566576916181-d993a4baab76', 640),
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
		imgTag,
	};
})(window);
