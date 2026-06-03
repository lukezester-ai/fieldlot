import 'dotenv/config';
import http from 'node:http';
import { handleAdminGet, handleAdminGetKnowledge, handleAdminPost } from './admin-handler.js';
import { handleFieldlotChatPost } from './fieldlot-chat-handler.js';
import { handleDraftListingRequest } from './fieldlot-listing-writer.js';
import { getRagIndexStatus } from './fieldlot-semantic-rag.js';
import { getAllListings } from './fieldlot-rag.js';
import { getListingsSnapshot } from './listings-data.js';
import { handleRegisterInterestPost } from './register-interest.js';
import { fetchExchangeSnapshot, getExchangeSnapshotCached } from './exchange-prices.js';
import { isAnyLlmConfigured, resolveTextChatUpstream } from './llm-upstream.js';

function clientIpFromNodeRequest(req: http.IncomingMessage): string | null {
	const realIp = req.headers['x-real-ip'];
	if (typeof realIp === 'string' && realIp.trim()) return realIp.trim();
	const xf = req.headers['x-forwarded-for'];
	if (typeof xf === 'string' && xf.trim()) {
		const first = xf.split(',').map((s) => s.trim()).find(Boolean);
		if (first) return first;
	}
	const rip = req.socket?.remoteAddress;
	return typeof rip === 'string' && rip.trim() ? rip.trim() : null;
}

const PORT = Number(process.env.FIELDLOT_API_PORT || process.env.PORT || '8789');

async function readJson(req: http.IncomingMessage): Promise<unknown> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(chunk as Buffer);
	}
	const raw = Buffer.concat(chunks).toString('utf8');
	if (!raw.trim()) return {};
	try {
		return JSON.parse(raw) as unknown;
	} catch {
		return null;
	}
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
	res.statusCode = status;
	res.setHeader('Content-Type', 'application/json; charset=utf-8');
	res.end(JSON.stringify(body));
}

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url || '/', 'http://127.0.0.1');
	const path = url.pathname.replace(/\/$/, '') || '/';

	if (req.method === 'OPTIONS') {
		res.statusCode = 204;
		res.end();
		return;
	}

	try {
		if (path === '/' && req.method === 'GET') {
			send(res, 200, {
				ok: true,
				service: 'fieldlot-dev-api',
				hint: 'Open the site with Vite (npm run dev). API is proxied under /api.',
			});
			return;
		}

		if (path === '/api/listings' && req.method === 'GET') {
			const refresh = url.searchParams.get('refresh') === '1';
			const snap = await getListingsSnapshot(refresh);
			send(res, 200, snap);
			return;
		}

		if (path === '/api/exchange-prices' && req.method === 'GET') {
			const force = url.searchParams.get('refresh') === '1';
			try {
				const snap = force ? await fetchExchangeSnapshot() : await getExchangeSnapshotCached();
				send(res, 200, { ok: true, ...snap });
			} catch (e) {
				const msg = e instanceof Error ? e.message : 'exchange fetch failed';
				send(res, 502, { ok: false, error: msg });
			}
			return;
		}

		if (path === '/api/fieldlot-chat' && req.method === 'GET') {
			const upstream = resolveTextChatUpstream();
			send(res, 200, {
				ok: true,
				path: '/api/fieldlot-chat',
				llmConfigured: isAnyLlmConfigured(),
				ragEnabled: true,
				semanticRag: getRagIndexStatus(),
				agentEnabled: Boolean(upstream?.supportsTools && process.env.FIELDLOT_AGENT_DISABLED !== '1'),
				listingCount: getAllListings().length,
			});
			return;
		}

		if (path === '/api/fieldlot-chat' && req.method === 'POST') {
			const body = await readJson(req);
			if (body === null) {
				send(res, 400, { error: 'Invalid JSON' });
				return;
			}
			const result = await handleFieldlotChatPost(body, {
				clientIp: clientIpFromNodeRequest(req),
			});
			if (result.ok) {
				send(res, 200, {
					reply: result.reply,
					rag: result.rag,
					semanticHits: result.semanticHits,
					actions: result.actions,
					agentMode: result.agentMode,
					imageClassification: result.imageClassification,
					listingDraft: result.listingDraft,
				});
				return;
			}
			send(res, result.status, { error: result.error, hint: result.hint });
			return;
		}

		if (path === '/api/draft-listing' && req.method === 'POST') {
			const body = await readJson(req);
			if (body === null || typeof body !== 'object') {
				send(res, 400, { ok: false, error: 'Invalid JSON' });
				return;
			}
			const result = await handleDraftListingRequest(body as Record<string, unknown>);
			send(res, result.ok ? 200 : 400, result);
			return;
		}

		if (path === '/api/register-interest' && req.method === 'POST') {
			const body = await readJson(req);
			if (body === null) {
				send(res, 400, { error: 'Invalid JSON' });
				return;
			}
			const result = await handleRegisterInterestPost(body, {
				clientIp: clientIpFromNodeRequest(req),
			});
			if (result.ok) {
				send(res, 200, {
					ok: true,
					preview: result.preview,
					mailDelivery: result.mailDelivery,
				});
				return;
			}
			send(res, result.status, { ok: false, error: result.error, hint: result.hint });
			return;
		}

		const adminMatch = path.match(/^\/api\/admin\/([^/]+)$/);
		if (adminMatch) {
			let action: string;
			try {
				action = decodeURIComponent(adminMatch[1]);
			} catch {
				send(res, 400, { error: 'Invalid URI component' });
				return;
			}
			const authH =
				typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;
			if (req.method === 'GET' && action === 'knowledge') {
				const r = await handleAdminGetKnowledge(authH);
				send(res, r.status, r.body);
				return;
			}
			if (req.method === 'GET') {
				const r = await handleAdminGet(action, authH);
				send(res, r.status, r.body);
				return;
			}
			if (req.method === 'POST') {
				const body = await readJson(req);
				const r = await handleAdminPost(action, authH, body);
				send(res, r.status, r.body);
				return;
			}
		}

		send(res, 404, { error: 'Not found' });
	} catch (e) {
		console.error('[fieldlot-dev-api]', e);
		send(res, 500, { error: 'Internal error' });
	}
});

server.listen(PORT, '127.0.0.1', () => {
	console.log(`[fieldlot-dev-api] http://127.0.0.1:${PORT} (FIELDLOT_API_PORT)`);
});
