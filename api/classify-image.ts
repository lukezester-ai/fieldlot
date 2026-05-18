import type { VercelRequest, VercelResponse } from '@vercel/node';
import { vercelJsonBody } from '../lib/vercel-json-body.js';
import { classifyAgroImage } from '../server/fieldlot-vision.js';

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
	const body = parsed as Record<string, unknown>;

	const imageBase64 =
		typeof body.imageBase64 === 'string'
			? body.imageBase64
			: typeof body.image === 'string'
				? body.image
				: '';
	const mimeType = typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg';
	const lang = body.lang === 'en' ? 'en' : 'bg';

	if (!imageBase64.trim()) {
		res.status(400).json({ ok: false, error: 'Липсва imageBase64' });
		return;
	}

	if (imageBase64.length > 6_000_000) {
		res.status(413).json({ ok: false, error: 'Снимката е твърде голяма' });
		return;
	}

	const result = await classifyAgroImage({ imageBase64, mimeType, lang });
	res.status(result.ok ? 200 : 502).json(result);
}
