import { runListingsSyncPipeline } from '../server/sync-listings-pipeline.js';

async function main() {
	console.log('[sync-listings] all sources + RAG index…');
	const result = await runListingsSyncPipeline({ writeToDisk: true, detailLimit: 40 });
	console.log(
		`[sync-listings] ${result.snapshot.count} listings from ${result.snapshot.source} (pruned ${result.snapshot.pruned})`,
	);
	console.log(
		`[sync-listings] RAG index: ${result.rag.chunkCount} chunks, ${result.rag.embedded} embedded`,
	);
	const mistral = (process.env.MISTRAL_API_KEY ?? '').trim();
	if (mistral && result.rag.chunkCount > 0 && result.rag.embedded === 0) {
		console.error(
			'[sync-listings] FATAL: chunks exist but 0 embeddings while MISTRAL_API_KEY is set. Fix keys or Mistral embed API before shipping.',
		);
		process.exit(1);
	}
	if (result.wroteFiles) {
		console.log('[sync-listings] wrote data/live-listings.json + manifest + public/data');
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
