import fs from 'node:fs';
import path from 'node:path';
import { fetchAllListingsSnapshot } from './listing-sources/index.js';
import { rebuildFieldlotRagIndex } from './fieldlot-semantic-rag.js';
import type { FieldlotListing } from './borsa-listings-fetcher.js';

const CROP_IMAGE: { re: RegExp; file: string }[] = [
	{ re: /пшеница/i, file: '/images/crops/wheat.jpg' },
	{ re: /ечемик/i, file: '/images/crops/barley.jpg' },
	{ re: /царевица/i, file: '/images/crops/corn.jpg' },
	{ re: /слънчоглед|експелер/i, file: '/images/crops/sunflower.jpg' },
	{ re: /рапиц/i, file: '/images/crops/rapeseed.jpg' },
	{ re: /лещ/i, file: '/images/crops/feed.jpg' },
	{ re: /олио|соев/i, file: '/images/crops/oil.jpg' },
	{ re: /ябъл/i, file: '/images/crops/apple.jpg' },
	{ re: /пипер|чушк/i, file: '/images/crops/hot-pepper.jpg' },
	{ re: /сено/i, file: '/images/crops/hay.jpg' },
];

const CAT_IMAGE: Record<string, string> = {
	grain: '/images/crops/wheat.jpg',
	oilseed: '/images/crops/sunflower.jpg',
	fruit: '/images/crops/apple.jpg',
	veg: '/images/crops/pepper.jpg',
	feed: '/images/crops/hay.jpg',
};

function imageForListing(item: { title: string; category: string }): string {
	for (const { re, file } of CROP_IMAGE) {
		if (re.test(item.title)) return file;
	}
	return CAT_IMAGE[item.category] || '/images/crops/wheat.jpg';
}

export type SyncPipelineResult = {
	snapshot: Awaited<ReturnType<typeof fetchAllListingsSnapshot>>;
	rag: Awaited<ReturnType<typeof rebuildFieldlotRagIndex>>;
	wroteFiles: boolean;
	paths: { listings?: string; manifest?: string; publicListings?: string };
};

/** Пълен sync: всички източници → JSON + manifest + semantic RAG индекс. */
export async function runListingsSyncPipeline(opts?: {
	writeToDisk?: boolean;
	detailLimit?: number;
}): Promise<SyncPipelineResult> {
	const writeToDisk = opts?.writeToDisk !== false && !process.env.VERCEL;
	const snap = await fetchAllListingsSnapshot(opts?.detailLimit ?? 40);
	const rag = await rebuildFieldlotRagIndex(snap.listings);

	const paths: SyncPipelineResult['paths'] = {};
	if (writeToDisk) {
		const root = process.cwd();
		const outData = path.join(root, 'data/live-listings.json');
		const manifestPath = path.join(root, 'data/fieldlot-image-manifest.json');
		const publicData = path.join(root, 'public/data/live-listings.json');

		fs.writeFileSync(outData, `${JSON.stringify(snap, null, '\t')}\n`, 'utf8');
		paths.listings = outData;

		const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as {
			listings: Record<string, string>;
			listingLabels: Record<string, string>;
			source?: string;
		};
		if (!manifest.listings || typeof manifest.listings !== 'object') manifest.listings = {};
		if (!manifest.listingLabels || typeof manifest.listingLabels !== 'object') {
			manifest.listingLabels = {};
		}
		const LEGACY_DEMO: Record<string, string> = {
			'wheat-dobr': '/images/crops/wheat.jpg',
			'sun-pl': '/images/crops/sunflower.jpg',
			'corn-buy': '/images/crops/corn.jpg',
			'barley-sz': '/images/crops/barley.jpg',
			'apple-plov': '/images/crops/apple.jpg',
			'pepper-buy': '/images/crops/hot-pepper.jpg',
			'rapeseed-vt': '/images/crops/rapeseed.jpg',
			'hay-vid': '/images/crops/hay.jpg',
		};
		for (const [k, v] of Object.entries(LEGACY_DEMO)) {
			if (!manifest.listings[k]) manifest.listings[k] = v;
		}
		for (const item of snap.listings) {
			const fallback = imageForListing(item);
			const prev = manifest.listings[item.id];
			const keepLocal =
				typeof prev === 'string' &&
				prev.startsWith('/images/') &&
				!item.imageUrl;
			manifest.listings[item.id] = item.imageUrl || (keepLocal ? prev : fallback);
			manifest.listingLabels[item.id] = item.title;
		}
		manifest.source = snap.source;
		fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
		paths.manifest = manifestPath;

		fs.mkdirSync(path.dirname(publicData), { recursive: true });
		fs.writeFileSync(publicData, `${JSON.stringify(snap, null, '\t')}\n`, 'utf8');
		paths.publicListings = publicData;
	}

	return { snapshot: snap, rag, wroteFiles: writeToDisk, paths };
}
