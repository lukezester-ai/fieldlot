import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getListingsSnapshot, stripSnapshotMedia } from '../server/listings-data.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	if (req.method !== 'GET') {
		res.status(405).json({ error: 'Method not allowed' });
		return;
	}
	const refresh = req.query.refresh === '1';
	try {
		const snap = stripSnapshotMedia(await getListingsSnapshot(refresh));
		res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
		res.status(200).json(snap);
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'fetch failed';
		res.status(502).json({ error: msg });
	}
}
