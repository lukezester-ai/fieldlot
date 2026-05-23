/**
 * Generates public/scripts/fieldlot-images.js from data/fieldlot-image-manifest.json
 * so UI and RAG always share the same image map.
 */
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('data/fieldlot-image-manifest.json');
const outPath = path.resolve('public/scripts/fieldlot-images.js');
const publicManifestPath = path.resolve('public/data/fieldlot-image-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

fs.mkdirSync(path.dirname(publicManifestPath), { recursive: true });
fs.writeFileSync(publicManifestPath, JSON.stringify(manifest, null, '\t') + '\n');
console.log('Wrote', publicManifestPath);

const js = `/**
 * AUTO-GENERATED from data/fieldlot-image-manifest.json — do not edit by hand.
 * Run: node scripts/sync-images-from-manifest.mjs
 */
(function initFieldlotImages(global) {
	const M = ${JSON.stringify(manifest, null, '\t')};

	const CROP_IMG = {
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

	const CAT_IMG = {
		grain: CROP_IMG.wheat,
		oil: CROP_IMG.sunflower,
		oilseed: CROP_IMG.sunflower,
		fruit: CROP_IMG.apple,
		veg: CROP_IMG.pepper,
		feed: CROP_IMG.hay,
		canned: CROP_IMG.preserves,
		fertilizer: CROP_IMG.fertilizer,
		machines: CROP_IMG.tractor,
	};

	const ALT_BG = {
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

	const TITLE_RULES = [
		[/експелер|кюспе|шрот/i, 'sunflower'],
		[/олио\\s*соев|соево|соев/i, 'soy'],
		[/олио|нерафиниран/i, 'soy'],
		[/пшеница|пшен\\b/i, 'wheat'],
		[/ечемик/i, 'barley'],
		[/царевица/i, 'corn'],
		[/слънчоглед/i, 'sunflower'],
		[/рапиц/i, 'rapeseed'],
		[/лещ/i, 'lentil'],
		[/овес/i, 'oats'],
		[/сено|фураж/i, 'hay'],
		[/домат/i, 'tomato'],
		[/ябъл/i, 'apple'],
		[/чушк|пипер/i, 'pepper'],
		[/крастав/i, 'cucumber'],
		[/тор|npk|уреа/i, 'fertilizer'],
		[/трактор|комбайн|jcb/i, 'tractor'],
		[/консерв|лютениц/i, 'preserves'],
	];

	function cropFromTags(item) {
		const tags = item.tags || [];
		const tagged = tags.find((t) => /^crop:/i.test(t));
		if (tagged) return tagged.replace(/^crop:/i, '').trim().toLowerCase();
		return null;
	}

	function altFor(src, title) {
		return ALT_BG[src] || (title ? title + ' — агро продукт' : 'Агро продукт');
	}

	function resolveListingImage(item) {
		if (!item) {
			return { src: CAT_IMG.grain, alt: altFor(CAT_IMG.grain), crop: 'wheat', category: 'grain' };
		}
		const title = item.title || '';
		const category = item.category || 'grain';

		if (item.imageUrl && /^https?:\\/\\//i.test(item.imageUrl)) {
			return { src: item.imageUrl, alt: title, crop: cropFromTags(item), category };
		}
		if (item.id && M.listings[item.id]) {
			const src = M.listings[item.id];
			if (typeof src === 'string' && src.startsWith('/images/')) {
				return { src, alt: M.listingLabels?.[item.id] || altFor(src, title), crop: cropFromTags(item), category };
			}
			if (typeof src === 'string' && /^https?:\\/\\//i.test(src)) {
				return { src, alt: title, crop: cropFromTags(item), category };
			}
		}
		const crop = cropFromTags(item);
		if (crop && CROP_IMG[crop]) {
			const src = CROP_IMG[crop];
			return { src, alt: altFor(src, title), crop, category };
		}
		const hay = [title, item.subtitle, item.quality, ...(item.tags || [])].join(' ');
		for (const [re, c] of TITLE_RULES) {
			if (re.test(hay) && CROP_IMG[c]) {
				const src = CROP_IMG[c];
				return { src, alt: altFor(src, title), crop: c, category };
			}
		}
		const src = CAT_IMG[category] || CAT_IMG.grain;
		return { src, alt: altFor(src, title), crop, category };
	}

	function imgTag(src, alt, cls) {
		const safeAlt = alt ? String(alt).replace(/"/g, '&quot;') : '';
		return \`<img class="\${cls || 'fl-photo'}" src="\${src}" alt="\${safeAlt}" loading="lazy" decoding="async" />\`;
	}

	global.FieldlotImages = {
		manifest: M,
		manifestPath: '/data/fieldlot-image-manifest.json',
		hero: M.hero.background.path,
		heroGallery: {
			tomatoes: M.hero.gallery.tomatoes.path,
			peppers: M.hero.gallery.peppers.path,
			cucumbers: M.hero.gallery.cucumbers.path,
		},
		categories: M.categories,
		farmer: M.farmers.spotlight.path,
		farmers: M.farmers.top.map((f) => ({
			name: f.name,
			role: f.role || '',
			rating: f.rating || '4.8',
			img: f.path,
		})),
		farmerShowcase: (M.farmers.showcase || []).map((s) => ({
			id: s.id,
			img: s.path,
			alt: s.alt || '',
			labelKey: s.labelKey || 'farmers.slotFarm',
		})),
		logistics: {
			transport: M.logistics.transport.path,
			warehouse: M.logistics.warehouse.path,
			tracking: M.logistics.tracking.path,
		},
		byListingId: M.listings,
		resolveListingImage,
		forListing(item) {
			return resolveListingImage(item).src;
		},
		forListingMeta(item) {
			return resolveListingImage(item);
		},
		imgTag,
	};
})(window);
`;

fs.writeFileSync(outPath, js);
console.log('Wrote', outPath);
