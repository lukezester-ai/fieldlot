import type { VercelRequest, VercelResponse } from '@vercel/node';
import { runListingsSyncPipeline } from '../../server/sync-listings-pipeline.js';

/** Vercel Cron: опреснява кеша на обявите от borsaagro.com. */
export default async function handler(req: VercelRequest, res: VercelResponse) {
	const secret = process.env.CRON_SECRET;
	if (secret && req.headers.authorization !== `Bearer ${secret}`) {
		res.status(401).json({ error: 'Unauthorized' });
		return;
	}

	try {
		const result = await runListingsSyncPipeline({ writeToDisk: false, detailLimit: 40 });
		res.status(200).json({
			ok: true,
			message: 'Обяви обновени (памет + RAG индекс)',
			fetchedAt: result.snapshot.fetchedAt,
			count: result.snapshot.count,
			source: result.snapshot.source,
			rag: result.rag,
		});
	} catch (e) {
		const msg = e instanceof Error ? e.message : 'sync failed';
		res.status(502).json({ ok: false, error: msg });
	}
}
