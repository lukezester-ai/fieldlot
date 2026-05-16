import type { VercelRequest, VercelResponse } from '@vercel/node';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { handleRegisterInterestPost } from '../server/register-interest.js';

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
