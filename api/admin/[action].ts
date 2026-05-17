import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
	handleAdminGet,
	handleAdminGetKnowledge,
	handleAdminPost,
} from '../../server/admin-handler.js';
import { vercelJsonBody } from '../../lib/vercel-json-body.js';

export const config = { maxDuration: 120 };

function auth(req: VercelRequest): string | undefined {
	return (
		(typeof req.headers.authorization === 'string' && req.headers.authorization) ||
		(typeof req.headers.Authorization === 'string' && req.headers.Authorization) ||
		undefined
	);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		const action = String(req.query.action ?? '').trim();
		if (!action) {
			res.status(400).json({ error: 'Missing action' });
			return;
		}

		if (req.method === 'GET' && action === 'knowledge') {
			const r = await handleAdminGetKnowledge(auth(req));
			res.status(r.status).json(r.body);
			return;
		}

		if (req.method === 'GET') {
			const r = await handleAdminGet(action, auth(req));
			res.status(r.status).json(r.body);
			return;
		}

		if (req.method === 'POST') {
			const body = vercelJsonBody(req.body);
			const r = await handleAdminPost(action, auth(req), body);
			res.status(r.status).json(r.body);
			return;
		}

		res.status(405).json({ error: 'Method not allowed' });
	} catch (e) {
		res.status(500).json({ error: e instanceof Error ? e.message : 'Server error' });
	}
}
