import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { clientIpFromVercelRequest } from '../lib/client-ip.js';
import { handleFieldlotChatPost } from '../server/fieldlot-chat-handler.js';
import { getAllListings } from '../server/fieldlot-rag.js';
import { isAnyLlmConfigured, resolveTextChatUpstream } from '../server/llm-upstream.js';
import { assertLlmRouteRateLimit, jsonRateLimitHeaders } from '../server/api-rate-limit.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	if (req.method === 'GET') {
		const upstream = resolveTextChatUpstream();
		res.status(200).json({
			ok: true,
			path: '/api/fieldlot-chat',
			llmConfigured: isAnyLlmConfigured(),
			ragEnabled: true,
			agentEnabled: Boolean(upstream?.supportsTools && process.env.FIELDLOT_AGENT_DISABLED !== '1'),
			listingCount: getAllListings().length,
		});
		return;
	}

	if (req.method !== 'POST') {
		res.status(405).json({ error: 'Методът не е позволен' });
		return;
	}

	const clientIp = clientIpFromVercelRequest(req);
	const limited = assertLlmRouteRateLimit(clientIp, 'chat');
	if (!limited.ok) {
		res.setHeader('Retry-After', jsonRateLimitHeaders()['Retry-After']);
		res.status(limited.status).json({ error: limited.error, hint: limited.hint });
		return;
	}

	const parsed = vercelJsonBody(req.body);
	if (parsed === null) {
		res.status(400).json({ error: 'Невалидно JSON тяло' });
		return;
	}

	const result = await handleFieldlotChatPost(parsed, { clientIp });
	if (result.ok) {
		res.status(200).json({
			reply: result.reply,
			rag: result.rag,
			actions: result.actions,
			agentMode: result.agentMode,
			semanticHits: result.semanticHits,
			imageClassification: result.imageClassification,
			listingDraft: result.listingDraft,
		});
		return;
	}

	res.status(result.status).json({ error: result.error, hint: result.hint });
}
