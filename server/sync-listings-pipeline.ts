import fs from 'node:fs';
import path from 'node:path';
import { fetchAllListingsSnapshot } from './listing-sources/index.js';
import { rebuildFieldlotRagIndex } from './fieldlot-semantic-rag.js';
import { enrichListing } from './fieldlot-categories.js';
import { stripListingMedia } from './listings-data.js';

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
	const snapRaw = await fetchAllListingsSnapshot(opts?.detailLimit ?? 40);
	const snap = {
		...snapRaw,
		listings: snapRaw.listings.map((l: any) => {
			const FLAGS: Record<string, string> = {
				'Полша': 'Полша 🇵🇱',
				'Германия': 'Германия 🇩🇪',
				'Гърция': 'Гърция 🇬🇷',
				'Италия': 'Италия 🇮🇹',
				'Румъния': 'Румъния 🇷🇴',
			};
			const locWithFlag = l.location && FLAGS[l.location] ? FLAGS[l.location] : l.location;
			const mapped = {
				...l,
				subtitle: l.subtitle || locWithFlag || 'Международен пазар',
				priceUnit: l.priceUnit || l.currency || '',
			};
			return stripListingMedia(enrichListing(mapped));
		}),
	};
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
		/* Manifest kept for legacy/demo ids only — catalog listings are text-only (no photos). */
		manifest.source = snap.source;
		fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, '\t')}\n`, 'utf8');
		paths.manifest = manifestPath;

		fs.mkdirSync(path.dirname(publicData), { recursive: true });
		fs.writeFileSync(publicData, `${JSON.stringify(snap, null, '\t')}\n`, 'utf8');
		paths.publicListings = publicData;
	}

	return { snapshot: snap, rag, wroteFiles: writeToDisk, paths };
}
