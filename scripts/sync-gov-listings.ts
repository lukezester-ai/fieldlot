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
	if (result.wroteFiles) {
		console.log('[sync-listings] wrote data/live-listings.json + manifest + public/data');
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
