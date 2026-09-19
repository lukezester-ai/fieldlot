import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { assertIpRateLimit } from '../server/api-rate-limit.js';
import { handleNotifyInquiryPost } from '../server/notify-inquiry.js';

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
		bucket: 'notify-inquiry',
		max: 20,
		windowMs: 15 * 60 * 1000,
	});
	if (!limited.ok) {
		res.setHeader('Retry-After', '60');
		res.status(limited.status).json({ ok: false, error: limited.error, hint: limited.hint });
		return;
	}
	const parsed = vercelJsonBody(req.body);
	if (parsed === null || typeof parsed !== 'object') {
		res.status(400).json({ ok: false, error: 'Невалидно JSON тяло' });
		return;
	}
	const result = await handleNotifyInquiryPost(parsed as Record<string, unknown>);
	res.status(result.ok ? 200 : result.status).json(result);
}
