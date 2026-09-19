import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
	handleAdminGet,
	handleAdminGetKnowledge,
	handleAdminLogin,
	handleAdminLogout,
	handleAdminPost,
	type AdminAuthInput,
} from '../../server/admin-handler.js';
import { clientIpFromVercelRequest } from '../../lib/client-ip.js';
import { vercelJsonBody } from '../../lib/vercel-json-body.js';

export const config = { maxDuration: 120 };

function auth(req: VercelRequest): AdminAuthInput {
	return {
		authorization:
			(typeof req.headers.authorization === 'string' && req.headers.authorization) ||
			(typeof req.headers.Authorization === 'string' && req.headers.Authorization) ||
			undefined,
		cookie: typeof req.headers.cookie === 'string' ? req.headers.cookie : undefined,
	};
}

function send(res: VercelResponse, r: { status: number; body: Record<string, unknown>; setCookie?: string }) {
	if (r.setCookie) res.setHeader('Set-Cookie', r.setCookie);
	res.status(r.status).json(r.body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
	try {
		const action = String(req.query.action ?? '').trim();
		if (!action) {
			res.status(400).json({ error: 'Missing action' });
			return;
		}

		if (req.method === 'POST' && action === 'login') {
			send(
				res,
				await handleAdminLogin(auth(req), vercelJsonBody(req.body), {
					clientIp: clientIpFromVercelRequest(req),
				}),
			);
			return;
		}

		if (req.method === 'POST' && action === 'logout') {
			send(res, handleAdminLogout());
			return;
		}

		if (req.method === 'GET' && action === 'knowledge') {
			send(res, await handleAdminGetKnowledge(auth(req)));
			return;
		}

		if (req.method === 'GET') {
			send(res, await handleAdminGet(action, auth(req)));
			return;
		}

		if (req.method === 'POST') {
			send(res, await handleAdminPost(action, auth(req), vercelJsonBody(req.body)));
			return;
		}

		res.status(405).json({ error: 'Method not allowed' });
	} catch (e) {
		res.status(500).json({ error: e instanceof Error ? e.message : 'Server error' });
	}
}
