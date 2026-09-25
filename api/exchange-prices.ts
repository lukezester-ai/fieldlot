import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { applyCorsHeaders, isCorsPreflight } from '../server/api-cors.js';
import { assertPublicGetRateLimit, jsonRateLimitHeaders } from '../server/api-rate-limit.js';
import { fetchExchangeSnapshot, getExchangeSnapshotCached } from '../server/exchange-prices.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	applyCorsHeaders(res);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (isCorsPreflight(req.method)) {
		res.status(204).end();
		return;
	}

	if (req.method !== 'GET') {
		res.status(405).json({ error: 'Методът не е позволен' });
		return;
	}

	const limited = assertPublicGetRateLimit(clientIpFromVercelRequest(req), 'exchange-prices');
	if (!limited.ok) {
		res.setHeader('Retry-After', jsonRateLimitHeaders()['Retry-After']);
		res.status(limited.status).json({ ok: false, error: limited.error, hint: limited.hint });
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
