import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { handleFieldlotChatPost } from '../server/fieldlot-chat-handler.js';
import { getAllListings } from '../server/fieldlot-rag.js';
import { isAnyLlmConfigured } from '../server/llm-upstream.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
	res.setHeader('Content-Type', 'application/json; charset=utf-8');

	if (req.method === 'OPTIONS') {
		res.status(204).end();
		return;
	}

	if (req.method === 'GET') {
		res.status(200).json({
			ok: true,
			path: '/api/fieldlot-chat',
			llmConfigured: isAnyLlmConfigured(),
			ragEnabled: true,
			listingCount: getAllListings().length,
		});
		return;
	}

	if (req.method !== 'POST') {
		res.status(405).json({ error: 'Методът не е позволен' });
		return;
	}

	const parsed = vercelJsonBody(req.body);
	if (parsed === null) {
		res.status(400).json({ error: 'Невалидно JSON тяло' });
		return;
	}

	const result = await handleFieldlotChatPost(parsed);
	if (result.ok) {
		res.status(200).json({ reply: result.reply, rag: result.rag });
		return;
	}

	res.status(result.status).json({ error: result.error, hint: result.hint });
}
