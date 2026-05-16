import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchExchangeSnapshot, getExchangeSnapshotCached } from '../server/exchange-prices.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	if (req.method !== 'GET') {
		res.status(405).json({ error: 'Методът не е позволен' });
		return;
	}

	const force = req.query.refresh === '1';
	try {
		const snap = force ? await fetchExchangeSnapshot() : await getExchangeSnapshotCached();
		res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
		res.status(200).json({ ok: true, ...snap });
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Грешка при зареждане на борсови цени';
		res.status(502).json({ ok: false, error: msg });
	}
}
