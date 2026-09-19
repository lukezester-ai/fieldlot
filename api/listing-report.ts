import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { assertIpRateLimit } from '../server/api-rate-limit.js';
import { addListingReport } from '../server/moderation-store.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}
	if (req.method !== 'POST') {
		res.status(405).json({ ok: false, error: 'Методът не е позволен' });
		return;
	}
	const limited = assertIpRateLimit({
		clientIp: clientIpFromVercelRequest(req),
		bucket: 'listing-report',
		max: 20,
		windowMs: 15 * 60 * 1000,
	});
	if (!limited.ok) {
		res.setHeader('Retry-After', '60');
		res.status(limited.status).json({ ok: false, error: limited.error });
		return;
	}
	const parsed = vercelJsonBody(req.body);
	if (parsed === null || typeof parsed !== 'object') {
		res.status(400).json({ ok: false, error: 'Невалидно JSON тяло' });
		return;
	}
	const rec = parsed as Record<string, unknown>;
	const listingId = typeof rec.listingId === 'string' ? rec.listingId.trim() : '';
	const reason = typeof rec.reason === 'string' ? rec.reason.trim() : '';
	const reporterId = typeof rec.reporterId === 'string' ? rec.reporterId.trim() : '';
	if (listingId.length < 4 || reason.length < 4 || reporterId.length < 4) {
		res.status(400).json({ ok: false, error: 'Непълен доклад' });
		return;
	}
	const report = await addListingReport({ listingId, reason, reporterId });
	res.status(200).json({ ok: true, id: report.id });
}
