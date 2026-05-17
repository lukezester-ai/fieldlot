/**
 * Generates public/scripts/fieldlot-images.js from data/fieldlot-image-manifest.json
 * so UI and RAG always share the same image map.
 */
import fs from 'node:fs';
import path from 'node:path';

const manifestPath = path.resolve('data/fieldlot-image-manifest.json');
const outPath = path.resolve('public/scripts/fieldlot-images.js');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const js = `/**
 * AUTO-GENERATED from data/fieldlot-image-manifest.json — do not edit by hand.
 * Run: node scripts/sync-images-from-manifest.mjs
 */
(function initFieldlotImages(global) {
	const M = ${JSON.stringify(manifest, null, '\t')};

	const byCategory = {
		grain: M.categories.grain,
		oilseed: M.categories.oil,
		fruit: M.categories.fruit,
		veg: M.categories.veg,
		feed: M.categories.feed,
	};

	const byTitleKeyword = [
		[/пшеница/i, M.listings['wheat-dobr']],
		[/слънчоглед/i, M.listings['sun-pl']],
		[/царевица/i, M.listings['corn-buy']],
		[/ечемик/i, M.listings['barley-sz']],
		[/ябъл/i, M.listings['apple-plov']],
		[/пипер/i, M.listings['pepper-buy']],
		[/рапиц/i, M.listings['rapeseed-vt']],
		[/сено/i, M.listings['hay-vid']],
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
		logistics: {
			transport: M.logistics.transport.path,
			warehouse: M.logistics.warehouse.path,
			tracking: M.logistics.tracking.path,
		},
		byCategory,
		byListingId: M.listings,
		forListing(item) {
			if (!item) return byCategory.grain;
			if (item.imageUrl) return item.imageUrl;
			if (item.id && M.listings[item.id]) {
				const src = M.listings[item.id];
				if (typeof src === 'string' && /^https?:\/\//i.test(src)) return src;
				return src;
			}
			const fromT = fromTitle(item.title);
			if (fromT) return fromT;
			if (item.category && byCategory[item.category]) return byCategory[item.category];
			return byCategory.grain;
		},
		imgTag,
	};
})(window);
`;

fs.writeFileSync(outPath, js);
console.log('Wrote', outPath);
