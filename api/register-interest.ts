import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { applyCorsHeaders, isCorsPreflight } from '../server/api-cors.js';
import { assertRegisterInterestRateLimit, jsonRateLimitHeaders } from '../server/api-rate-limit.js';
import { handleRegisterInterestPost } from '../server/register-interest.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	applyCorsHeaders(res);
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (isCorsPreflight(req.method)) {
		res.status(204).end();
		return;
	}

	if (req.method !== 'POST') {
		res.status(405).json({ ok: false, error: 'Методът не е позволен' });
		return;
	}

	const limited = assertRegisterInterestRateLimit(clientIpFromVercelRequest(req));
	if (!limited.ok) {
		res.setHeader('Retry-After', jsonRateLimitHeaders()['Retry-After']);
		res.status(limited.status).json({ ok: false, error: limited.error, hint: limited.hint });
		return;
	}

	const parsed = vercelJsonBody(req.body);
	if (parsed === null) {
		res.status(400).json({ ok: false, error: 'Невалидно JSON тяло' });
		return;
	}

	const result = await handleRegisterInterestPost(parsed, {
		clientIp: clientIpFromVercelRequest(req),
	});

	if (result.ok) {
		res.status(200).json({
			ok: true,
			preview: result.preview,
			mailDelivery: result.mailDelivery,
		});
		return;
	}

	res.status(result.status).json({ ok: false, error: result.error, hint: result.hint });
}
