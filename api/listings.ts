import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getListingsSnapshot } from '../server/listings-data.js';
import { getHiddenListingIds } from '../server/moderation-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		res.status(405).json({ error: 'Method not allowed' });
		return;
	}
	const refresh = req.query.refresh === '1';
	try {
		const snap = await getListingsSnapshot(refresh);
		const hidden = new Set(await getHiddenListingIds());
		const listings = snap.listings.filter((row) => !hidden.has(String(row.id)));
		res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
		res.status(200).json({
			...snap,
			listings,
			count: listings.length,
			hiddenIds: [...hidden],
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'fetch failed';
		res.status(502).json({ error: msg });
	}
}
