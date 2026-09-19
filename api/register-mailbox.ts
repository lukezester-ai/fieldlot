import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { assertIpRateLimit } from '../server/api-rate-limit.js';
import { lookupFirebaseIdToken } from '../server/firebase-id-token.js';
import { registerMailbox } from '../server/mailbox-store.js';

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
		bucket: 'register-mailbox',
		max: 40,
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
	const idToken = typeof (parsed as { idToken?: unknown }).idToken === 'string'
		? (parsed as { idToken: string }).idToken
		: '';
	const user = await lookupFirebaseIdToken(idToken);
	if (!user) {
		res.status(401).json({ ok: false, error: 'Невалидна сесия' });
		return;
	}
	await registerMailbox(user.uid, user.email);
	res.status(200).json({ ok: true });
}
