import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchExchangeSnapshot } from '../../server/exchange-prices.js';

/** Vercel Cron: веднъж дневно — опреснява кеша на борсовите цени. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	const secret = process.env.CRON_SECRET;
	if (secret && req.headers.authorization !== `Bearer ${secret}`) {
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}

	try {
		const snap = await fetchExchangeSnapshot();
		res.status(200).json({
			ok: true,
			message: 'Борсови цени обновени',
			fetchedAt: snap.fetchedAt,
			quotes: snap.quotes.map((q) => ({ name: q.name, priceBgn: q.priceBgn, chg: q.chg })),
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'fetch failed';
		res.status(502).json({ ok: false, error: msg });
	}
}
