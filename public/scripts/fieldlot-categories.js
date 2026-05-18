/**
 * Fieldlot — клиентски филтри по категория/култура (съвпада с server/fieldlot-categories.ts).
 */
(function initFieldlotCategories(global) {
	const ALIASES = {
		oilseed: 'oil',
		oil: 'oil',
		grain: 'grain',
		veg: 'veg',
		fruit: 'fruit',
		feed: 'feed',
		canned: 'canned',
		fertilizer: 'fertilizer',
		machines: 'machines',
	};

	const CROP_LABELS = {
		wheat: 'пшеница',
		barley: 'ечемик',
		corn: 'царевица',
		sunflower: 'слънчоглед',
		rapeseed: 'рапица',
		tomato: 'домат',
		pepper: 'чушк',
		cucumber: 'крастав',
		apple: 'ябъл',
		herbs: 'билк',
		preserves: 'консерв',
		hay: 'сено',
		tractor: 'трактор',
	};

	function normCat(c) {
		const k = String(c || '')
			.trim()
			.toLowerCase();
		return ALIASES[k] || k;
	}

	function listingCrop(item) {
		const tagged = (item.tags || []).find((t) => /^crop:/i.test(t));
		if (tagged) return tagged.replace(/^crop:/i, '').toLowerCase();
		return '';
	}

	function matchCategory(item, filterCat) {
		if (!filterCat) return true;
		return normCat(item.category) === normCat(filterCat);
	}

	function matchCrop(item, filterCrop) {
		if (!filterCrop) return true;
		const want = filterCrop.trim().toLowerCase();
		const crop = listingCrop(item);
		if (crop === want) return true;
		const hay = [item.title, item.subtitle, item.quality, ...(item.tags || [])]
			.join(' ')
			.toLowerCase();
		const label = CROP_LABELS[want];
		if (label && hay.includes(label)) return true;
		return hay.includes(want);
	}

	function matchRegion(item, filterReg) {
		if (!filterReg) return true;
		if (filterReg === 'national') return true;
		if (item.region === filterReg) return true;
		if (item.region === 'national') return true;
		return false;
	}

	global.FieldlotCategories = {
		normCat,
		listingCrop,
		matchCategory,
		matchCrop,
		matchRegion,
	};
})(window);
