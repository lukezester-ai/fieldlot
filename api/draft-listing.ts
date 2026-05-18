import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { handleDraftListingRequest } from '../server/fieldlot-listing-writer.js';
import { isAnyLlmConfigured } from '../server/llm-upstream.js';

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
	if (parsed === null || typeof parsed !== 'object') {
		res.status(400).json({ ok: false, error: 'Невалидно JSON тяло' });
		return;
	}

	const result = await handleDraftListingRequest(parsed as Record<string, unknown>);
	if (!result.ok) {
		res.status(400).json(result);
		return;
	}

	res.status(200).json({
		ok: true,
		draft: result.draft,
		llmConfigured: isAnyLlmConfigured(),
	});
}
